/**
 * SECURITY FIX: Secure Admin Bootstrap Script
 * 
 * This script replaces the insecure client-side bootstrapAdminIfNeeded function.
 * Run this script locally ONCE to set up the first admin user.
 * 
 * Usage:
 *   npx tsx scripts/setup_first_admin.ts <user-email-or-uid> <admin-email-for-auth>
 * 
 * Prerequisites:
 *   - Firebase Admin SDK service account credentials
 *   - Set GOOGLE_APPLICATION_CREDENTIALS env var to your service account JSON path
 * 
 * Example:
 *   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
 *   npx tsx scripts/setup_first_admin.ts user@example.com admin@yourcompany.com
 */

import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

// Initialize Firebase Admin
if (admin.apps.length === 0) {
  // Try to load config from firebase-applet-config.json
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (!fs.existsSync(configPath)) {
    console.error('❌ firebase-applet-config.json not found!');
    process.exit(1);
  }
  
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  admin.initializeApp({ projectId: firebaseConfig.projectId });
}

async function setupFirstAdmin() {
  const targetEmailOrUid = process.argv[2];
  const adminEmail = process.argv[3];

  if (!targetEmailOrUid) {
    console.error('❌ Usage: npx tsx scripts/setup_first_admin.ts <user-email-or-uid>');
    console.error('   Example: npx tsx scripts/setup_first_admin.ts user@company.com');
    process.exit(1);
  }

  try {
    // Get the user from Firebase Auth
    let uid: string;
    let email: string;

    if (targetEmailOrUid.includes('@')) {
      // It's an email
      const userRecord = await admin.auth().getUserByEmail(targetEmailOrUid);
      uid = userRecord.uid;
      email = userRecord.email || targetEmailOrUid;
    } else {
      // It's a UID
      const userRecord = await admin.auth().getUser(targetEmailOrUid);
      uid = userRecord.uid;
      email = userRecord.email || 'unknown';
    }

    console.log(`👤 Found user: ${email} (UID: ${uid})`);

    // Get the Firestore database
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const db = getFirestore(admin.app(), firebaseConfig.firestoreDatabaseId);

    // Check if any admin already exists
    const adminQuery = await db.collection('users').where('role', '==', 'admin').limit(1).get();
    
    if (!adminQuery.empty) {
      console.warn('⚠️  An admin already exists in the system!');
      console.warn('   If you want to promote this user, edit their profile manually from the admin console.');
      const proceed = process.argv.includes('--force');
      if (!proceed) {
        console.error('   Use --force to override: npx tsx scripts/setup_first_admin.ts <email> --force');
        process.exit(1);
      }
      console.log('   ⏭️  Proceeding with --force...');
    }

    // Set or update the user's profile to admin
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      // Update existing user
      await userRef.update({
        role: 'admin',
        isActive: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('✅ Updated existing user to admin role');
    } else {
      // Create new admin user document
      await userRef.set({
        fullName: email.split('@')[0] || 'Admin',
        email: email,
        phone: '',
        role: 'admin',
        isActive: true,
        telegramChatId: '',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('✅ Created new admin user');
    }

    // Create audit log
    await db.collection('audit_logs').add({
      action: 'admin_bootstrap',
      performedBy: 'system_setup_script',
      targetUser: uid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`\n🎉 Success! User ${email} is now an admin.`);
    console.log('   They can now log in and access the admin console.');
    console.log('\n📝 Next steps:');
    console.log('   1. Delete this script or keep it secured (it requires service account credentials)');
    console.log('   2. The user should log in normally with their credentials');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error setting up admin:', error.message || error);
    if (error.code === 'auth/user-not-found') {
      console.error('   The user must first sign in via Google Login to create their Firebase Auth account.');
      console.error('   Then run this script again with their email.');
    }
    process.exit(1);
  }
}

setupFirstAdmin();