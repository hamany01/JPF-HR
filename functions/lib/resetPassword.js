"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetUserPassword = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
if (admin.apps.length === 0) {
    admin.initializeApp();
}
exports.resetUserPassword = functions
    .region('us-central1')
    .https.onCall(async (data, context) => {
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
        if (!userId || !newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
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
    }
    catch (error) {
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error?.message || 'خطأ غير متوقع');
    }
});
//# sourceMappingURL=resetPassword.js.map