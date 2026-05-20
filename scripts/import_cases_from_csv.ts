import * as admin from 'firebase-admin';
import * as fs from 'fs';
import path from 'path';
import csv from 'csv-parser';

/**
 * JPF-HR Execution Cases Import Script from CSV
 * سكربت استيراد القضايا التنفيذية من ملف CSV
 */

// 1. Firebase Admin Setup
const serviceAccountPath = path.resolve(process.cwd(), 'service-account.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ خطا: ملف service-account.json غير موجود في المجلد الرئيسي.');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

// 2. CSV Configuration
const csvFilePath = path.resolve(process.cwd(), 'cases_clean.csv');
if (!fs.existsSync(csvFilePath)) {
  console.error('❌ خطا: ملف cases_clean.csv غير موجود.');
  process.exit(1);
}

const parseArabicNumber = (val: string): number => {
  if (!val) return 0;
  // Remove commas, symbols and keep digits/dot
  const clean = val.replace(/,/g, '').replace(/[^\d.-]/g, '').trim();
  return parseFloat(clean) || 0;
};

const processImport = async () => {
  console.log('🚀 بدء عملية الاستيراد من CSV...');

  const cases: any[] = [];
  let rowCount = 0;
  let skipCount = 0;

  fs.createReadStream(csvFilePath)
    .pipe(csv({
      mapHeaders: ({ header }) => header.trim().replace(/\s+/g, ' ') // Clean headers
    }))
    .on('data', (row) => {
      rowCount++;
      
      const requestNumber = row['رقم الطلب'];
      const defendantName = row['المنفذ ضده'];

      // Skip invalid rows (empty or only header index)
      if (!requestNumber || !defendantName || defendantName === '' || requestNumber === '') {
        skipCount++;
        return;
      }

      // 1. Amounts Transformation
      const claimAmount = parseArabicNumber(row['مبلغ المطالبة']);
      const receivedAmount = parseArabicNumber(row['المبلغ المستلم']);
      let remainingAmount = 0;
      
      const rawRemaining = row['المبلغ المتبقي'] || '';
      if (rawRemaining.includes('=') || rawRemaining === '') {
        remainingAmount = claimAmount - receivedAmount;
      } else {
        remainingAmount = parseArabicNumber(rawRemaining);
      }

      // 2. Status Mapping
      const rawStatus = row['مراحل الطلب'] || '';
      let status = 'open';
      let statusLabel = rawStatus;

      if (rawStatus.includes('قيد التنفيذ')) {
        status = 'in_progress';
        statusLabel = 'قيد التنفيذ';
      } else if (rawStatus.includes('منتهي')) {
        status = 'closed';
        statusLabel = 'منتهي';
      } else if (rawStatus.includes('إمهال')) {
        status = 'on_hold';
        statusLabel = 'تم الإمهال';
      }

      // 3. Decisions Mapping
      const rawDecision = row['القرارات'] || '';
      let decisionCode = '';
      let decisionLabel = 'لا يوجد';

      if (rawDecision.includes('34') && rawDecision.includes('46')) {
        decisionCode = '34+46';
        decisionLabel = 'قرار 34 + 46';
      } else if (rawDecision.includes('34')) {
        decisionCode = '34';
        decisionLabel = 'قرار 34';
      } else if (rawDecision.includes('46')) {
        decisionCode = '46';
        decisionLabel = 'قرار 46';
      } else if (rawDecision.includes('لا يوجد') || rawDecision === '') {
        decisionCode = '';
        decisionLabel = 'لا يوجد';
      } else {
        decisionCode = 'other';
        decisionLabel = rawDecision;
      }

      // Construct Firestore Document
      const caseDoc = {
        requestType: row['نوع الطلب'] || 'تنفيذ',
        requestNumber: requestNumber,
        fileDateHijri: row['تاريخ الرفع'] || '',
        subType: row['الفرعي'] || '',
        status,
        statusLabel,
        claimAmount,
        receivedAmount,
        remainingAmount,
        applicantName: row['مقدم الطلب'] || '',
        defendantName: defendantName.replace(/\|/g, '-').trim(),
        idType: row['نوع الهوية'] || '',
        legalCapacity: row['الصفة'] || '',
        nationality: row['الجنسية'] || '',
        decisionCode,
        decisionLabel,
        representativeName: row['اسم المندوب'] || '',
        clientNumber: row['رقم العميل'] || '',
        lastWithdrawalUpdate: row['اخر تحديث سحب الأموال في الحسابات'] || '',
        executionProgress: row['سير الإجراء التنفيذي الذي تم ضد المنفذ ضده'] || '',
        platform: 'ناجز', // Default platform
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      cases.push(caseDoc);
    })
    .on('end', async () => {
      console.log(`✅ تم تحليل الملف. إجمالي الصفوف: ${rowCount} | قضايا صالحة: ${cases.length} | تخطي: ${skipCount}`);

      if (cases.length === 0) {
        console.log('⚠️ لا توجد بيانات صالحة للاستيراد.');
        process.exit(0);
      }

      // Batch Writing to Firestore (Limit 500)
      const BATCH_SIZE = 500;
      for (let i = 0; i < cases.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const currentSlice = cases.slice(i, i + BATCH_SIZE);
        
        currentSlice.forEach(data => {
          const docRef = db.collection('cases').doc();
          batch.set(docRef, data);
        });
        
        await batch.commit();
        console.log(`📦 تم رفع المجموعة ${Math.floor(i/BATCH_SIZE) + 1} بنجاح (${currentSlice.length} وثيقة)`);
      }

      console.log('✨ اكتملت عملية الاستيراد بنجاح!');
      process.exit(0);
    })
    .on('error', (err) => {
      console.error('❌ خطأ في معالجة الملف:', err);
      process.exit(1);
    });
};

processImport();
