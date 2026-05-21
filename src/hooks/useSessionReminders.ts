import { useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, Timestamp, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { sendTelegramNotification } from '../services/notificationsChannels';
import { useAuth } from './useAuth';

export function useSessionReminders() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user) return;

    // Check every hour (3600000 ms)
    const interval = setInterval(checkSessions, 60 * 60 * 1000);
    checkSessions(); // Initial check
    return () => clearInterval(interval);
  }, [user, loading]);

  async function checkSessions() {
    console.log('⏰ [Reminders] Checking upcoming sessions...');
    const now = new Date();
    
    try {
      const sessionsQuery = query(
        collection(db, 'case_sessions'),
        where('sessionDate', '>=', Timestamp.fromDate(now))
      );

      const snap = await getDocs(sessionsQuery);
      console.log(`🔍 [Reminders] Found ${snap.docs.length} upcoming sessions`);

      for (const sessionDoc of snap.docs) {
        const session = sessionDoc.data();
        const sessionDate = session.sessionDate.toDate();
        const diff = sessionDate.getTime() - now.getTime();
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor(diff / (1000 * 60));

        console.log(`📅 [Reminders] Session ${session.caseSerialNumber || sessionDoc.id}: ${days} days, ${hours} hours, ${minutes} minutes left`);

        // Check for 7 days reminder
        if (days === 7 && !session.notification7Days) {
          await sendReminder(sessionDoc.id, session, '7_days');
        } 
        // Check for 1 day reminder
        else if (days < 1 && hours <= 24 && hours >= 23 && !session.notification1Day) {
          await sendReminder(sessionDoc.id, session, '1_day');
        }
        // Check for 30 minutes reminder
        else if (minutes <= 30 && minutes >= 0 && !session.notification30Min) {
          await sendReminder(sessionDoc.id, session, '30_minutes');
        }
      }
    } catch (error) {
      console.error('❌ [Reminders] Error checking sessions:', error);
    }
  }

  async function sendReminder(sessionId: string, session: any, type: string) {
    let timeText = '';
    let updateField = '';
    
    if (type === '7_days') {
      timeText = '7 أيام';
      updateField = 'notification7Days';
    } else if (type === '1_day') {
      timeText = 'يوم واحد';
      updateField = 'notification1Day';
    } else if (type === '30_minutes') {
      timeText = '30 دقيقة';
      updateField = 'notification30Min';
    }

    const message = `
⏰ <b>تذكير بموعد جلسة قضائية</b>

⚖️ <b>رقم القضية:</b> ${session.caseSerialNumber || '—'}
👤 <b>المنفذ ضده:</b> ${session.defendantName || '—'}
📅 <b>موعد الجلسة:</b> ${sessionDateFormatter(session.sessionDate.toDate())}
⏰ <b>الوقت:</b> ${sessionTimeFormatter(session.sessionDate.toDate())}
📍 <b>المكان:</b> ${session.location || 'غير محدد'}

⚠️ <b>الجلسة بعد ${timeText}</b>

🔗 <a href="${window.location.origin}/cases/${session.caseId}">عرض تفاصيل القضية</a>
    `.trim();
    
    console.log(`📤 [Reminders] Sending reminder: ${type} for session ${sessionId}`);
    
    try {
      await sendTelegramNotification(message);
      
      // Add in-app notification
      await addDoc(collection(db, 'notifications'), {
        type: 'session_reminder',
        caseId: session.caseId,
        sessionId: sessionId,
        title: `تذكير: جلسة بعد ${timeText}`,
        message: `جلسة قضية رقم ${session.caseSerialNumber} بعد ${timeText}`,
        read: false,
        createdAt: serverTimestamp()
      });
      
      await updateDoc(doc(db, 'case_sessions', sessionId), {
        [updateField]: true
      });
      console.log(`✅ [Reminders] Updated notification status for ${sessionId}`);
    } catch (err) {
      console.error(`❌ [Reminders] Failed to send reminder or update doc:`, err);
    }
  }
}

function sessionDateFormatter(date: Date): string {
  return date.toLocaleDateString('ar-SA');
}

function sessionTimeFormatter(date: Date): string {
  return date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
}
