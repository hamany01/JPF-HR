import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============================================================
// AI Agent Chat — Vercel Serverless Function
// Uses Firestore REST API with user's Bearer token (no API key needed)
// ============================================================

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://187.77.66.234:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:3b';
const FIREBASE_PROJECT_ID = 'gen-lang-client-0513298196';
const FIRESTORE_DB_ID = 'ai-studio-5fccf1f6-352e-43ce-80ab-989a6c3d595e';

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
- إذا ما عندك معلومات كافية، قل ذلك بصراحة
- لا تسأل عن التوضيح إذا كان الطلب واضحاً — نفذ مباشرة
- إذا سئلت عن إمكانياتك، اذكرها كلها بشكل منظّم

إمكانياتك:
1. 📊 تحليل شامل للنظام — إحصائيات القضايا، الطلبات، المدفوعات، المستخدمين
2. 🔍 كشف الخانات الفاضية — فحص كل المستندات وإيجاد الحقول الناقصة
3. ⚡ تحليل سير العمل — تحديد الاختناقات والمراحل المعلقة
4. 💡 توصيات ذكية — اقتراحات لتحسين الكفاءة وتقليل الخطوات
5. 📲 تقارير تيليجرام — إرسال تقارير مباشرة إلى تيليجرام
6. 💬 محادثة فورية — الإجابة على أي سؤال عن النظام
7. 🔐 مراقبة أمنية — التحقق من الصلاحيات والوصول

صيغة التنبيهات:
- 🔴 حرج: يحتاج إجراء فوري
- 🟡 تحذير: يحتاج متابعة قريبة
- 🟢 معلومة: للعلم فقط
- 💡 توصية: اقتراح تحسين`;

// Decode Firebase JWT to extract UID (no verification — Firestore will verify)
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

// Fetch user data from Firestore using the user's own Bearer token
async function getUserData(uid: string, token: string): Promise<any | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DB_ID}/documents/users/${uid}`;
  try {
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) return null;
    const json = await resp.json();
    const fields = json.fields || {};
    const unwrap = (v: any): any => {
      if (!v) return null;
      if ('stringValue' in v) return v.stringValue;
      if ('booleanValue' in v) return v.booleanValue;
      if ('integerValue' in v) return parseInt(v.integerValue);
      if ('doubleValue' in v) return v.doubleValue;
      if ('nullValue' in v) return null;
      if ('arrayValue' in v) return (v.arrayValue.values || []).map(unwrap);
      if ('mapValue' in v) {
        const r: any = {};
        for (const [k, val] of Object.entries(v.mapValue.fields || {})) r[k] = unwrap(val);
        return r;
      }
      return null;
    };
    const result: any = { id: uid };
    for (const [k, v] of Object.entries(fields)) result[k] = unwrap(v as any);
    return result;
  } catch {
    return null;
  }
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
      return res.status(401).json({ success: false, message: 'غير مصرح: يجب تسجيل الدخول' });
    }
    const token = authHeader.split('Bearer ')[1];
    if (!token || token.length < 10) {
      return res.status(401).json({ success: false, message: 'غير مصرح: توكن فارغ' });
    }

    // Decode UID from JWT
    const uid = decodeFirebaseToken(token);
    if (!uid) {
      return res.status(401).json({ success: false, message: 'توكن غير صالح: لا يمكن قراءة المعرف' });
    }

    // Verify token by fetching user data from Firestore
    const userData = await getUserData(uid, token);
    if (!userData) {
      return res.status(403).json({ success: false, message: 'المستخدم غير موجود في النظام' });
    }
    if (userData.isActive === false) {
      return res.status(403).json({ success: false, message: 'الحساب غير مفعّل' });
    }

    const role = userData.role || 'employee';
    const allowedRoles = ['admin', 'company_manager', 'assistant_manager', 'law_firm_manager', 'law_manager'];
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ success: false, message: 'الوكيل متاح للمدراء فقط' });
    }

    const { message } = req.body || {};
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'الرسالة فارغة' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ success: false, message: 'الرسالة طويلة جداً (الحد الأقصى 2000 حرف)' });
    }

    // Build system prompt with user context
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
      console.error('[AI Chat] Ollama error:', ollamaResp.status, errText);
      return res.status(502).json({ 
        success: false, 
        message: `خطأ في خادم الذكاء الاصطناعي (${ollamaResp.status}). تأكد من تشغيل Ollama على VPS.` 
      });
    }

    const data = await ollamaResp.json();
    const response = data?.message?.content || 'عذراً، لم أتمكن من توليد رد. حاول مرة أخرى.';

    return res.json({ success: true, response });
  } catch (error: any) {
    console.error('[AI Chat] Error:', error);
    if (error.name === 'AbortError') {
      return res.status(504).json({ success: false, message: 'انتهى وقت الانتظار. حاول مرة أخرى.' });
    }
    return res.status(500).json({ success: false, message: error.message || 'خطأ داخلي في الخادم' });
  }
}