import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============================================================
// AI Agent Chat — Vercel Serverless Function
// Simplified: JWT decode only, no Firestore needed
// ============================================================

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://187.77.66.234:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:3b';

const SYSTEM_PROMPT = `أنت وكيل ذكاء اصطناعي يعمل داخل نظام JPF-HR (منصة إدارة الموارد البشرية والقضايا القانونية). أنت لست نموذج عام بل وكيل مخصص لهذا النظام.

عندما يطلب المستخدم إمكانياتك، اذكرها كالتالي:
1. تحليل النظام: إحصائيات القضايا والطلبات والمدفوعات والمستخدمين
2. كشف الخانات الفاضية: فحص المستندات وإيجاد الحقول الناقصة
3. تحليل سير العمل: تحديد الاختناقات والمراحل المعلقة
4. توصيات ذكية: اقتراحات لتحسين الكفاءة
5. تقارير تيليجرام: إرسال تقارير للإدارة

قواعد: تحدث بالعربية، كن موجزاً، نفذ الطلبات مباشرة، لا تقل إنك لا تملك صلاحيات.
إذا لم تكن لديك بيانات حقيقية، قل ذلك بصراحة ولا تخترع أرقاماً.`;

// Decode Firebase JWT to extract UID and email (no external verification needed)
function decodeFirebaseToken(token: string): { uid: string; email: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    
    // Check if token is expired
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return null;
    }
    
    // Verify issuer is Firebase Auth
    if (payload.iss && !payload.iss.includes('securetoken.google.com')) {
      return null;
    }
    
    return {
      uid: payload.user_id || payload.sub || '',
      email: payload.email || '',
    };
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
    
    const userInfo = decodeFirebaseToken(token);
    if (!userInfo || !userInfo.uid) {
      return res.status(401).json({ success: false, message: 'توكن غير صالح أو منتهي الصلاحية' });
    }

    const { message, systemStats } = req.body || {};
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'الرسالة فارغة' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ success: false, message: 'الرسالة طويلة جداً' });
    }

    // Build system prompt with optional real stats from frontend
    let fullPrompt = SYSTEM_PROMPT;
    fullPrompt += `\n\nمعلومات المستخدم: ${userInfo.email || userInfo.uid}`;
    
    // If frontend sends real stats, include them
    if (systemStats) {
      fullPrompt += `\n\nإحصائيات حقيقية من قاعدة البيانات (استخدم هذه الأرقام فقط):\n${JSON.stringify(systemStats)}`;
    }

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
      console.error('[AI Chat] Ollama error:', ollamaResp.status);
      return res.status(502).json({ 
        success: false, 
        message: `خطأ في خادم الذكاء الاصطناعي (${ollamaResp.status}). تأكد من تشغيل Ollama على VPS.` 
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