import type { VercelRequest, VercelResponse } from '@vercel/node';

// AI Agent chat endpoint for Vercel Serverless Functions

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://187.77.66.234:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:3b';

const SYSTEM_PROMPT = `أنت "وكيل JPF" — مساعد ذكاء اصطناعي متخصص في نظام إدارة الموارد البشرية والقضايا القانونية (JPF-HR).

مهامك:
1. مراقبة نشاط المستخدمين وتحليل أنماط الاستخدام
2. كشف الخانات الفاضية في القضايا والطلبات والمدفوعات
3. اقتراح اختصارات لخطوات العمل المتكررة
4. تقديم توصيات لتحسين المنصة
5. الإجابة على استفسارات المدير حول حالة النظام

قواعدك:
- تحدث بالعربية دائماً
- كن دقيقاً وموجزاً
- استخدم البيانات المقدمة لك لإعطاء إجابات ملموسة
- اقترح حلولاً عملية وقابلة للتنفيذ
- ركز على تحسين الكفاءة وتقليل الخطوات
- إذا ما عندك معلومات كافية، قل ذلك بصراحة`;

// Firebase config
const FIREBASE_PROJECT_ID = 'gen-lang-client-0513298196';
const FIRESTORE_DB_ID = 'ai-studio-5fccf1f6-352e-43ce-80ab-989a6c3d595e';

async function verifyToken(token: string) {
  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.VITE_FIREBASE_API_KEY || ''}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    }
  );
  if (!resp.ok) return null;
  const data = await resp.json();
  return data?.users?.[0]?.localId || null;
}

async function getUserData(uid: string, token: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DB_ID}/documents/users/${uid}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) return null;
  const json = await resp.json();
  const fields = json.fields || {};
  const unwrap = (v: any) => {
    if (!v) return null;
    if ('stringValue' in v) return v.stringValue;
    if ('booleanValue' in v) return v.booleanValue;
    if ('integerValue' in v) return parseInt(v.integerValue);
    if ('doubleValue' in v) return v.doubleValue;
    return null;
  };
  const result: any = {};
  for (const [key, val] of Object.entries(fields)) {
    result[key] = unwrap(val as any);
  }
  return result;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
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
    const uid = await verifyToken(token);
    if (!uid) {
      return res.status(401).json({ success: false, message: 'توكن غير صالح' });
    }

    const userData = await getUserData(uid, token);
    if (!userData) {
      return res.status(403).json({ success: false, message: 'المستخدم غير موجود' });
    }
    if (userData.isActive === false) {
      return res.status(403).json({ success: false, message: 'الحساب غير مفعّل' });
    }

    const role = userData.role || 'employee';
    if (!['admin', 'company_manager', 'assistant_manager', 'law_firm_manager'].includes(role)) {
      return res.status(403).json({ success: false, message: 'الوكيل متاح للمدراء فقط' });
    }

    const { message } = req.body || {};
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'الرسالة فارغة' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ success: false, message: 'الرسالة طويلة جداً' });
    }

    // Build system prompt with context
    let fullPrompt = SYSTEM_PROMPT;
    fullPrompt += `\n\nمعلومات المستخدم:\n- الاسم: ${userData.fullName || userData.name || 'مستخدم'}\n- الدور: ${role}`;

    // Call Ollama
    const ollamaResp = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: 'system', content: fullPrompt },
          { role: 'user', content: message },
        ],
        stream: false,
        options: { temperature: 0.7, num_predict: 1024 },
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!ollamaResp.ok) {
      const errText = await ollamaResp.text();
      return res.status(502).json({ 
        success: false, 
        message: `خطأ في خادم الذكاء الاصطناعي: ${ollamaResp.status}` 
      });
    }

    const data = await ollamaResp.json();
    const response = data?.message?.content || 'عذراً، لم أتمكن من توليد رد.';

    return res.json({ success: true, response });
  } catch (error: any) {
    console.error('[AI Chat] Error:', error);
    if (error.name === 'AbortError') {
      return res.status(504).json({ success: false, message: 'انتهى وقت الانتظار. حاول مرة أخرى.' });
    }
    return res.status(500).json({ success: false, message: error.message || 'خطأ داخلي' });
  }
}