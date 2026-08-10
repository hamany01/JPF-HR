import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============================================================
// AI Agent Telegram Report — Vercel Serverless Function
// Sends a full system analysis report to Telegram
// ============================================================

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://187.77.66.234:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:3b';
const FIREBASE_PROJECT_ID = 'gen-lang-client-0513298196';
const FIRESTORE_DB_ID = 'ai-studio-5fccf1f6-352e-43ce-80ab-989a6c3d595e';

function decodeFirebaseToken(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload?.user_id || payload?.sub || null;
  } catch {
    return null;
  }
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
    const r: any = {};
    for (const [k, val] of Object.entries(v.mapValue.fields || {})) r[k] = unwrapValue(val);
    return r;
  }
  return null;
}

async function fetchDoc(token: string, collection: string, docId: string): Promise<any | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DB_ID}/documents/${collection}/${docId}`;
  try {
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) return null;
    const json = await resp.json();
    const result: any = { id: docId };
    for (const [k, v] of Object.entries(json.fields || {})) result[k] = unwrapValue(v);
    return result;
  } catch {
    return null;
  }
}

async function fetchCollection(token: string, name: string): Promise<any[]> {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DB_ID}/documents/${name}?pageSize=300`;
  try {
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) return [];
    const json = await resp.json();
    return (json.documents || []).map((doc: any) => {
      const parts = doc.name.split('/');
      const id = parts[parts.length - 1];
      const result: any = { id };
      for (const [k, v] of Object.entries(doc.fields || {})) result[k] = unwrapValue(v);
      return result;
    });
  } catch {
    return [];
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'غير مصرح' });
    }
    const token = authHeader.split('Bearer ')[1];
    const uid = decodeFirebaseToken(token);
    if (!uid) return res.status(401).json({ success: false, message: 'توكن غير صالح' });

    // Get user data
    const userData = await fetchDoc(token, 'users', uid);
    if (!userData) return res.status(403).json({ success: false, message: 'المستخدم غير موجود' });
    if (userData.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'متاح للمشرفين فقط' });
    }

    // Get Telegram settings from Firestore
    const settings = await fetchDoc(token, 'notificationSettings', 'global');
    
    // Try Firestore settings first, then env vars
    const botToken = settings?.telegram?.botToken || process.env.TELEGRAM_BOT_TOKEN || process.env.VITE_TELEGRAM_BOT_TOKEN;
    const chatId = settings?.telegram?.defaultChatId || process.env.TELEGRAM_CHAT_ID || process.env.VITE_TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      return res.status(400).json({ 
        success: false, 
        message: 'إعدادات تيليجرام غير مهيأة. يرجى ضبط Bot Token و Chat ID من إعدادات الإشعارات في المنصة.' 
      });
    }

    // Fetch system data
    const [cases, requests, payments, users] = await Promise.all([
      fetchCollection(token, 'cases'),
      fetchCollection(token, 'requests'),
      fetchCollection(token, 'payment_plans'),
      fetchCollection(token, 'users'),
    ]);

    // Analyze empty fields
    const criticalFields: Record<string, string[]> = {
      cases: ['clientName', 'amountClaimed', 'status', 'assignmentType'],
      requests: ['createdBy', 'status'],
      payment_plans: ['caseId', 'installmentAmount', 'dueDate', 'status'],
      users: ['fullName', 'email', 'role', 'isActive'],
    };

    let emptyCritical = 0;
    let emptyWarning = 0;
    const collections: Record<string, any[]> = { cases, requests, payment_plans, users };
    for (const [colName, docs] of Object.entries(collections)) {
      const fields = criticalFields[colName];
      if (!fields) continue;
      for (const doc of docs) {
        const missing = fields.filter((f: string) => !doc[f] || doc[f] === '' || doc[f] === null || doc[f] === undefined);
        if (missing.length > 0) emptyCritical++;
      }
    }

    // Build report
    const report = `📊 *تقرير وكيل JPF الذكي*

📈 *إحصائيات عامة:*
• القضايا: ${cases.length}
• الطلبات: ${requests.length}
• المدفوعات: ${payments.length}
• المستخدمين: ${users.length}

🔴 *خانات فاضية حرجة:* ${emptyCritical}

💡 *توصيات:*
• راجع الخانات الفاضية في القضايا والطلبات
• تابع القضايا المعلقة في مرحلة "تحت المراجعة"
• فعّل التنبيهات التلقائية للجلسات القادمة

🔗 افتح المنصة: https://jpf-hr.vercel.app`;

    // Send via Telegram API
    const telegramResp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: report,
        parse_mode: 'Markdown',
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!telegramResp.ok) {
      const errText = await telegramResp.text();
      return res.status(502).json({ 
        success: false, 
        message: `فشل إرسال التقرير لتيليجرام: ${telegramResp.status}` 
      });
    }

    return res.json({ success: true, message: 'تم إرسال التقرير إلى تيليجرام بنجاح ✅' });
  } catch (error: any) {
    console.error('[Telegram Report] Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'خطأ داخلي' });
  }
}