/**
 * سكربت تأسيس صلاحيات الأدوار المتقدمة في فورتشير (roles_permissions)
 * Seeding Script for Role-Based Access Control in Firestore
 * 
 * المسار: scripts/seed_roles_permissions.ts
 * لتشغيل السكربت: npx tsx scripts/seed_roles_permissions.ts
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// 1. التحقق من وجود ملف حساب الخدمة لـ Firebase Admin
const serviceAccountPath = path.resolve(process.cwd(), 'service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ خطأ: ملف service-account.json غير موجود في المجلد الرئيسي.');
  console.log('يرجى تحميل مفتاح الخدمة من وحدة تحكم Firebase (Settings > Service Accounts) وحفظه باسم service-account.json لتشغيل هذا السكربت.');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

// 2. تهيئة Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 3. الصلاحيات الافتراضية للأدوار المحددة للنظام
const DEFAULT_PERMISSIONS = {
  admin: {
    label: 'المدير العام (مسؤول النظام)',
    fields: {
      serialNumber: 'full',
      clientName: 'full',
      nationalId: 'full',
      financialAmounts: 'full',
      attachments: 'full',
      sessionsInfo: 'full'
    },
    actions: {
      createRequest: true,
      editRequest: true,
      deleteRequest: true,
      addNote: true,
      deleteNote: true
    }
  },
  law_manager: {
    label: 'المحامي العام (مدير الشؤون القانونية)',
    fields: {
      serialNumber: 'full',
      clientName: 'full',
      nationalId: 'full',
      financialAmounts: 'full',
      attachments: 'full',
      sessionsInfo: 'full'
    },
    actions: {
      createRequest: true,
      editRequest: true,
      deleteRequest: false,
      addNote: true,
      deleteNote: true
    }
  },
  law_assistant: {
    label: 'مساعد الشؤون القانونية',
    fields: {
      serialNumber: 'full',
      clientName: 'full',
      nationalId: 'masked',
      financialAmounts: 'full',
      attachments: 'full',
      sessionsInfo: 'full'
    },
    actions: {
      createRequest: true,
      editRequest: true,
      deleteRequest: false,
      addNote: true,
      deleteNote: false
    }
  },
  company_manager: {
    label: 'مدير الشركة (صاحب العمل)',
    fields: {
      serialNumber: 'full',
      clientName: 'full',
      nationalId: 'full',
      financialAmounts: 'full',
      attachments: 'full',
      sessionsInfo: 'full'
    },
    actions: {
      createRequest: true,
      editRequest: true,
      deleteRequest: false,
      addNote: true,
      deleteNote: true
    }
  },
  company_assistant: {
    label: 'مساعد الشركة',
    fields: {
      serialNumber: 'full',
      clientName: 'full',
      nationalId: 'masked',
      financialAmounts: 'full',
      attachments: 'full',
      sessionsInfo: 'full'
    },
    actions: {
      createRequest: true,
      editRequest: true,
      deleteRequest: false,
      addNote: true,
      deleteNote: false
    }
  },
  employee: {
    label: 'موظف (صلاحيات محدودة)',
    fields: {
      serialNumber: 'full',
      clientName: 'full',
      nationalId: 'masked',
      financialAmounts: 'hidden',
      attachments: 'full',
      sessionsInfo: 'full'
    },
    actions: {
      createRequest: false,
      editRequest: false,
      deleteRequest: false,
      addNote: true,
      deleteNote: false
    }
  }
};

async function seedPermissions() {
  console.log('⏳ جاري تهيئة صلاحيات الأدوار المخصصة في Firestore...');
  const collectionRef = db.collection('roles_permissions');

  try {
    for (const [role, data] of Object.entries(DEFAULT_PERMISSIONS)) {
      console.log(`- تهيئة صلاحيات الدور: ${role}...`);
      await collectionRef.doc(role).set({
        ...data,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
    console.log('✅ تم إعداد جميع صلاحيات الأدوار الافتراضية بنجاح في قاعدة البيانات!');
  } catch (error) {
    console.error('❌ خطأ أثناء رفع الصلاحيات لـ Firestore:', error);
  } finally {
    process.exit(0);
  }
}

seedPermissions();
