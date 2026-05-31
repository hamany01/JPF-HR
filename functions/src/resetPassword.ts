import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
  admin.initializeApp();
}

export const resetUserPassword = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'غير مصرح');
  }

  const requesterUid = context.auth.uid;
  const db = admin.firestore();

  try {
    const requesterDoc = await db.collection('users').doc(requesterUid).get();
    const requesterData = requesterDoc.data();

    if (!requesterDoc.exists || !requesterData || requesterData.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'أدمن فقط');
    }

    const { userId, newPassword } = data;

    if (!userId || !newPassword || newPassword.length < 6) {
      throw new functions.https.HttpsError('invalid-argument', 'بيانات غير صحيحة');
    }

    const targetUserDoc = await db.collection('users').doc(userId).get();
    if (!targetUserDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'مستخدم غير موجود');
    }
    const targetUserData = targetUserDoc.data() || {};

    await admin.auth().updateUser(userId, {
      password: newPassword
    });

    await db.collection('audit_logs').add({
      action: 'password_reset',
      performedBy: requesterUid,
      performedByName: requesterData.name || 'مدير',
      targetUser: userId,
      targetUserName: targetUserData.name || targetUserData.email || 'موظف',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      ipAddress: context.rawRequest ? (context.rawRequest.headers['x-forwarded-for'] || context.rawRequest.socket.remoteAddress || '') : '',
      userAgent: context.rawRequest ? (context.rawRequest.headers['user-agent'] || '') : ''
    });

    return { 
      success: true, 
      message: 'تم التحديث بنجاح' 
    };

  } catch (error: any) {
    console.error('Error:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', error.message || 'خطأ داخلي');
  }
});
