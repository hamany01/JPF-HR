/**
 * نظام JPF-HR - دالة إعادة تعيين كلمة المرور (Cloud Function)
 * 
 * المسار: /functions/src/resetPassword.ts
 * 
 * دالة HTTPS Callable آمنة يتم استدعاؤها من جهة العميل (React App) من قبل المدراء فقط،
 * لتقوم بتحديث كلمة مرور الموظف في نظام Firebase Authentication وتسجيل العملية في سجل التدقيق (Audit Logs).
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// تهيئة Firebase Admin إذا لم يتم تهيئته مسبقاً
if (admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * دالة resetUserPassword لإعادة توليد كلمة المرور للمستخدمين
 * Callable Function (onCall)
 */
export const resetUserPassword = functions.https.onCall(async (data, context) => {
  // 1. التحقق من المصادقة (أن المستخدم مسجل الدخول)
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'يجب تسجيل الدخول أولاً لإجراء هذه العملية.'
    );
  }

  const requesterUid = context.auth.uid;
  const db = admin.firestore();

  try {
    // 2. التحقق من صلاحيات المستخدم الطلب (يجب أن يكون admin في قاعدة البيانات)
    const requesterDoc = await db.collection('users').doc(requesterUid).get();
    const requesterData = requesterDoc.data();

    if (!requesterDoc.exists || !requesterData || requesterData.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'عذراً، هذه الصلاحية مخصصة لمدير النظام (الأدمن) فقط.'
      );
    }

    const { userId, newPassword } = data;

    // 3. التحقق من صحة المعطيات المرسلة
    if (!userId || !newPassword || newPassword.length < 6) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'المعطيات المرسلة غير كاملة أو كلمة المرور قصيرة جداً (أقل من 6 أحرف).'
      );
    }

    // 4. جلب بيانات الموظف المستهدف قبل التغيير (للتوثيق في السجل)
    const targetUserDoc = await db.collection('users').doc(userId).get();
    if (!targetUserDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'لم يتم العثور على الموظف المطلوب في قاعدة البيانات.'
      );
    }
    const targetUserData = targetUserDoc.data() || {};

    // 5. استخدام Firebase Auth Admin SDK لتحديث كلمة المرور
    await admin.auth().updateUser(userId, {
      password: newPassword
    });

    // 6. تسجيل العملية في سجل التدقيق والأمان (Audit Logs) لضمان الشفافية
    await db.collection('audit_logs').add({
      action: 'password_reset',
      performedBy: requesterUid,
      performedByName: requesterData.name || 'مدير النظام',
      targetUser: userId,
      targetUserName: targetUserData.name || targetUserData.email || 'موظف',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      ipAddress: context.rawRequest ? (context.rawRequest.headers['x-forwarded-for'] || context.rawRequest.socket.remoteAddress || '') : '',
      userAgent: context.rawRequest ? (context.rawRequest.headers['user-agent'] || '') : ''
    });

    return { 
      success: true, 
      message: 'تم تحديث كلمة المرور وتسجيل الحركة بنجاح.' 
    };

  } catch (error: any) {
    console.error('Error during password reset Cloud Function:', error);
    
    // إذا كان الخطأ مسبقاً من نوع HttpsError، نقوم بإعادة تمريره مباشرة
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      error.message || 'حدث خطأ داخلي في الخادم أثناء تحديث كلمة المرور.'
    );
  }
});
