import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, Send, X, Sparkles, AlertCircle, TrendingUp, Loader2, MessageSquare } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../firebase/config';
import { collection, getDocs } from 'firebase/firestore';

interface ChatMessage {
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
}

export default function AIAssistant() {
  const { profile, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Only show for managers and admins
  const canAccess = profile?.role === 'admin' || 
                    profile?.role === 'company_manager' || 
                    profile?.role === 'assistant_manager' ||
                    profile?.role === 'law_firm_manager';

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        role: 'agent',
        content: 'مرحباً! 👋 أنا وكيل JPF الذكي.\n\nأقدر أساعدك في:\n• تحليل حالة القضايا والطلبات\n• كشف الخانات الفاضية\n• اقتراح اختصارات لخطوات العمل\n• تقديم توصيات لتحسين المنصة\n\nاكتب سؤالك أو اطلب تحليل شامل!',
        timestamp: new Date().toISOString(),
      }]);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const token = await user?.getIdToken();
      if (!token) throw new Error('يجب تسجيل الدخول أولاً');

      // Fetch real system stats from Firestore via Firebase SDK (works in browser)
      let systemStats: any = null;
      try {
        const [casesSnap, requestsSnap, paymentsSnap, usersSnap] = await Promise.all([
          getDocs(collection(db, 'cases')),
          getDocs(collection(db, 'requests')),
          getDocs(collection(db, 'payment_plans')),
          getDocs(collection(db, 'users')),
        ]);
        systemStats = {
          totalCases: casesSnap.size,
          totalRequests: requestsSnap.size,
          totalPayments: paymentsSnap.size,
          totalUsers: usersSnap.size,
        };
      } catch (e) {
        console.warn('[AI] Stats fetch failed:', e);
      }

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ message: userMessage.content, systemStats }),
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('استجابة غير صالحة من الخادم. تأكد من تشغيل Ollama على VPS.');
      }

      const data = await response.json();
      
      if (data.success) {
        setMessages(prev => [...prev, {
          role: 'agent',
          content: data.response,
          timestamp: new Date().toISOString(),
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'agent',
          content: `❌ ${data.message || 'حدث خطأ'}`,
          timestamp: new Date().toISOString(),
        }]);
      }
    } catch (error: any) {
      const errMsg = error.name === 'AbortError' 
        ? '⏱️ انتهى وقت الانتظار. خادم الذكاء الاصطناعي يستغرق وقتاً طويلاً. حاول مرة أخرى.'
        : `❌ خطأ: ${error.message}`;
      setMessages(prev => [...prev, {
        role: 'agent',
        content: errMsg,
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    setAnalysisLoading(true);
    setMessages(prev => [...prev, {
      role: 'user',
      content: 'تحليل شامل',
      timestamp: new Date().toISOString(),
    }]);
    try {
      const token = await user?.getIdToken();
      if (!token) {
        throw new Error('يجب تسجيل الدخول أولاً');
      }
      
      // Add 90-second timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);
      
      const response = await fetch('/api/ai/analyze', {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('استجابة غير صالحة من الخادم');
      }
      
      const data = await response.json();
      if (data.success) {
        setAnalysis(data.data);
        const criticalCount = data.data.emptyFieldsReport.filter((r: any) => r.severity === 'critical').length;
        const warningCount = data.data.emptyFieldsReport.filter((r: any) => r.severity === 'warning').length;
        setMessages(prev => [...prev, {
          role: 'agent',
          content: `📊 تحليل شامل للنظام\n\n${data.data.summary}\n\n🔴 خانات فاضية حرجة: ${criticalCount}\n🟡 خانات فاضية تحذيرية: ${warningCount}\n⚠️ اختناقات سير العمل: ${data.data.workflowBottlenecks.length}\n\n💡 توصيات:\n${data.data.recommendations.slice(0, 5).join('\n')}`,
          timestamp: new Date().toISOString(),
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'agent',
          content: `❌ ${data.message || 'فشل التحليل'}`,
          timestamp: new Date().toISOString(),
        }]);
      }
    } catch (error: any) {
      const errMsg = error.name === 'AbortError'
        ? '⏱️ انتهى وقت التحليل. خادم الذكاء الاصطناعي يستغرق وقتاً. حاول مرة أخرى.'
        : `❌ فشل التحليل: ${error.message}`;
      setMessages(prev => [...prev, {
        role: 'agent',
        content: errMsg,
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const sendTelegramReport = async () => {
    try {
      const token = await user?.getIdToken();
      const response = await fetch('/api/ai/telegram-report', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      setMessages(prev => [...prev, {
        role: 'agent',
        content: data.success ? '✅ تم إرسال التقرير إلى تيليجرام!' : `❌ ${data.message}`,
        timestamp: new Date().toISOString(),
      }]);
    } catch (error: any) {
      setMessages(prev => [...prev, {
        role: 'agent',
        content: `❌ خطأ: ${error.message}`,
        timestamp: new Date().toISOString(),
      }]);
    }
  };

  if (!canAccess) return null;

  return (
    <>
      {/* Floating Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 left-6 z-50 w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full shadow-xl shadow-indigo-200 flex items-center justify-center text-white cursor-pointer"
        title="وكيل JPF الذكي"
      >
        {isOpen ? <X size={24} /> : <Bot size={24} />}
      </motion.button>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 left-6 z-50 w-[400px] max-w-[calc(100vw-3rem)] h-[600px] max-h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Bot size={22} className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-bold text-sm">وكيل JPF الذكي</h3>
                <p className="text-white/70 text-xs">مساعدك في إدارة المنصة</p>
              </div>
              <Sparkles size={18} className="text-white/80" />
            </div>

            {/* Quick Actions */}
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex gap-2 flex-wrap">
              <button
                onClick={() => {
                  setMessages(prev => [...prev, 
                    { role: 'user', content: 'اعطني نظرة شاملة عن كل إمكانياتك', timestamp: new Date().toISOString() },
                    { role: 'agent', content: `إليك كل إمكانياتي:\n\n📊 1. تحليل شامل للنظام\nتحليل القضايا، الطلبات، المدفوعات، والمستخدمين مع إحصائيات تفصيلية.\n\n🔍 2. كشف الخانات الفاضية\nفحص كل المستندات في النظام وكشف الحقول الناقصة (حرج وتحذيري).\n\n⚡ 3. تحليل سير العمل\nتحديد الاختناقات في مراحل القضايا (مسودة ← مراجعة ← محكمة ← مغلقة).\n\n💡 4. توصيات ذكية\nاقتراحات عملية لتحسين الكفاءة وتقليل الخطوات.\n\n📲 5. تقارير تيليجرام\nإرسال تقرير كامل مباشرة إلى تيليجرام.\n\n💬 6. محادثة فورية\nالإجابة على أي سؤال عن النظام والحالات.\n\nاضغط على أي زر بالأعلى لتجربة هذه الإمكانيات!`, timestamp: new Date().toISOString() }
                  ]);
                }}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Sparkles size={14} />
                إمكانياتي
              </button>
              <button
                onClick={runAnalysis}
                disabled={analysisLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:border-emerald-200 transition-all disabled:opacity-50 cursor-pointer"
              >
                {analysisLoading ? <Loader2 size={14} className="animate-spin" /> : <TrendingUp size={14} />}
                تحليل شامل
              </button>
              <button
                onClick={() => { setInput('ايش الخانات الفاضية في النظام؟'); sendMessage(); }}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-amber-50 hover:border-amber-200 transition-all disabled:opacity-50 cursor-pointer"
              >
                <AlertCircle size={14} />
                خانات فاضية
              </button>
              <button
                onClick={sendTelegramReport}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-blue-50 hover:border-blue-200 transition-all cursor-pointer"
              >
                <MessageSquare size={14} />
                تقرير تيليجرام
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50/50">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-sm'
                        : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 bg-white border-t border-slate-200">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="اكتب رسالتك..."
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all disabled:opacity-50"
                />
                <button
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}