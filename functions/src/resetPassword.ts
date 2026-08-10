import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
  admin.initializeApp();
}

export const resetUserPassword = functions
  .region('us-central1')
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'يجب تسجيل الدخول');
    }

    const requesterUid = context.auth.uid;
    const db = admin.firestore();

    try {
      const requesterDoc = await db.collection('users').doc(requesterUid).get();
      if (!requesterDoc.exists || requesterDoc.data()?.role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'مخصص للمدراء فقط');
      }

      const { userId, newPassword } = data || {};

      if (!userId || !newPassword || typeof newPassword !== 'string' || newPassword.length < 12) {
        throw new functions.https.HttpsError('invalid-argument', 'بيانات غير صحيحة');
      }

      const targetUserDoc = await db.collection('users').doc(userId).get();
      if (!targetUserDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'المستخدم غير موجود');
      }

      await admin.auth().updateUser(userId, { password: newPassword });

      await db.collection('audit_logs').add({
        action: 'password_reset',
        performedBy: requesterUid,
        targetUser: userId,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true, message: 'تم التحديث بنجاح' };
    } catch (error: any) {
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError('internal', error?.message || 'خطأ غير متوقع');
    }
  });
