import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

// Catch all unhandled rejections and exceptions to print them clearly in logs
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 Severe Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err, origin) => {
  console.error('🔥 Severe Uncaught Exception:', err, 'at origin:', origin);
});

const app = express();
const PORT = 3000;

app.use(express.json());

// API health endpoint
app.get('/api/health', (req, res) => {
  console.log('💚 Health check pinged');
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Lazy loader for Firebase Admin and Firestore to prevent startup blocks/crashes
let adminApp: any = null;
let firestoreDb: any = null;
let adminInstance: any = null;

async function getFirebaseAdmin() {
  if (!adminApp) {
    console.log('🔄 Lazily initializing Firebase Admin...');
    try {
      // Lazy imports to avoid initialization overhead on parse
      const admin = await import('firebase-admin');
      const { getFirestore } = await import('firebase-admin/firestore');
      
      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (!fs.existsSync(configPath)) {
        throw new Error(`Config file not found at matching absolute/relative path: ${configPath}`);
      }
      
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      console.log('💾 Loaded Firebase Config for Project:', firebaseConfig.projectId);
      console.log('💾 Firestore custom Database ID Target:', firebaseConfig.firestoreDatabaseId);

      // Initialize Firebase Admin SAFELY
      adminApp = admin.apps.length === 0 
        ? admin.initializeApp({ projectId: firebaseConfig.projectId })
        : admin.apps[0]!;

      firestoreDb = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
      adminInstance = admin;
      console.log('✅ Firebase Admin & Firestore database initialized!');
    } catch (firebaseErr: any) {
      console.error('❌ Failed to initialize Firebase Admin client:', firebaseErr);
      throw firebaseErr;
    }
  }
  return { admin: adminInstance, db: firestoreDb };
}

// API endpoint for password reset
app.post('/api/resetUserPassword', async (req, res) => {
  console.log('☁️ Received reset password request on local Express API');
  
  try {
    const { admin, db } = await getFirebaseAdmin();
    
    // 1. Verify Authorization Bearer token (JWT ID Token)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('❌ Unauthorized: Missing or invalid authorization header');
      return res.status(401).json({ success: false, message: 'غير مصرح: يجب تسجيل الدخول' });
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      console.warn('❌ Unauthorized: Token path is empty');
      return res.status(401).json({ success: false, message: 'غير مصرح: توكن غير صالح' });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    const requesterUid = decodedToken.uid;
    console.log(`👤 Request made by UID: ${requesterUid}`);

    // 2. Validate admin permission
    const requesterDoc = await db.collection('users').doc(requesterUid).get();
    if (!requesterDoc.exists || requesterDoc.data()?.role !== 'admin') {
      console.warn(`❌ Forbidden: Requester ${requesterUid} is not an admin`);
      return res.status(403).json({ success: false, message: 'مخصص للمدراء فقط' });
    }

    // 3. Extract and validate parameters
    const { userId, newPassword } = req.body || {};
    if (!userId || !newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      console.warn('❌ Bad Request: Invalid arguments provided');
      return res.status(400).json({ success: false, message: 'بيانات غير صحيحة' });
    }

    // 4. Update password
    console.log(`🔑 Resetting password for user UID: ${userId}`);
    await admin.auth().updateUser(userId, { password: newPassword });
    console.log('✅ Auth password updated successfully in Firebase Auth');

    // 5. Save audit log
    await db.collection('audit_logs').add({
      action: 'password_reset',
      performedBy: requesterUid,
      targetUser: userId,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('📝 Audit log saved successfully to Firestore');

    return res.status(200).json({ success: true, message: 'تم التحديث بنجاح' });

  } catch (error: any) {
    console.error('❌ Error in /api/resetUserPassword handler:', error);
    return res.status(500).json({ 
      success: false, 
      message: error.message || 'حدث خطأ داخلي في الخادم' 
    });
  }
});

// Helper: Common Auth & Role resolution middleware/function
async function checkAuthAndGetRole(req: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw { status: 401, message: 'غير مصرح: يرجى تسجيل الدخول' };
  }

  const token = authHeader.split('Bearer ')[1];
  if (!token) {
    throw { status: 401, message: 'غير مصرح: التوكن فارغ' };
  }

  try {
    const { admin, db } = await getFirebaseAdmin();
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      throw { status: 403, message: 'المستخدم غير موجود بالنظام' };
    }

    const userData = userDoc.data();
    if (!userData.isActive) {
      throw { status: 403, message: 'هذا الحساب غير نشط حالياً' };
    }

    return { uid, role: userData.role || 'sales_employee', userData };
  } catch (err: any) {
    if (err.status) throw err;
    console.error('JWT Token verification error:', err);
    throw { status: 401, message: 'توكن غير صالح أو منتهي الصلاحية' };
  }
}

// GET /api/cases: List cases with role-based visibility filtering
app.get('/api/cases', async (req, res) => {
  try {
    const { uid, role, userData } = await checkAuthAndGetRole(req);
    const { db } = await getFirebaseAdmin();

    let queryRef: any = db.collection('cases');

    // Filter soft-deleted docs at query level if possible
    if (role !== 'admin') {
      queryRef = queryRef.where('isDeleted', '!=', true);
    }

    const snapshot = await queryRef.get();
    let cases = snapshot.docs.map((doc: any) => ({ id: doc.id, caseId: doc.id, ...doc.data() }));

    // Apply role scopes
    if (role === 'admin' || role === 'company_manager' || role === 'assistant_manager') {
      // Allowed fully
    } else if (role === 'sales_employee') {
      cases = cases.filter((c: any) => c.salesEmployeeId === uid);
    } else if (role === 'law_firm_manager') {
      const pLawFirmId = userData.lawFirmId || '';
      cases = cases.filter((c: any) => c.lawFirmId === pLawFirmId);
    } else if (role === 'law_firm_assistant') {
      cases = cases.filter((c: any) => c.assignedAssistantId === uid);
    } else {
      cases = [];
    }

    // Force strict memory filtering for extra security
    if (role !== 'admin') {
      cases = cases.filter((c: any) => c.isDeleted !== true);
    }

    return res.json({ success: true, count: cases.length, data: cases });
  } catch (error: any) {
    console.error('Error in GET /api/cases:', error);
    return res.status(error.status || 500).json({ success: false, message: error.message || 'حدث خطأ في تحميل القضايا' });
  }
});

// GET /api/cases/:id: Get full details of a specific case with authorization check
app.get('/api/cases/:id', async (req, res) => {
  try {
    const { uid, role, userData } = await checkAuthAndGetRole(req);
    const { db } = await getFirebaseAdmin();
    const caseId = req.params.id;

    const caseDoc = await db.collection('cases').doc(caseId).get();
    if (!caseDoc.exists) {
      return res.status(404).json({ success: false, message: 'القضية المطلوبة غير موجودة' });
    }

    const caseData = caseDoc.data();

    // Soft delete check
    if (caseData.isDeleted === true && role !== 'admin') {
      return res.status(403).json({ success: false, message: 'غير مصرح بعرض هذه القضية المؤرشفة' });
    }

    // Role eligibility check
    let authorized = false;
    if (role === 'admin' || role === 'company_manager' || role === 'assistant_manager') {
      authorized = true;
    } else if (role === 'sales_employee') {
      authorized = caseData.salesEmployeeId === uid;
    } else if (role === 'law_firm_manager') {
      authorized = userData.lawFirmId && caseData.lawFirmId === userData.lawFirmId;
    } else if (role === 'law_firm_assistant') {
      authorized = caseData.assignedAssistantId === uid;
    }

    if (!authorized) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية للاطلاع على هذه القضية' });
    }

    return res.json({ success: true, data: { id: caseDoc.id, caseId: caseDoc.id, ...caseData } });
  } catch (error: any) {
    console.error('Error in GET /api/cases/:id:', error);
    return res.status(error.status || 500).json({ success: false, message: error.message || 'حدث خطأ في عرض القضية' });
  }
});

// POST /api/cases: Create a new case (Allowed: admin, company_manager, assistant_manager)
app.post('/api/cases', async (req, res) => {
  try {
    const { uid, role } = await checkAuthAndGetRole(req);
    const { db, admin } = await getFirebaseAdmin();

    if (role !== 'admin' && role !== 'company_manager' && role !== 'assistant_manager') {
      return res.status(403).json({ success: false, message: 'عذراً، الصلاحيات الحالية لا تسمح لك بإنشاء قضية جديدة' });
    }

    const { clientName, clientId, amountClaimed, status, assignmentType, lawFirmId, assignedAssistantId, salesEmployeeId } = req.body || {};

    if (!clientName || amountClaimed === undefined) {
      return res.status(400).json({ success: false, message: 'الرجاء توفير البيانات المطلوبة: اسم العميل ومبلغ الادعاء' });
    }

    const newCase = {
      clientName,
      clientId: clientId || null,
      amountClaimed: Number(amountClaimed) || 0,
      status: status || 'draft',
      assignmentType: assignmentType || 'internal',
      lawFirmId: lawFirmId || null,
      assignedAssistantId: assignedAssistantId || null,
      salesEmployeeId: salesEmployeeId || null,
      createdBy: uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      isDeleted: false
    };

    const docRef = await db.collection('cases').add(newCase);
    return res.status(201).json({ success: true, caseId: docRef.id, data: { ...newCase, id: docRef.id } });
  } catch (error: any) {
    console.error('Error in POST /api/cases:', error);
    return res.status(error.status || 500).json({ success: false, message: error.message || 'حدث خطأ أثناء حفظ القضية' });
  }
});

// PATCH /api/cases/:id: Update an existing case
app.patch('/api/cases/:id', async (req, res) => {
  try {
    const { uid, role, userData } = await checkAuthAndGetRole(req);
    const { db, admin } = await getFirebaseAdmin();
    const caseId = req.params.id;

    const caseDoc = await db.collection('cases').doc(caseId).get();
    if (!caseDoc.exists) {
      return res.status(404).json({ success: false, message: 'القضية المطلوبة غير موجودة' });
    }

    const caseData = caseDoc.data();

    if (caseData.isDeleted === true && role !== 'admin') {
      return res.status(403).json({ success: false, message: 'لا يمكن تعديل قضية محذوفة' });
    }

    // Role checks
    let canEdit = false;
    if (role === 'admin' || role === 'company_manager' || role === 'assistant_manager') {
      canEdit = true;
    } else if (role === 'law_firm_manager') {
      canEdit = !!(userData.lawFirmId && caseData.lawFirmId === userData.lawFirmId);
    } else if (role === 'law_firm_assistant') {
      canEdit = caseData.assignedAssistantId === uid;
    }

    if (!canEdit) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية لتعديل هذه القضية' });
    }

    const updates: any = {};
    const body = req.body || {};

    // Managers/Admins can modify any non-immutable field
    if (role === 'admin' || role === 'company_manager' || role === 'assistant_manager') {
      if (body.clientName !== undefined) updates.clientName = body.clientName;
      if (body.clientId !== undefined) updates.clientId = body.clientId;
      if (body.amountClaimed !== undefined) updates.amountClaimed = Number(body.amountClaimed) || 0;
      if (body.status !== undefined) updates.status = body.status;
      if (body.assignmentType !== undefined) updates.assignmentType = body.assignmentType;
      if (body.lawFirmId !== undefined) updates.lawFirmId = body.lawFirmId;
      if (body.assignedAssistantId !== undefined) updates.assignedAssistantId = body.assignedAssistantId;
      if (body.salesEmployeeId !== undefined) updates.salesEmployeeId = body.salesEmployeeId;
      if (body.isDeleted !== undefined) updates.isDeleted = !!body.isDeleted;
    } 
    // Lawyers can only update status
    else if (role === 'law_firm_manager' || role === 'law_firm_assistant') {
      if (body.status !== undefined) updates.status = body.status;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'لم يتم توفير أي تعديلات صالحة' });
    }

    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await db.collection('cases').doc(caseId).update(updates);
    return res.json({ success: true, message: 'تم تحديث القضية بنجاح' });
  } catch (error: any) {
    console.error('Error in PATCH /api/cases/:id:', error);
    return res.status(error.status || 500).json({ success: false, message: error.message || 'حدث خطأ أثناء تعديل القضية' });
  }
});

// PATCH /api/cases/:id/status: Change case status based on strict state machine
app.patch('/api/cases/:id/status', async (req, res) => {
  try {
    const { uid, role, userData } = await checkAuthAndGetRole(req);
    const { db, admin } = await getFirebaseAdmin();
    const caseId = req.params.id;
    const { status: targetStatus } = req.body || {};

    if (!targetStatus) {
      return res.status(400).json({ success: false, message: 'مطلوب توفير الحالة المستهدفة' });
    }

    const caseDoc = await db.collection('cases').doc(caseId).get();
    if (!caseDoc.exists) {
      return res.status(404).json({ success: false, message: 'القضية المطلوبة غير موجودة' });
    }

    const caseData = caseDoc.data();
    if (caseData.isDeleted === true) {
      return res.status(400).json({ success: false, message: 'لا يمكن تعديل قضية محذوفة' });
    }

    const currentStatus = caseData.status || 'draft';

    // Verify Role Permission
    // Managers/Admins can do any transition.
    // Law firm managers can transition from external_assigned to in_court.
    let authorizedForTransition = false;
    if (role === 'admin' || role === 'company_manager' || role === 'assistant_manager') {
      authorizedForTransition = true;
    } else if (role === 'law_firm_manager') {
      if (currentStatus === 'external_assigned' && targetStatus === 'in_court') {
        const pLawFirmId = userData.lawFirmId || '';
        if (caseData.lawFirmId && caseData.lawFirmId === pLawFirmId) {
          authorizedForTransition = true;
        }
      }
    }

    if (!authorizedForTransition) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية لإجراء هذا الانتقال للحالة' });
    }

    // State Machine transitions:
    // draft -> under_review
    // under_review -> internal OR external_assigned
    // internal OR external_assigned -> in_court
    // in_court -> closed
    // Allow admin to bypass transition validation if forced, but enforce standard flow for normal users:
    if (role !== 'admin') {
      let isValidTransition = false;
      if (currentStatus === 'draft' && targetStatus === 'under_review') isValidTransition = true;
      if (currentStatus === 'under_review' && (targetStatus === 'internal' || targetStatus === 'external_assigned')) isValidTransition = true;
      if ((currentStatus === 'internal' || currentStatus === 'external_assigned') && targetStatus === 'in_court') isValidTransition = true;
      if (currentStatus === 'in_court' && targetStatus === 'closed') isValidTransition = true;

      // Allow staying in same status
      if (currentStatus === targetStatus) isValidTransition = true;

      if (!isValidTransition) {
        return res.status(400).json({ 
          success: false, 
          message: `انتقال غير مسموح به من حالة (${currentStatus}) إلى حالة (${targetStatus}). تسلسل المراحل: مسودة ← تحت المراجعة ← داخلية/إسناد خارجي ← بالمحكمة ← مغلقة` 
        });
      }
    }

    // 2.2 Validation rules:
    // - Cannot move to external_assigned without lawFirmId
    if (targetStatus === 'external_assigned') {
      const lawFirmId = req.body.lawFirmId || caseData.lawFirmId;
      if (!lawFirmId) {
        return res.status(400).json({ success: false, message: 'لا يمكن تحويل القضية لجهات خارجية دون تحديد مكتب المحاماة الشريك' });
      }
    }

    // - Cannot move to in_court unless there is at least one session scheduled
    if (targetStatus === 'in_court') {
      // Check sessions in subcollection /cases/:id/sessions or global /case_sessions where caseId == id
      const globalSessions = await db.collection('case_sessions').where('caseId', '==', caseId).get();
      const subSessions = await db.collection('cases').doc(caseId).collection('sessions').get();
      const totalSessionsCount = globalSessions.size + subSessions.size;

      if (totalSessionsCount === 0) {
        return res.status(400).json({ success: false, message: 'لا يمكن نقل القضية للمحكمة إلا بعد تسجيل موعد جلسة واحدة على الأقل' });
      }
    }

    // - Cannot move to closed unless financials are resolved (validation stub)
    if (targetStatus === 'closed') {
      // Under Phase 2: Check if there are payment plans that are not 'paid' or 'partially_paid' (or we check unpaid status 'planned' or 'on_hold')
      const plansSnapshot = await db.collection('payment_plans')
        .where('caseId', '==', caseId)
        .where('isDeleted', '==', false)
        .get();
        
      let hasUnpaidInstallments = false;
      plansSnapshot.forEach((doc: any) => {
        const plan = doc.data();
        if (plan.status !== 'paid' && plan.status !== 'partially_paid') {
          hasUnpaidInstallments = true;
        }
      });

      if (hasUnpaidInstallments) {
        return res.status(400).json({ 
          success: false, 
          message: 'تنبيه مالي: لا يمكن إغلاق القضية قبل تحصيل أو تسوية الأقساط المجدولة والمعلقة في خطة الدفع' 
        });
      }
    }

    const updates: any = {
      status: targetStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // If migrating to external and fields are supplied
    if (req.body.lawFirmId !== undefined) updates.lawFirmId = req.body.lawFirmId;
    if (req.body.assignedAssistantId !== undefined) updates.assignedAssistantId = req.body.assignedAssistantId;
    if (req.body.assignmentType !== undefined) updates.assignmentType = req.body.assignmentType;

    await db.collection('cases').doc(caseId).update(updates);

    // Create system log / activity event for status change
    await db.collection('appEvents').add({
      type: 'case_status_changed',
      caseId,
      oldStatus: currentStatus,
      newStatus: targetStatus,
      performedBy: uid,
      performedByName: userData.fullName || userData.name || '',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.json({ success: true, message: 'تم تحديث حالة القضية بنجاح' });
  } catch (error: any) {
    console.error('Error in PATCH /api/cases/:id/status:', error);
    return res.status(error.status || 500).json({ success: false, message: error.message || 'حدث خطأ في تغيير ميكانيكية حالة القضية' });
  }
});

// GET /api/cases/:id/payment-plans: Fetch scheduled payment installments for a specific case
app.get('/api/cases/:id/payment-plans', async (req, res) => {
  try {
    const { uid, role, userData } = await checkAuthAndGetRole(req);
    const { db } = await getFirebaseAdmin();
    const caseId = req.params.id;

    // First ensure user is authorized to read the case
    const caseDoc = await db.collection('cases').doc(caseId).get();
    if (!caseDoc.exists) {
      return res.status(404).json({ success: false, message: 'القضية المطلوبة غير موجودة' });
    }

    const caseData = caseDoc.data();
    if (caseData.isDeleted === true && role !== 'admin') {
      return res.status(403).json({ success: false, message: 'غير مصرح بعرض ممتلكات قضية مؤرشفة' });
    }

    let authorized = false;
    if (role === 'admin' || role === 'company_manager' || role === 'assistant_manager') {
      authorized = true;
    } else if (role === 'sales_employee') {
      authorized = caseData.salesEmployeeId === uid;
    } else if (role === 'law_firm_manager') {
      authorized = !!(userData.lawFirmId && caseData.lawFirmId === userData.lawFirmId);
    } else if (role === 'law_firm_assistant') {
      authorized = caseData.assignedAssistantId === uid;
    }

    if (!authorized) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية لعرض دفعات هذه القضية' });
    }

    const plansSnapshot = await db.collection('payment_plans')
      .where('caseId', '==', caseId)
      .get();

    let plans = plansSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    }));

    // Filter soft deleted plans
    plans = plans.filter((p: any) => p.isDeleted !== true);

    // Sort by dueDate
    plans.sort((a, b) => {
      const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      return dateA - dateB;
    });

    return res.json({ success: true, data: plans });
  } catch (error: any) {
    console.error('Error fetching payment-plans:', error);
    return res.status(error.status || 500).json({ success: false, message: error.message || 'فشل في استرداد جدول الدفعات' });
  }
});

// POST /api/cases/:id/payment-plans: Create a new manual payment plan (Allowed: manager roles)
app.post('/api/cases/:id/payment-plans', async (req, res) => {
  try {
    const { uid, role } = await checkAuthAndGetRole(req);
    const { db, admin } = await getFirebaseAdmin();
    const caseId = req.params.id;

    if (role !== 'admin' && role !== 'company_manager' && role !== 'assistant_manager') {
      return res.status(403).json({ success: false, message: 'غير مصرح لك بإضافة أو تعديل خطط الدفع والتحصيل' });
    }

    const { installmentAmount, dueDate, notes } = req.body || {};

    if (!installmentAmount || isNaN(Number(installmentAmount)) || Number(installmentAmount) <= 0) {
      return res.status(400).json({ success: false, message: 'الرجاء تحديد مبلغ قسط صالح أكبر من الصفر' });
    }

    if (!dueDate) {
      return res.status(400).json({ success: false, message: 'الرجاء توفير تاريخ استحقاق صالح (YYYY-MM-DD)' });
    }

    const newPlan = {
      caseId,
      installmentAmount: Number(installmentAmount),
      dueDate,
      status: 'planned',
      paidAmount: 0,
      paidAt: null,
      notes: notes || '',
      isDeleted: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('payment_plans').add(newPlan);
    return res.status(201).json({ success: true, planId: docRef.id, data: { id: docRef.id, ...newPlan } });
  } catch (error: any) {
    console.error('Error in POST payment-plans:', error);
    return res.status(error.status || 500).json({ success: false, message: error.message || 'فشل إضافة قسط جديد' });
  }
});

// PATCH /api/payment-plans/:id: Update payment status and amount (Allowed: manager roles)
app.patch('/api/payment-plans/:id', async (req, res) => {
  try {
    const { uid, role } = await checkAuthAndGetRole(req);
    const { db, admin } = await getFirebaseAdmin();
    const planId = req.params.id;

    if (role !== 'admin' && role !== 'company_manager' && role !== 'assistant_manager') {
      return res.status(403).json({ success: false, message: 'غير مصرح لك بإضافة أو تعديل الدفعات والتحصيل' });
    }

    const planDoc = await db.collection('payment_plans').doc(planId).get();
    if (!planDoc.exists) {
      return res.status(404).json({ success: false, message: 'القسط المستهدف غير موجود' });
    }

    const planData = planDoc.data();
    if (planData.isDeleted === true) {
      return res.status(400).json({ success: false, message: 'لا يمكن تعديل قسط محذوف' });
    }

    const { status, paidAmount, notes } = req.body || {};

    const updates: any = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (status !== undefined) {
      updates.status = status;
      if (status === 'paid') {
        const fullAmount = Number(paidAmount) !== undefined && paidAmount !== null && !isNaN(Number(paidAmount)) 
          ? Number(paidAmount) 
          : planData.installmentAmount;
        updates.paidAmount = fullAmount;
        updates.paidAt = admin.firestore.FieldValue.serverTimestamp();
      } else if (status === 'partially_paid') {
        updates.paidAmount = Number(paidAmount) || 0;
        updates.paidAt = admin.firestore.FieldValue.serverTimestamp();
      } else if (status === 'planned' || status === 'on_hold') {
        updates.paidAmount = 0;
        updates.paidAt = null;
      }
    } else {
      if (paidAmount !== undefined) {
        updates.paidAmount = Number(paidAmount) || 0;
      }
    }

    if (notes !== undefined) {
      updates.notes = notes;
    }

    await db.collection('payment_plans').doc(planId).update(updates);
    return res.json({ success: true, message: 'تم تحديث القسط بنجاح' });
  } catch (error: any) {
    console.error('Error updating payment-plan:', error);
    return res.status(error.status || 500).json({ success: false, message: error.message || 'فشل تحديث معلومات الدفع' });
  }
});


// Vite middleware flow
async function startServer() {
  console.log('🔄 Starting full-stack server setup...');
  try {
    if (process.env.NODE_ENV !== "production") {
      console.log('🛠️ Creating Vite server in middleware mode...');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log('✅ Vite middleware applied successfully.');
    } else {
      console.log('📦 Serving production static built files...');
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server successfully listening at http://localhost:${PORT}`);
    });
  } catch (startupErr: any) {
    console.error('🔥 Server startup failed catastrophically:', startupErr);
  }
}

startServer();
