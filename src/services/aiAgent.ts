/**
 * AI Agent Service — JPF-HR
 * 
 * وكيل ذكاء اصطناعي يراقب المنصة، يحلل البيانات، ويقدم توصيات
 * يستخدم Google Gemini AI (الموجود مسبقاً في المشروع)
 */

import { GoogleGenAI } from '@google/genai';

// ============================================================
// AI Agent Configuration
// ============================================================

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

صيغة التنبيهات:
- 🔴 حرج: يحتاج إجراء فوري
- 🟡 تحذير: يحتاج متابعة قريبة
- 🟢 معلومة: للعلم فقط
- 💡 توصية: اقتراح تحسين`;

// Initialize Gemini AI
let aiInstance: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured. Set it in environment variables.');
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

// ============================================================
// Types
// ============================================================

export interface AIInsight {
  id: string;
  severity: 'critical' | 'warning' | 'info' | 'recommendation';
  category: 'empty_fields' | 'workflow' | 'performance' | 'security' | 'general';
  title: string;
  description: string;
  action?: string;
  createdAt: string;
}

export interface DataAnalysisResult {
  totalCases: number;
  totalRequests: number;
  totalPayments: number;
  totalUsers: number;
  emptyFieldsReport: EmptyFieldReport[];
  workflowBottlenecks: WorkflowBottleneck[];
  recommendations: string[];
  summary: string;
}

export interface EmptyFieldReport {
  collection: string;
  documentId: string;
  missingFields: string[];
  severity: 'critical' | 'warning' | 'info';
}

export interface WorkflowBottleneck {
  stage: string;
  averageTimeDays: number;
  count: number;
  suggestion: string;
}

// ============================================================
// AI Chat Service
// ============================================================

export async function chatWithAgent(
  message: string,
  context?: {
    userRole?: string;
    userName?: string;
    systemStats?: any;
  }
): Promise<string> {
  try {
    const ai = getAI();
    
    // Build context-aware prompt
    let contextPrompt = SYSTEM_PROMPT;
    if (context?.userRole) {
      contextPrompt += `\n\nمعلومات المستخدم الحالي:\n- الاسم: ${context.userName || 'غير معروف'}\n- الدور: ${context.userRole}`;
    }
    if (context?.systemStats) {
      contextPrompt += `\n\nإحصائيات النظام الحالية:\n${JSON.stringify(context.systemStats, null, 2)}`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: message,
      config: {
        systemInstruction: contextPrompt,
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    });

    return response.text || 'عذراً، لم أتمكن من توليد رد. حاول مرة أخرى.';
  } catch (error: any) {
    console.error('[AI Agent] Chat error:', error);
    return `❌ حدث خطأ: ${error.message || 'خطأ غير معروف'}`;
  }
}

// ============================================================
// Data Analysis Service — كشف الخانات الفاضية
// ============================================================

export async function analyzeEmptyFields(db: any): Promise<EmptyFieldReport[]> {
  const reports: EmptyFieldReport[] = [];
  
  // Critical fields that should never be empty
  const criticalFields = {
    cases: ['clientName', 'amountClaimed', 'status', 'assignmentType'],
    requests: ['createdBy', 'status'],
    payment_plans: ['caseId', 'installmentAmount', 'dueDate', 'status'],
    users: ['fullName', 'email', 'role', 'isActive'],
  };

  // Optional but recommended fields
  const recommendedFields = {
    cases: ['clientId', 'lawFirmId', 'salesEmployeeId', 'assignedAssistantId'],
    requests: ['requestCreatedBy', 'lawFirmId'],
    payment_plans: ['notes', 'paidAmount'],
    users: ['phone', 'telegramChatId'],
  };

  for (const [collection, fields] of Object.entries(criticalFields)) {
    try {
      const snapshot = await db.collection(collection).get();
      snapshot.forEach((doc: any) => {
        const data = doc.data();
        const missing = fields.filter((field: string) => 
          !data[field] || data[field] === '' || data[field] === null || data[field] === undefined
        );
        if (missing.length > 0) {
          reports.push({
            collection,
            documentId: doc.id,
            missingFields: missing,
            severity: 'critical',
          });
        }
      });
    } catch (err) {
      console.error(`[AI Agent] Error analyzing ${collection}:`, err);
    }
  }

  for (const [collection, fields] of Object.entries(recommendedFields)) {
    try {
      const snapshot = await db.collection(collection).get();
      snapshot.forEach((doc: any) => {
        const data = doc.data();
        const missing = fields.filter((field: string) => 
          !data[field] || data[field] === '' || data[field] === null || data[field] === undefined
        );
        if (missing.length > 0) {
          // Check if this document already has a critical report
          const existing = reports.find(r => r.collection === collection && r.documentId === doc.id);
          if (existing) {
            existing.missingFields.push(...missing);
          } else {
            reports.push({
              collection,
              documentId: doc.id,
              missingFields: missing,
              severity: 'warning',
            });
          }
        }
      });
    } catch (err) {
      console.error(`[AI Agent] Error analyzing ${collection}:`, err);
    }
  }

  return reports;
}

// ============================================================
// Workflow Analysis — تحليل سير العمل
// ============================================================

export async function analyzeWorkflow(db: any): Promise<WorkflowBottleneck[]> {
  const bottlenecks: WorkflowBottleneck[] = [];

  try {
    // Analyze case status distribution
    const casesSnapshot = await db.collection('cases').get();
    const statusCounts: Record<string, number> = {};
    
    casesSnapshot.forEach((doc: any) => {
      const data = doc.data();
      const status = data.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    // Identify bottlenecks
    const stages = [
      { name: 'مسودة', key: 'draft', suggestion: 'مراجعة الطلبات المسودة وإكمال بياناتها' },
      { name: 'تحت المراجعة', key: 'under_review', suggestion: 'تسريع عملية المراجعة وتحويلها لقضية' },
      { name: 'إسناد داخلي', key: 'internal', suggestion: 'متابعة القضايا الداخلية وتحويلها للمحكمة' },
      { name: 'إسناد خارجي', key: 'external_assigned', suggestion: 'متابعة مكتب المحاماة لتسريع الإجراءات' },
      { name: 'بالمحكمة', key: 'in_court', suggestion: 'تتبع الجلسات وتحديث المواعيد بانتظام' },
    ];

    for (const stage of stages) {
      const count = statusCounts[stage.key] || 0;
      if (count > 5) {
        bottlenecks.push({
          stage: stage.name,
          averageTimeDays: 0, // Would need timestamp analysis
          count,
          suggestion: `${stage.suggestion} (${count} قضية في هذه المرحلة)`,
        });
      }
    }
  } catch (err) {
    console.error('[AI Agent] Error analyzing workflow:', err);
  }

  return bottlenecks;
}

// ============================================================
// Full System Analysis
// ============================================================

export async function performFullAnalysis(db: any): Promise<DataAnalysisResult> {
  try {
    // Get counts
    const [casesSnap, requestsSnap, paymentsSnap, usersSnap] = await Promise.all([
      db.collection('cases').get(),
      db.collection('requests').get(),
      db.collection('payment_plans').get(),
      db.collection('users').get(),
    ]);

    const totalCases = casesSnap.size;
    const totalRequests = requestsSnap.size;
    const totalPayments = paymentsSnap.size;
    const totalUsers = usersSnap.size;

    // Analyze empty fields
    const emptyFieldsReport = await analyzeEmptyFields(db);

    // Analyze workflow
    const workflowBottlenecks = await analyzeWorkflow(db);

    // Generate AI-powered recommendations
    const statsForAI = {
      totalCases,
      totalRequests,
      totalPayments,
      totalUsers,
      emptyFieldsCount: emptyFieldsReport.length,
      bottlenecksCount: workflowBottlenecks.length,
      topBottlenecks: workflowBottlenecks.slice(0, 3),
    };

    let recommendations: string[] = [];
    try {
      const aiResponse = await chatWithAgent(
        `حلل هذه الإحصائيات واقترح 3-5 توصيات عملية لتحسين المنصة:\n${JSON.stringify(statsForAI, null, 2)}`,
        { userRole: 'admin' }
      );
      recommendations = aiResponse.split('\n').filter((line: string) => line.trim());
    } catch {
      recommendations = [
        '💡 راجع الخانات الفاضية في القضايا والطلبات',
        '💡 تابع القضايا المعلقة في مرحلة "تحت المراجعة"',
        '💡 فعّل التنبيهات التلقائية للجلسات القادمة',
      ];
    }

    const summary = `النظام يحتوي على ${totalCases} قضية، ${totalRequests} طلب، ${totalPayments} دفعة، و${totalUsers} مستخدم. ${emptyFieldsReport.length} مستند يحتوي خانات فاضية، و${workflowBottlenecks.length} اختناق في سير العمل.`;

    return {
      totalCases,
      totalRequests,
      totalPayments,
      totalUsers,
      emptyFieldsReport,
      workflowBottlenecks,
      recommendations,
      summary,
    };
  } catch (error: any) {
    console.error('[AI Agent] Full analysis error:', error);
    throw new Error(`فشل في تحليل النظام: ${error.message}`);
  }
}

// ============================================================
// Telegram Notification Service
// ============================================================

export async function generateTelegramReport(analysis: DataAnalysisResult): Promise<string> {
  let report = `📊 <b>تقرير وكيل JPF الذكي</b>\n\n`;
  
  report += `📈 <b>إحصائيات عامة:</b>\n`;
  report += `• القضايا: ${analysis.totalCases}\n`;
  report += `• الطلبات: ${analysis.totalRequests}\n`;
  report += `• المدفوعات: ${analysis.totalPayments}\n`;
  report += `• المستخدمين: ${analysis.totalUsers}\n\n`;

  if (analysis.emptyFieldsReport.length > 0) {
    const critical = analysis.emptyFieldsReport.filter(r => r.severity === 'critical');
    const warnings = analysis.emptyFieldsReport.filter(r => r.severity === 'warning');
    
    report += `🔴 <b>خانات فاضية حرجة:</b> ${critical.length}\n`;
    report += `🟡 <b>خانات فاضية تحذيرية:</b> ${warnings.length}\n\n`;
  }

  if (analysis.workflowBottlenecks.length > 0) {
    report += `⚠️ <b>اختناقات سير العمل:</b>\n`;
    for (const b of analysis.workflowBottlenecks) {
      report += `• ${b.stage}: ${b.count} قضية\n`;
    }
    report += `\n`;
  }

  if (analysis.recommendations.length > 0) {
    report += `💡 <b>توصيات الوكيل:</b>\n`;
    for (const rec of analysis.recommendations.slice(0, 5)) {
      report += `${rec}\n`;
    }
  }

  report += `\n🔗 <a href="https://jpf-hr.vercel.app">فتح المنصة</a>`;
  
  return report;
}