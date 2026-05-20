import * as admin from 'firebase-admin';
import * as fs from 'fs';
import path from 'path';

/**
 * JPF-HR Import Script from Text Content
 * سكربت استيراد البيانات من ملف نصي (TSV)
 */

// 1. Firebase Admin Setup
const serviceAccountPath = path.resolve(process.cwd(), 'service-account.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Error: service-account.json not found in root directory.');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

// 2. Data File Configuration
const dataFilePath = path.resolve(process.cwd(), 'cases_data.txt');
if (!fs.existsSync(dataFilePath)) {
  console.error('❌ Error: cases_data.txt not found.');
  console.log('Please save the data text you sent into a file named cases_data.txt');
  process.exit(1);
}

const parseArabicNumber = (val: string): number => {
  if (!val) return 0;
  // Remove commas, spaces, and non-numeric chars except dot
  const clean = val.replace(/,/g, '').replace(/[^\d.-]/g, '').trim();
  return parseFloat(clean) || 0;
};

const processImport = async () => {
  console.log('🚀 Starting Import from Text...');

  const content = fs.readFileSync(dataFilePath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim() !== '');
  
  if (lines.length < 2) {
    console.error('❌ Error: File is empty or has no data lines.');
    process.exit(1);
  }

  // Header indexing based on your provided text structure
  // الرقيم التسلسلي(0) نوع الطلب(1) رقم الطلب(2) تاريخ الرفع(3) الفرعي(4) مراحل الطلب(5) مبلغ المطالبة(6) المستلم(7) المتبقي(8) ...
  const cases: any[] = [];
  
  // Skip header (i=0)
  for (let i = 1; i < lines.length; i++) {
    const columns = lines[i].split('\t').map(c => c.trim());
    if (columns.length < 5) continue; // Skip incomplete lines

    const requestNumber = columns[2];
    const defendantName = columns[10];

    if (!requestNumber || !defendantName) continue;

    // Decision Logic
    const rawDecision = columns[14] || '';
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
    }

    // Status Logic
    const rawStatus = columns[5] || '';
    let status = 'open';
    let statusLabel = rawStatus;

    if (rawStatus.includes('قيد التنفيذ')) {
      status = 'in_progress';
      statusLabel = 'قيد التنفيذ';
    } else if (rawStatus.includes('منتهي') || rawStatus.includes('الإنتهاء')) {
      status = 'closed';
      statusLabel = 'منتهي';
    } else if (rawStatus.includes('إمهال')) {
      status = 'on_hold';
      statusLabel = 'تم الإمهال';
    }

    const claimAmt = parseArabicNumber(columns[6]);
    const receivedAmt = parseArabicNumber(columns[7]);

    const caseDoc = {
      requestType: columns[1] || 'تنفيذ',
      requestNumber,
      fileDate: columns[3] || '',
      subType: columns[4] || '',
      status,
      statusLabel,
      claimAmount: claimAmt,
      receivedAmount: receivedAmt,
      remainingAmount: claimAmt - receivedAmt,
      applicantName: columns[9] || '',
      defendantName,
      idType: columns[11] || '',
      legalCapacity: columns[12] || '',
      nationality: columns[13] || '',
      decisionCode,
      decisionLabel,
      representativeName: columns[15] || '',
      clientNumber: columns[16] || '',
      lastWithdrawalUpdate: columns[17] || '',
      executionProgress: columns[18] || '',
      notes: '',
      platform: 'ناجز', // Default
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    cases.push(caseDoc);
  }

  console.log(`✅ Parsed ${cases.length} cases correctly. Committing to Firestore...`);

  const BATCH_SIZE = 500;
  for (let i = 0; i < cases.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const currentBatch = cases.slice(i, i + BATCH_SIZE);
    
    currentBatch.forEach(data => {
      // Use requestNumber as ID to prevent duplicates if desired, 
      // or doc() for auto ID. Here we use auto ID to match UI behavior.
      const docRef = db.collection('cases').doc();
      batch.set(docRef, data);
    });
    
    await batch.commit();
    console.log(`📦 Exported Batch ${Math.floor(i/BATCH_SIZE) + 1} (${currentBatch.length} docs)`);
  }

  console.log('✨ Data import finished successfully!');
  process.exit(0);
};

processImport();
