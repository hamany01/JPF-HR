import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { AsyncLocalStorage } from 'async_hooks';

// Context storage for incoming requests to share the Bearer token with getFirebaseAdmin
export const requestContext = new AsyncLocalStorage<any>();

// Catch all unhandled rejections and exceptions to print them clearly in logs
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 Severe Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err, origin) => {
  console.error('🔥 Severe Uncaught Exception:', err, 'at origin:', origin);
});

const app = express();
const PORT = 3000;

app.use((req, res, next) => {
  requestContext.run(req, next);
});

app.use(express.json());

// API health endpoint
app.get('/api/health', (req, res) => {
  console.log('💚 Health check pinged');
  const safeEnvKeys = Object.keys(process.env).map(key => {
    const val = process.env[key];
    const isSecret = key.toLowerCase().includes('key') || 
                     key.toLowerCase().includes('secret') || 
                     key.toLowerCase().includes('password') || 
                     key.toLowerCase().includes('token') ||
                     key.toLowerCase().includes('credential');
    return {
      key,
      hasValue: !!val,
      isSecret,
      length: val ? val.length : 0,
      preview: isSecret ? '***HIDDEN***' : (val ? val.substring(0, 50) : '')
    };
  });
  res.json({ 
    status: 'ok', 
    time: new Date().toISOString(), 
    envKeys: safeEnvKeys 
  });
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

  // Check if we have an incoming express request context in AsyncLocalStorage
  const req = requestContext.getStore();
  const authHeader = req?.headers?.authorization;
  const token = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.split('Bearer ')[1] : '';

  const db = createRESTDbProxy(token);
  return { admin: adminInstance, db };
}

// API endpoint for password reset
app.post('/api/resetUserPassword', async (req, res) => {
  console.log('☁️ Received reset password request on local Express API');
  
  try {
    const { admin, db } = await getFirebaseAdminForRequest(req);
    
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

// API endpoint to export full database dump
app.get('/api/export-database', async (req, res) => {
  try {
    const { db } = await getFirebaseAdminForRequest(req);
    const collectionsToExport = [
      'cases',
      'requests',
      'payment_plans',
      'case_sessions',
      'appEvents',
      'users',
      'roles_permissions',
      'notificationRules',
      'notificationLogs',
      'settings'
    ];

    const exportedData: Record<string, any[]> = {};
    let totalRecords = 0;

    for (const colName of collectionsToExport) {
      try {
        const snapshot = await db.collection(colName).get();
        const docsData = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        exportedData[colName] = docsData;
        totalRecords += docsData.length;
      } catch (e) {
        console.warn(`Could not export collection ${colName}:`, e);
        exportedData[colName] = [];
      }
    }

    const backupData = {
      exportTimestamp: new Date().toISOString(),
      system: "JPF Legal & Execution System",
      totalCollections: Object.keys(exportedData).length,
      totalRecords,
      collections: exportedData
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=jpf_database_backup_${new Date().toISOString().split('T')[0]}.json`);
    return res.json(backupData);
  } catch (err: any) {
    console.error('❌ Error exporting database:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API endpoint to wipe dummy transactional data for fresh start
app.post('/api/reset-transactional-data', async (req, res) => {
  try {
    const { db, admin } = await getFirebaseAdminForRequest(req);
    const collectionsToReset = [
      'cases',
      'requests',
      'payment_plans',
      'case_sessions',
      'appEvents',
      'notificationLogs'
    ];

    let deletedCounts: Record<string, number> = {};
    let totalDeleted = 0;

    for (const colName of collectionsToReset) {
      const snapshot = await db.collection(colName).get();
      let count = 0;
      
      // Delete in batches of 400
      const batchSize = 400;
      let batch = db.batch();
      let operationCounter = 0;

      for (const doc of snapshot.docs) {
        if (doc.ref) {
          batch.delete(doc.ref);
        } else {
          batch.delete(db.collection(colName).doc(doc.id));
        }
        count++;
        operationCounter++;

        if (operationCounter === batchSize) {
          await batch.commit();
          batch = db.batch();
          operationCounter = 0;
        }
      }

      if (operationCounter > 0) {
        await batch.commit();
      }

      deletedCounts[colName] = count;
      totalDeleted += count;
    }

    // Reset next serial sequence in settings if exists
    try {
      const updateData = {
        nextRequestSerial: 1,
        updatedAt: admin?.firestore?.FieldValue ? admin.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
      };
      await db.collection('settings').doc('sequences').set(updateData, { merge: true });
    } catch (seqErr) {
      console.warn('Could not reset sequence count:', seqErr);
    }

    return res.json({
      success: true,
      message: 'تم تفريغ كافة البيانات التجريبية بنجاح وإعادة ضبط النظام للبدء الفعلي.',
      totalDeleted,
      deletedCounts
    });
  } catch (err: any) {
    console.error('❌ Error resetting database:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- Firestore REST API Helpers & Proxy to bypass GCP Service Account IAM limits of Sandboxed Cloud Run ---

function toFirestoreJSON(val: any): any {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === 'string') {
    return { stringValue: val };
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val };
  }
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      return { integerValue: String(val) };
    }
    return { doubleValue: val };
  }
  if (val instanceof Date) {
    return { timestampValue: val.toISOString() };
  }
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map(toFirestoreJSON)
      }
    };
  }
  if (typeof val === 'object') {
    // If it is a FieldValue or serverTimestamp sentinel:
    if (val.constructor && (val.constructor.name === 'FieldValue' || val.constructor.name === 'Sentinel')) {
      return { timestampValue: new Date().toISOString() };
    }
    if ('_methodName' in val && val._methodName === 'FieldValue.serverTimestamp') {
      return { timestampValue: new Date().toISOString() };
    }
    const fields: Record<string, any> = {};
    for (const key of Object.keys(val)) {
      fields[key] = toFirestoreJSON(val[key]);
    }
    return {
      mapValue: {
        fields
      }
    };
  }
  return { stringValue: String(val) };
}

function unwrapValue(valObj: any): any {
  if (!valObj) return null;
  if ('stringValue' in valObj) return valObj.stringValue;
  if ('booleanValue' in valObj) return valObj.booleanValue;
  if ('integerValue' in valObj) return parseInt(valObj.integerValue, 10);
  if ('doubleValue' in valObj) return parseFloat(valObj.doubleValue);
  if ('timestampValue' in valObj) {
    const date = new Date(valObj.timestampValue);
    const secs = Math.floor(date.getTime() / 1000);
    return {
      toDate: () => date,
      seconds: secs,
      nanoseconds: (date.getTime() % 1000) * 1000000,
      _seconds: secs,
      _nanoseconds: (date.getTime() % 1000) * 1000000
    };
  }
  if ('nullValue' in valObj) return null;
  if ('arrayValue' in valObj) {
    const arr = valObj.arrayValue.values || [];
    return arr.map(unwrapValue);
  }
  if ('mapValue' in valObj) {
    const mapFields = valObj.mapValue.fields || {};
    const mapRes: any = {};
    for (const k of Object.keys(mapFields)) {
      mapRes[k] = unwrapValue(mapFields[k]);
    }
    return mapRes;
  }
  return null;
}

function fromFirestoreJSON(fields: any): any {
  if (!fields) return {};
  const res: any = {};
  for (const key of Object.keys(fields)) {
    res[key] = unwrapValue(fields[key]);
  }
  return res;
}

function getFirestoreConfig() {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  return {
    projectId: firebaseConfig.projectId,
    databaseId: firebaseConfig.firestoreDatabaseId,
    apiKey: firebaseConfig.apiKey || ''
  };
}

async function smartFetchREST(url: string, options: any = {}, token?: string) {
  const { apiKey } = getFirestoreConfig();
  const baseHeaders: Record<string, string> = { ...(options.headers || {}) };

  if (apiKey) {
    baseHeaders['X-Goog-Api-Key'] = apiKey;
  }

  if (token && token.trim().length > 10) {
    const authHeaders = { ...baseHeaders, 'Authorization': `Bearer ${token}` };
    const res = await fetch(url, { ...options, headers: authHeaders });
    if (res.ok || (res.status !== 403 && res.status !== 401)) {
      return res;
    }
    console.warn(`⚠️ Firestore REST request with Authorization returned ${res.status}. Retrying via API key...`);
  }

  return fetch(url, { ...options, headers: baseHeaders });
}

async function fetchDocREST(token: string, colName: string, docId: string) {
  const { projectId, databaseId, apiKey } = getFirestoreConfig();
  const keyParam = apiKey ? `?key=${apiKey}` : '';
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/${colName}/${docId}${keyParam}`;
  
  const response = await smartFetchREST(url, {}, token);

  if (!response.ok) {
    if (response.status === 404) {
      return { exists: false, data: () => null };
    }
    const errText = await response.text();
    throw new Error(`Firestore REST error (${response.status}): ${errText}`);
  }

  const json = await response.json();
  const fields = json.fields || {};
  const data = fromFirestoreJSON(fields);

  return {
    exists: true,
    id: docId,
    data: () => data
  };
}

async function listCollectionREST(token: string, colName: string) {
  const { projectId, databaseId, apiKey } = getFirestoreConfig();
  const keyParam = apiKey ? `&key=${apiKey}` : '';
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/${colName}?pageSize=300${keyParam}`;
  
  const response = await smartFetchREST(url, {}, token);

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Firestore REST error in list collection (${response.status}): ${errText}`);
  }

  const json = await response.json();
  const documents = json.documents || [];

  const docs = documents.map((doc: any) => {
    const parts = doc.name.split('/');
    const docId = parts[parts.length - 1];
    const fields = doc.fields || {};
    const data = fromFirestoreJSON(fields);
    return {
      id: docId,
      exists: true,
      data: () => data,
      ref: {
        id: docId,
        update: async (updateData: any) => updateDocREST(token, colName, docId, updateData),
        delete: async () => deleteDocREST(token, colName, docId),
        set: async (setData: any, options?: any) => updateDocREST(token, colName, docId, setData)
      },
      update: async (updateData: any) => updateDocREST(token, colName, docId, updateData),
      delete: async () => deleteDocREST(token, colName, docId)
    };
  });

  return {
    docs,
    size: docs.length,
    empty: docs.length === 0,
    forEach: (cb: (doc: any, index: number) => void) => docs.forEach(cb)
  };
}

async function addDocREST(token: string, colName: string, data: any) {
  const { projectId, databaseId, apiKey } = getFirestoreConfig();
  const keyParam = apiKey ? `?key=${apiKey}` : '';
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/${colName}${keyParam}`;
  const payload = {
    fields: toFirestoreJSON(data).mapValue.fields
  };

  const response = await smartFetchREST(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }, token);

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Firestore REST error in addDoc (${response.status}): ${errText}`);
  }

  const json = await response.json();
  const parts = json.name.split('/');
  const docId = parts[parts.length - 1];

  return {
    id: docId,
    exists: true,
    data: () => fromFirestoreJSON(json.fields || {})
  };
}

async function updateDocREST(token: string, colName: string, docId: string, data: any) {
  const { projectId, databaseId, apiKey } = getFirestoreConfig();
  const queryParams = Object.keys(data)
    .map(key => `updateMask.fieldPaths=${encodeURIComponent(key)}`)
    .join('&');
  const keyParam = apiKey ? `&key=${apiKey}` : '';

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/${colName}/${docId}?${queryParams ? `${queryParams}${keyParam}` : keyParam.replace('&', '?')}`;
  const payload = {
    fields: toFirestoreJSON(data).mapValue.fields
  };

  const response = await smartFetchREST(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }, token);

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Firestore REST error in updateDoc (${response.status}): ${errText}`);
  }

  const json = await response.json();
  return {
    id: docId,
    exists: true,
    data: () => fromFirestoreJSON(json.fields || {})
  };
}

async function deleteDocREST(token: string, colName: string, docId: string) {
  const { projectId, databaseId, apiKey } = getFirestoreConfig();
  const keyParam = apiKey ? `?key=${apiKey}` : '';
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/${colName}/${docId}${keyParam}`;

  const response = await smartFetchREST(url, {
    method: 'DELETE'
  }, token);

  if (!response.ok && response.status !== 404) {
    const errText = await response.text();
    throw new Error(`Firestore REST error in deleteDoc (${response.status}): ${errText}`);
  }

  return { success: true };
}

function createRESTDbProxy(token: string) {
  const createQueryProxy = (colName: string, filters: Array<{ field: string; op: string; val: any }> = []) => {
    const queryObj: any = {
      where: (field: string, op: string, val: any) => {
        return createQueryProxy(colName, [...filters, { field, op, val }]);
      },
      get: async () => {
        const res = await listCollectionREST(token, colName);
        if (filters.length === 0) return res;

        const filteredDocs = res.docs.filter((docObj: any) => {
          const d = docObj.data();
          if (!d) return false;
          return filters.every(f => {
            if (f.op === '==') return d[f.field] === f.val;
            if (f.op === '!=') return d[f.field] !== f.val;
            if (f.op === '>') return d[f.field] > f.val;
            if (f.op === '>=') return d[f.field] >= f.val;
            if (f.op === '<') return d[f.field] < f.val;
            if (f.op === '<=') return d[f.field] <= f.val;
            if (f.op === 'array-contains') return Array.isArray(d[f.field]) && d[f.field].includes(f.val);
            if (f.op === 'in') return Array.isArray(f.val) && f.val.includes(d[f.field]);
            return true;
          });
        });

        return {
          docs: filteredDocs,
          size: filteredDocs.length,
          empty: filteredDocs.length === 0,
          forEach: (cb: (doc: any, index: number) => void) => filteredDocs.forEach(cb)
        };
      }
    };
    return queryObj;
  };

  return {
    collection: (colName: string) => {
      const baseQuery = createQueryProxy(colName, []);
      return {
        ...baseQuery,
        doc: (docId: string) => {
          return {
            get: async () => fetchDocREST(token, colName, docId),
            set: async (data: any, options?: any) => updateDocREST(token, colName, docId, data),
            update: async (data: any) => updateDocREST(token, colName, docId, data),
            delete: async () => deleteDocREST(token, colName, docId),
            collection: (subColName: string) => {
              return createRESTDbProxy(token).collection(`${colName}/${docId}/${subColName}`);
            }
          };
        },
        add: async (data: any) => addDocREST(token, colName, data),
      };
    },
    batch: () => {
      const operations: (() => Promise<any>)[] = [];
      return {
        update: (docRef: any, updates: any) => {
          if (docRef && typeof docRef.update === 'function') {
            operations.push(() => docRef.update(updates));
          } else if (docRef && typeof docRef.ref?.update === 'function') {
            operations.push(() => docRef.ref.update(updates));
          }
        },
        delete: (docRef: any) => {
          if (docRef && typeof docRef.delete === 'function') {
            operations.push(() => docRef.delete());
          } else if (docRef && typeof docRef.ref?.delete === 'function') {
            operations.push(() => docRef.ref.delete());
          }
        },
        set: (docRef: any, data: any, options?: any) => {
          if (docRef && typeof docRef.set === 'function') {
            operations.push(() => docRef.set(data, options));
          } else if (docRef && typeof docRef.ref?.set === 'function') {
            operations.push(() => docRef.ref.set(data, options));
          }
        },
        commit: async () => {
          for (const op of operations) {
            await op();
          }
        }
      };
    }
  };
}

async function getFirebaseAdminForRequest(req: any) {
  const { admin } = await getFirebaseAdmin();
  const authHeader = req?.headers?.authorization;
  const token = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.split('Bearer ')[1] : '';
  
  const db = createRESTDbProxy(token);
  return { admin, db, token };
}

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
    const { admin, db } = await getFirebaseAdminForRequest(req);
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

    let userRole = userData.role || 'sales_employee';
    // Normalize role names to legacy structure for compatibility with backend logic
    if (userRole === 'law_manager') userRole = 'law_firm_manager';
    else if (userRole === 'law_assistant') userRole = 'law_firm_assistant';
    else if (userRole === 'company_assistant') userRole = 'assistant_manager';
    else if (userRole === 'employee') userRole = 'sales_employee';

    return { uid, role: userRole, userData };
  } catch (err: any) {
    if (err.status) throw err;
    console.error('JWT Token verification error:', err);
    throw { status: 401, message: 'توكن غير صالح أو منتهي الصلاحية' };
  }
}

// PATCH /api/users/me/theme: Update the current user's theme preference
app.patch('/api/users/me/theme', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'غير مصرح: يرجى تسجيل الدخول' });
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'غير مصرح: التوكن فارغ' });
    }

    const { admin, db } = await getFirebaseAdmin();
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    const { theme } = req.body || {};
    if (!theme || (theme !== 'classic' && theme !== 'glass')) {
      return res.status(400).json({ success: false, message: 'سمة مظهر غير صالحة' });
    }

    // Try to update Firestore as best-effort in the backend
    try {
      await db.collection('users').doc(uid).update({
        theme: theme,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (dbErr: any) {
      console.warn('Backend admin Firestore update skipped/failed (gracefully handled):', dbErr.message || dbErr);
    }

    return res.json({ success: true, message: 'تم تحديث مظهر النظام والسمة بنجاح' });
  } catch (error: any) {
    console.error('Error in PATCH /api/users/me/theme:', error);
    return res.status(error.status || 500).json({ success: false, message: error.message || 'حدث خطأ في تحديث مظهر النظام' });
  }
});

// GET /api/cases: List cases with role-based visibility filtering
app.get('/api/cases', async (req, res) => {
  try {
    const { uid, role, userData } = await checkAuthAndGetRole(req);
    const { db } = await getFirebaseAdmin();

    let queryRef: any = db.collection('cases');

    // No query-level filter on isDeleted because legacy documents don't have this field,
    // and Firestore's '!=' query completely excludes documents lacking the queried field.
    // Instead, we will apply this filter in-memory.

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

    // Apply in-memory filtering for isDeleted and legacy cases
    const isAdminRole = ['admin', 'company_manager', 'assistant_manager'].includes(role);
    cases = cases.filter((c: any) => {
      const hasIsDeleted = 'isDeleted' in c && c.isDeleted !== undefined;
      if (hasIsDeleted) {
        return c.isDeleted !== true;
      } else {
        // Legacy document that doesn't have isDeleted field
        return isAdminRole;
      }
    });

    // Sort cases: Newest first (createdAt desc)
    cases.sort((a: any, b: any) => {
      const getMs = (val: any) => {
        if (!val) return 0;
        if (typeof val.toDate === 'function') return val.toDate().getTime();
        if (val && typeof val === 'object' && ('_seconds' in val || 'seconds' in val)) {
          const sec = val._seconds !== undefined ? val._seconds : val.seconds;
          const nano = val._nanoseconds !== undefined ? val._nanoseconds : (val.nanoseconds || 0);
          return sec * 1000 + nano / 1000000;
        }
        return new Date(val).getTime() || 0;
      };
      return getMs(b.createdAt) - getMs(a.createdAt);
    });

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
    // Lawyers can only update status and assignedAssistantId (for managers)
    else if (role === 'law_firm_manager') {
      if (body.status !== undefined) updates.status = body.status;
      if (body.assignedAssistantId !== undefined) {
        updates.assignedAssistantId = body.assignedAssistantId || null;
      }
    }
    else if (role === 'law_firm_assistant') {
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

    // If migrating to external and fields are supplied (Managers/Admins only for lawFirmId, assignmentType)
    if (role === 'admin' || role === 'company_manager' || role === 'assistant_manager') {
      if (req.body.lawFirmId !== undefined) updates.lawFirmId = req.body.lawFirmId;
      if (req.body.assignmentType !== undefined) updates.assignmentType = req.body.assignmentType;
    }
    // Both admins/managers and law firm managers can assign assistants for their respective roles
    if (req.body.assignedAssistantId !== undefined) {
      if (role === 'admin' || role === 'company_manager' || role === 'assistant_manager') {
        updates.assignedAssistantId = req.body.assignedAssistantId;
      } else if (role === 'law_firm_manager') {
        const pLawFirmId = userData.lawFirmId || '';
        if (caseData.lawFirmId && caseData.lawFirmId === pLawFirmId) {
          updates.assignedAssistantId = req.body.assignedAssistantId;
        }
      }
    }

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


// GET /api/recycle-bin/cases: Get soft deleted cases (Admin only)
app.get('/api/recycle-bin/cases', async (req, res) => {
  try {
    const { uid, role } = await checkAuthAndGetRole(req);
    const { db } = await getFirebaseAdmin();

    if (role !== 'admin') {
      return res.status(403).json({ success: false, message: 'هذا الإجراء مسموح به للمشرفين فقط' });
    }

    const snapshot = await db.collection('cases').where('isDeleted', '==', true).get();
    
    // Fetch users mapping safely
    const usersSnapshot = await db.collection('users').get();
    const usersMap: any = {};
    usersSnapshot.forEach((doc: any) => {
      const d = doc.data();
      usersMap[doc.id] = d.fullName || d.name || 'مستخدِم';
    });

    const deletedCases = snapshot.docs.map((doc: any) => {
      const d = doc.data();
      return {
        id: doc.id,
        caseId: doc.id,
        ...d,
        deletedByName: d.deletedBy ? (usersMap[d.deletedBy] || 'مستخدِم غير معروف') : '—'
      };
    });

    // Sort: Newest deleted first
    deletedCases.sort((a: any, b: any) => {
      const getMs = (val: any) => {
        if (!val) return 0;
        if (typeof val.toDate === 'function') return val.toDate().getTime();
        if (val && typeof val === 'object' && ('_seconds' in val || 'seconds' in val)) {
          const sec = val._seconds !== undefined ? val._seconds : val.seconds;
          const nano = val._nanoseconds !== undefined ? val._nanoseconds : (val.nanoseconds || 0);
          return sec * 1000 + nano / 1000000;
        }
        return new Date(val).getTime() || 0;
      };
      return getMs(b.deletedAt) - getMs(a.deletedAt);
    });

    return res.json({ success: true, count: deletedCases.length, data: deletedCases });
  } catch (error: any) {
    console.error('Error in GET /api/recycle-bin/cases:', error);
    return res.status(error.status || 500).json({ success: false, message: error.message || 'حدث خطأ أثناء تحميل سلة القضايا' });
  }
});


// GET /api/recycle-bin/payment-plans: Get soft deleted payment plans (Admin only)
app.get('/api/recycle-bin/payment-plans', async (req, res) => {
  try {
    const { uid, role } = await checkAuthAndGetRole(req);
    const { db } = await getFirebaseAdmin();

    if (role !== 'admin') {
      return res.status(403).json({ success: false, message: 'هذا الإجراء مسموح به للمشرفين فقط' });
    }

    const snapshot = await db.collection('payment_plans').where('isDeleted', '==', true).get();
    
    // Fetch users mapping and cases mapping safely
    const usersSnapshot = await db.collection('users').get();
    const usersMap: any = {};
    usersSnapshot.forEach((doc: any) => {
      const d = doc.data();
      usersMap[doc.id] = d.fullName || d.name || 'مستخدِم';
    });

    const casesSnapshot = await db.collection('cases').get();
    const casesMap: any = {};
    casesSnapshot.forEach((doc: any) => {
      const d = doc.data();
      casesMap[doc.id] = {
        clientName: d.clientName || '—',
        serialNumber: d.requestSerialNumber || d.requestNumber || '—',
        defendantName: d.defendantName || '—'
      };
    });

    const deletedPlans = snapshot.docs.map((doc: any) => {
      const d = doc.data();
      const parentCase = casesMap[d.caseId] || { clientName: 'قضية غير معروفة', serialNumber: '—', defendantName: '—' };
      return {
        id: doc.id,
        planId: doc.id,
        ...d,
        clientName: parentCase.clientName,
        serialNumber: parentCase.serialNumber,
        defendantName: parentCase.defendantName,
        deletedByName: d.deletedBy ? (usersMap[d.deletedBy] || 'مستخدِم غير معروف') : '—'
      };
    });

    // Sort: Newest deleted first
    deletedPlans.sort((a: any, b: any) => {
      const getMs = (val: any) => {
        if (!val) return 0;
        if (typeof val.toDate === 'function') return val.toDate().getTime();
        if (val && typeof val === 'object' && ('_seconds' in val || 'seconds' in val)) {
          const sec = val._seconds !== undefined ? val._seconds : val.seconds;
          const nano = val._nanoseconds !== undefined ? val._nanoseconds : (val.nanoseconds || 0);
          return sec * 1000 + nano / 1000000;
        }
        return new Date(val).getTime() || 0;
      };
      return getMs(b.deletedAt) - getMs(a.deletedAt);
    });

    return res.json({ success: true, count: deletedPlans.length, data: deletedPlans });
  } catch (error: any) {
    console.error('Error in GET /api/recycle-bin/payment-plans:', error);
    return res.status(error.status || 500).json({ success: false, message: error.message || 'حدث خطأ أثناء تحميل سلة الدفعات' });
  }
});


// POST /api/cases/:id/delete: Soft delete a case
app.post('/api/cases/:id/delete', async (req, res) => {
  try {
    const { uid, role, userData } = await checkAuthAndGetRole(req);
    const { db, admin } = await getFirebaseAdmin();
    const caseId = req.params.id;

    if (role !== 'admin' && role !== 'company_manager' && role !== 'assistant_manager' && role !== 'law_firm_manager') {
      return res.status(403).json({ success: false, message: 'غير مصرح لك بنقل القضايا لسلة المحذوفات' });
    }

    const caseDoc = await db.collection('cases').doc(caseId).get();
    if (!caseDoc.exists) {
      return res.status(404).json({ success: false, message: 'القضية المطلوبة غير موجودة' });
    }

    const caseData = caseDoc.data();

    // Check law_firm_manager mismatch
    if (role === 'law_firm_manager') {
      const pLawFirmId = userData.lawFirmId || '';
      if (!caseData.lawFirmId || caseData.lawFirmId !== pLawFirmId) {
        return res.status(403).json({ success: false, message: 'غير مصرح لك بحذف قضايا خارج مكتب المحاماة الخاص بك' });
      }
    }

    await db.collection('cases').doc(caseId).update({
      isDeleted: true,
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      deletedBy: uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Create system log event
    await db.collection('appEvents').add({
      type: 'case_soft_deleted',
      caseId,
      performedBy: uid,
      performedByName: userData.fullName || userData.name || 'مستخدم',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.json({ success: true, message: 'تم نقل القضية إلى سلة المحذوفات بنجاح' });
  } catch (error: any) {
    console.error('Error soft deleting case:', error);
    return res.status(error.status || 500).json({ success: false, message: error.message || 'حدث خطأ أثناء نقل القضية لسلة المحذوفات' });
  }
});


// POST /api/cases/:id/restore: Restore a soft deleted case
app.post('/api/cases/:id/restore', async (req, res) => {
  try {
    const { uid, role, userData } = await checkAuthAndGetRole(req);
    const { db, admin } = await getFirebaseAdmin();
    const caseId = req.params.id;

    if (role !== 'admin') {
      return res.status(403).json({ success: false, message: 'هذا الإجراء مسموح به للمشرفين فقط' });
    }

    const caseDoc = await db.collection('cases').doc(caseId).get();
    if (!caseDoc.exists) {
      return res.status(404).json({ success: false, message: 'القضية المطلوبة غير موجودة' });
    }

    await db.collection('cases').doc(caseId).update({
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Create system log event
    await db.collection('appEvents').add({
      type: 'case_restored',
      caseId,
      performedBy: uid,
      performedByName: userData.fullName || userData.name || 'مشرف',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.json({ success: true, message: 'تم استرجاع القضية بنجاح' });
  } catch (error: any) {
    console.error('Error restoring case:', error);
    return res.status(error.status || 500).json({ success: false, message: error.message || 'حدث خطأ أثناء استرجاع القضية' });
  }
});


// DELETE /api/cases/:id/hard-delete: Permanently delete a case and its payment plans
app.delete('/api/cases/:id/hard-delete', async (req, res) => {
  try {
    const { uid, role, userData } = await checkAuthAndGetRole(req);
    const { db, admin } = await getFirebaseAdmin();
    const caseId = req.params.id;

    if (role !== 'admin') {
      return res.status(403).json({ success: false, message: 'هذا الإجراء مسموح به للمشرفين فقط' });
    }

    const caseDoc = await db.collection('cases').doc(caseId).get();
    if (!caseDoc.exists) {
      return res.status(404).json({ success: false, message: 'القضية المطلوبة غير موجودة' });
    }

    // Delete case
    await db.collection('cases').doc(caseId).delete();

    // Delete associated payment plans
    const plansSnapshot = await db.collection('payment_plans').where('caseId', '==', caseId).get();
    const batch = db.batch();
    plansSnapshot.docs.forEach((doc: any) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    // Create system log event
    await db.collection('appEvents').add({
      type: 'case_hard_deleted',
      caseId,
      performedBy: uid,
      performedByName: userData.fullName || userData.name || 'مشرف',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.json({ success: true, message: 'تم حذف القضية وجميع الدفعات المرتبطة بها نهائياً' });
  } catch (error: any) {
    console.error('Error hard deleting case:', error);
    return res.status(error.status || 500).json({ success: false, message: error.message || 'حدث خطأ أثناء الحذف النهائي للقضية' });
  }
});


// POST /api/payment-plans/:id/delete: Soft delete a payment plan
app.post('/api/payment-plans/:id/delete', async (req, res) => {
  try {
    const { uid, role, userData } = await checkAuthAndGetRole(req);
    const { db, admin } = await getFirebaseAdmin();
    const planId = req.params.id;

    if (role !== 'admin' && role !== 'company_manager' && role !== 'assistant_manager') {
      return res.status(403).json({ success: false, message: 'غير مصرح لك بنقل الدفعات لسلة المحذوفات' });
    }

    const planDoc = await db.collection('payment_plans').doc(planId).get();
    if (!planDoc.exists) {
      return res.status(404).json({ success: false, message: 'القسط أو الدفعة غير موجودة' });
    }

    await db.collection('payment_plans').doc(planId).update({
      isDeleted: true,
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      deletedBy: uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.json({ success: true, message: 'تم نقل الدفعة إلى سلة المحذوفات بنجاح' });
  } catch (error: any) {
    console.error('Error soft deleting payment plan:', error);
    return res.status(error.status || 500).json({ success: false, message: error.message || 'حدث خطأ أثناء نقل القسط لسلة المحذوفات' });
  }
});


// POST /api/payment-plans/:id/restore: Restore a soft deleted payment plan
app.post('/api/payment-plans/:id/restore', async (req, res) => {
  try {
    const { uid, role } = await checkAuthAndGetRole(req);
    const { db, admin } = await getFirebaseAdmin();
    const planId = req.params.id;

    if (role !== 'admin') {
      return res.status(403).json({ success: false, message: 'هذا الإجراء مسموح به للمشرفين فقط' });
    }

    const planDoc = await db.collection('payment_plans').doc(planId).get();
    if (!planDoc.exists) {
      return res.status(404).json({ success: false, message: 'المستند المطلوب غير موجود' });
    }

    await db.collection('payment_plans').doc(planId).update({
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.json({ success: true, message: 'تم استرجاع الدفعة بنجاح' });
  } catch (error: any) {
    console.error('Error restoring payment plan:', error);
    return res.status(error.status || 500).json({ success: false, message: error.message || 'حدث خطأ أثناء استرجاع الدفعة' });
  }
});


// DELETE /api/payment-plans/:id/hard-delete: Permanently delete a payment plan
app.delete('/api/payment-plans/:id/hard-delete', async (req, res) => {
  try {
    const { uid, role } = await checkAuthAndGetRole(req);
    const { db } = await getFirebaseAdmin();
    const planId = req.params.id;

    if (role !== 'admin') {
      return res.status(403).json({ success: false, message: 'هذا الإجراء مسموح به للمشرفين فقط' });
    }

    const planDoc = await db.collection('payment_plans').doc(planId).get();
    if (!planDoc.exists) {
      return res.status(404).json({ success: false, message: 'المستند غير موجود' });
    }

    await db.collection('payment_plans').doc(planId).delete();

    return res.json({ success: true, message: 'تم حذف الدفعة نهائياً' });
  } catch (error: any) {
    console.error('Error hard deleting payment plan:', error);
    return res.status(error.status || 500).json({ success: false, message: error.message || 'حدث خطأ أثناء الحذف النهائي للدفعة' });
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
