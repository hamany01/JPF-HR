import type { VercelRequest, VercelResponse } from '@vercel/node';

// AI Agent analyze endpoint for Vercel Serverless Functions

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://187.77.66.234:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:3b';
const FIREBASE_PROJECT_ID = 'gen-lang-client-0513298196';
const FIRESTORE_DB_ID = 'ai-studio-5fccf1f6-352e-43ce-80ab-989a6c3d595e';

async function verifyToken(token: string) {
  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.VITE_FIREBASE_API_KEY || ''}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }) }
  );
  if (!resp.ok) return null;
  const data = await resp.json();
  return data?.users?.[0]?.localId || null;
}

function unwrapValue(v: any): any {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return parseInt(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(unwrapValue);
  if ('mapValue' in v) {
    const result: any = {};
    for (const [k, val] of Object.entries(v.mapValue.fields || {})) result[k] = unwrapValue(val);
    return result;
  }
  return null;
}

function fromFirestore(fields: any) {
  const result: any = {};
  for (const [k, v] of Object.entries(fields || {})) result[k] = unwrapValue(v);
  return result;
}

async function fetchCollection(token: string, name: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DB_ID}/documents/${name}?pageSize=300`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) return [];
  const json = await resp.json();
  return (json.documents || []).map((doc: any) => {
    const parts = doc.name.split('/');
    const id = parts[parts.length - 1];
    return { id, ...fromFirestore(doc.fields) };
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'غير مصرح' });
    const token = authHeader.split('Bearer ')[1];
    const uid = await verifyToken(token);
    if (!uid) return res.status(401).json({ success: false, message: 'توكن غير صالح' });

    // Fetch all collections
    const [cases, requests, payments, users] = await Promise.all([
      fetchCollection(token, 'cases'),
      fetchCollection(token, 'requests'),
      fetchCollection(token, 'payment_plans'),
      fetchCollection(token, 'users'),
    ]);

    // Check user role
    const userData = users.find((u: any) => u.id === uid);
    if (!userData || userData.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'التحليل متاح للمشرفين فقط' });
    }

    // Analyze empty fields
    const criticalFields: Record<string, string[]> = {
      cases: ['clientName', 'amountClaimed', 'status', 'assignmentType'],
      requests: ['createdBy', 'status'],
      payment_plans: ['caseId', 'installmentAmount', 'dueDate', 'status'],
      users: ['fullName', 'email', 'role', 'isActive'],
    };

    const emptyFieldsReport: any[] = [];
    const collections: Record<string, any[]> = { cases, requests, payment_plans, users };

    for (const [colName, docs] of Object.entries(collections)) {
      const fields = criticalFields[colName];
      if (!fields) continue;
      for (const doc of docs) {
        const missing = fields.filter((f: string) => !doc[f] || doc[f] === '' || doc[f] === null || doc[f] === undefined);
        if (missing.length > 0) {
          emptyFieldsReport.push({ collection: colName, documentId: doc.id, missingFields: missing, severity: 'critical' });
        }
      }
    }

    // Analyze workflow
    const statusCounts: Record<string, number> = {};
    for (const c of cases) {
      const s = (c as any).status || 'unknown';
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    }

    const bottlenecks: any[] = [];
    const stages = [
      { name: 'مسودة', key: 'draft' },
      { name: 'تحت المراجعة', key: 'under_review' },
      { name: 'إسناد داخلي', key: 'internal' },
      { name: 'إسناد خارجي', key: 'external_assigned' },
      { name: 'بالمحكمة', key: 'in_court' },
    ];
    for (const s of stages) {
      const count = statusCounts[s.key] || 0;
      if (count > 5) bottlenecks.push({ stage: s.name, count, averageTimeDays: 0, suggestion: `مراجعة القضايا في مرحلة ${s.name}` });
    }

    // Generate AI recommendations
    let recommendations: string[] = [];
    try {
      const stats = { totalCases: cases.length, totalRequests: requests.length, totalPayments: payments.length, totalUsers: users.length, emptyFields: emptyFieldsReport.length, bottlenecks: bottlenecks.length };
      const ollamaResp = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: [{ role: 'user', content: `حلل هذه الإحصائيات واقترح 3 توصيات عملية قصيرة:\n${JSON.stringify(stats)}` }],
          stream: false,
          options: { temperature: 0.7, num_predict: 512 },
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (ollamaResp.ok) {
        const data = await ollamaResp.json();
        recommendations = (data?.message?.content || '').split('\n').filter((l: string) => l.trim()).slice(0, 5);
      }
    } catch {}

    if (recommendations.length === 0) {
      recommendations = [
        '💡 راجع الخانات الفاضية في القضايا والطلبات',
        '💡 تابع القضايا المعلقة في مرحلة "تحت المراجعة"',
        '💡 فعّل التنبيهات التلقائية للجلسات القادمة',
      ];
    }

    const summary = `النظام يحتوي على ${cases.length} قضية، ${requests.length} طلب، ${payments.length} دفعة، و${users.length} مستخدم. ${emptyFieldsReport.length} مستند يحتوي خانات فاضية، و${bottlenecks.length} اختناق في سير العمل.`;

    return res.json({
      success: true,
      data: {
        totalCases: cases.length,
        totalRequests: requests.length,
        totalPayments: payments.length,
        totalUsers: users.length,
        emptyFieldsReport,
        workflowBottlenecks: bottlenecks,
        recommendations,
        summary,
      },
    });
  } catch (error: any) {
    console.error('[AI Analyze] Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'خطأ داخلي' });
  }
}