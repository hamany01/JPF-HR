/**
 * جيه بي إف - سكربت استيراد القضايا التنفيذية من CSV إلى Firestore
 * JPF-HR Execution Cases Import Script
 * 
 * المجلد: scripts/import_cases.ts
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import csv from 'csv-parser';
import path from 'path';

// 1. إعداد Firebase Admin
// يجب توفير ملف service-account.json في المجلد الرئيسي
const serviceAccountPath = path.resolve(process.cwd(), 'service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ خطا: ملف service-account.json غير موجود في المجلد الرئيسي.');
  console.log('يرجى تحميل ملف المفتاح من Firebase Console > Project Settings > Service Accounts');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 2. إعدادات الملف
const csvFilePath = path.resolve(process.cwd(), 'cases.csv');

if (!fs.existsSync(csvFilePath)) {
  console.error('❌ خطا: ملف cases.csv غير موجود.');
  console.log('يرجى التأكد من وجود ملف CSV باسم cases.csv في المجلد الرئيسي.');
  process.exit(1);
}

// 3. دالة معالجة البيانات
const processImport = async () => {
  console.log('🚀 بدء استيراد البيانات...');
  
  const cases: any[] = [];
  
  // قراءة الملف
  fs.createReadStream(csvFilePath)
    .pipe(csv())
    .on('data', (row) => {
      // تنظيف وتحويل الحقول بناءً على طلب المستخدم
      const defendantName = row['اسم المنفذ ضده'] || '';
      const rawClaimAmount = row['قيمة المطالبة'] || '0';
      const requestNumber = row['رقم القضية التنفيذية'] || '';
      const cityCircle = row['المدينة/ الدائرة'] || '';
      const rawDecision = row['سير الإجراء التنفيذي الذي تم ضد المنفذ ضده'] || '';
      const rawStatus = row['حالة الطلب'] || '';
      const notes = row['الملاحظات'] || '';

      // معالجة المبلغ (إزالة الفواصل والرموز)
      const claimAmount = parseFloat(rawClaimAmount.replace(/[^0-9.]/g, '')) || 0;

      // منطق وضع القرار
      let decisionCode = '';
      let decisionLabel = 'لا يوجد';
      let executionProgress = '';

      if (rawDecision.includes('34') && rawDecision.includes('46')) {
        decisionCode = '34+46';
        decisionLabel = 'قرار 34 + 46';
      } else if (rawDecision.includes('34')) {
        decisionCode = '34';
        decisionLabel = 'قرار 34';
      } else if (rawDecision.includes('46')) {
        decisionCode = '46';
        decisionLabel = 'قرار 46';
      } else if (rawDecision.toLowerCase().includes('under') || rawDecision.includes('تحت')) {
        decisionCode = 'under_execution';
        decisionLabel = 'تحت التنفيذ';
      } else {
        executionProgress = rawDecision;
      }

      // منطق الحالة
      let status = 'open';
      let statusLabel = rawStatus || 'مفتوحة';

      if (rawStatus.includes('قيد التنفيذ')) {
        status = 'in_progress';
        statusLabel = 'قيد التنفيذ';
      } else if (rawStatus.includes('منتهي')) {
        status = 'closed';
        statusLabel = 'منتهي';
      }

      // تجهيز الوثيقة
      const caseDoc = {
        defendantName,
        claimAmount,
        receivedAmount: 0,
        remainingAmount: claimAmount,
        requestNumber,
        cityCircle,
        decisionCode,
        decisionLabel,
        executionProgress,
        status,
        statusLabel,
        notes,
        requestType: 'تنفيذ',
        subType: 'حقوقي', // افتراضي
        platform: 'ناجز', // افتراضي
        legalCapacity: 'فرد',
        nationality: 'سعودي',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (defendantName && requestNumber) {
        cases.push(caseDoc);
      }
    })
    .on('end', async () => {
      console.log(`✅ تم تحليل ${cases.length} قضية. جاري الرفع إلى Firestore...`);
      
      // الرفع عبر Batches (مجموعات من 500)
      const BATCH_SIZE = 500;
      for (let i = 0; i < cases.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const currentBatch = cases.slice(i, i + BATCH_SIZE);
        
        currentBatch.forEach(data => {
          const docRef = db.collection('cases').doc();
          batch.set(docRef, data);
        });
        
        await batch.commit();
        console.log(`📦 تم رفع المجموعة ${Math.floor(i/BATCH_SIZE) + 1} (${currentBatch.length} وثيقة)`);
      }
      
      console.log('✨ اكتمل استيراد كافة البيانات بنجاح!');
      process.exit(0);
    })
    .on('error', (error) => {
      console.error('❌ خطأ أثناء قراءة الملف:', error);
      process.exit(1);
    });
};

processImport();
