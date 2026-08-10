import { AppEvent } from '../types/events';
import { 
  doc, 
  getDoc, 
  getDocs, 
  collection, 
  query, 
  where, 
  addDoc, 
  Timestamp,
  limit
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { 
  NotificationSettings, 
  NotificationRule, 
  NotificationRecipient 
} from '../types/notifications';

/**
 * Fallback: إرسال إشعار لحساب الشركة الافتراضي
 * يُستخدم عندما لا توجد قاعدة أو لا يوجد مستلمين
 */
async function sendFallbackNotification(event: AppEvent): Promise<void> {
  try {
    console.log('🔄 [Notifications] Using fallback notification method');
    
    // جلب الإعدادات العامة
    const settingsRef = doc(db, 'notificationSettings', 'global');
    const settingsSnap = await getDoc(settingsRef);
    
    if (!settingsSnap.exists()) {
      console.warn('⚠️ [Notifications] No global settings found');
      return;
    }
    
    const settings = settingsSnap.data();
    
    if (!settings.telegram?.enabled || !settings.telegram?.defaultChatId) {
      console.warn('⚠️ [Notifications] Telegram not configured in global settings');
      return;
    }
    
    console.log('✅ [Notifications] Using default chat ID:', settings.telegram.defaultChatId);
    
    const message = formatNotificationMessage(event);
    await sendTelegramMessage(
      settings.telegram.defaultChatId,
      message,
      event.id!,
      event.type as string
    );
    
    console.log('✅ [Notifications] Fallback notification sent');
    
  } catch (error) {
    console.error('❌ [Notifications] Fallback notification failed:', error);
  }
}

/**
 * Main function to route events to configured notification channels based on rules
 */
export async function sendEventNotification(event: AppEvent & { id?: string }): Promise<void> {
  console.log('🔔 [Notifications] sendEventNotification called');
  console.log('📋 [Notifications] Event type:', event.type);
  console.log('📋 [Notifications] Event data:', event);

  try {
    if (!event.id) return;
    
    // Check for custom recipients in payload first
    if (event.payload?.customRecipients && Array.isArray(event.payload.customRecipients) && event.payload.customRecipients.length > 0) {
      const customRecipients = Array.from(new Set<string>(event.payload.customRecipients.filter(Boolean)));
      console.log('🎯 [Notifications] Using custom recipients provided in event payload:', customRecipients);
      
      for (const chatId of customRecipients) {
        const message = formatNotificationMessage(event);
        console.log(`📤 [Notifications] Sending custom to ${chatId}`);
        await sendTelegramMessage(chatId, message, event.id, event.type as string);
      }
      
      console.log('✅ [Notifications] Custom notifications process completed');
      return;
    }

    // 1. Fetch the rule for this event type
    const ruleRef = doc(db, 'notificationRules', `${event.type}_rule`);
    console.log('🔍 [Notifications] Looking for rule:', `${event.type}_rule`);

    const ruleSnap = await getDoc(ruleRef);
    
    if (!ruleSnap.exists()) {
      console.warn('❌ [Notifications] Rule not found:', `${event.type}_rule`);
      console.log('💡 [Notifications] Attempting fallback to default chat ID...');
      await sendFallbackNotification(event);
      return;
    }
    
    const rule = ruleSnap.data() as NotificationRule;
    console.log('✅ [Notifications] Rule found:', rule);

    if (!rule.enabled) {
      console.warn('⏸️ [Notifications] Rule is disabled for:', event.type);
      return;
    }
    
    // 2. Process Telegram if enabled
    if (rule.channels.telegram?.enabled) {
      console.log('📲 [Notifications] Telegram is enabled, resolving recipients...');
      const recipients = await resolveRecipients(rule.channels.telegram.recipients);
      console.log('👥 [Notifications] Resolved recipients:', recipients);

      if (recipients.length === 0) {
        console.warn('⚠️ [Notifications] No recipients found, using fallback...');
        await sendFallbackNotification(event);
        return;
      }
      
      for (const chatId of recipients) {
        const message = formatNotificationMessage(event, rule.channels.telegram.messageTemplate);
        console.log(`📤 [Notifications] Sending to ${chatId}`);
        console.log(`💬 [Notifications] Message:`, message);
        await sendTelegramMessage(chatId, message, event.id, event.type as string);
      }
    } else {
      console.log('📵 [Notifications] Telegram not enabled for this event type');
    }
    
    console.log('✅ [Notifications] All notifications process completed');
    
  } catch (error) {
    console.error('❌ [Notifications] Error in sendEventNotification:', error);
  }
}

/**
 * Resolves abstract recipients (roles, userIds) into concrete Chat IDs
 */
async function resolveRecipients(recipients: NotificationRecipient[]): Promise<string[]> {
  const chatIds = new Set<string>();
  
  for (const recipient of recipients) {
    try {
      if (recipient.type === 'chatId') {
        chatIds.add(recipient.value);
      } 
      else if (recipient.type === 'role') {
        const usersQuery = query(
          collection(db, 'users'),
          where('role', '==', recipient.value),
          where('isActive', '==', true)
        );
        const usersSnap = await getDocs(usersQuery);
        usersSnap.forEach(userDoc => {
          const cid = userDoc.data().telegramChatId;
          if (cid) chatIds.add(cid);
        });
      }
      else if (recipient.type === 'userId') {
        const userDoc = await getDoc(doc(db, 'users', recipient.value));
        const cid = userDoc.data()?.telegramChatId;
        if (cid) chatIds.add(cid);
      }
    } catch (err) {
      console.error('[Notifications] Error resolving recipient:', recipient, err);
    }
  }
  
  return Array.from(chatIds);
}

/**
 * Formats the final notification message string
 */
function formatNotificationMessage(event: AppEvent, template?: string): string {
  if (template) {
    return template
      .replace('{type}', event.type as string)
      .replace('{message}', event.message)
      .replace('{serialNumber}', event.serialNumber || '')
      .replace('{id}', event.id || '');
  }
  
  const BASE_URL = window.location.origin;
  const { type, payload, serialNumber, requestId, caseId } = event;
  const entityId = requestId || caseId || event.id;

  // Use toLocaleString for consistent Arabic formatting
  const dateStr = new Date().toLocaleDateString('ar-SA');
  const timeStr = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

  switch (type) {
    case 'request_created':
      return `
<b>🆕 طلب جديد في النظام</b>

📋 <b>رقم الطلب:</b> ${payload?.serialNumber || serialNumber}
👤 <b>مقدم الطلب:</b> ${payload?.applicantName || '—'}
📅 <b>التاريخ:</b> ${dateStr}
⏰ <b>الوقت:</b> ${timeStr}

🔗 <a href="${BASE_URL}/requests?id=${entityId}">عرض تفاصيل الطلب</a>
`.trim();

    case 'request_rejected':
      return `
<b>❌ تم رفض طلب</b>

📋 <b>رقم الطلب:</b> ${payload?.serialNumber || serialNumber}
👤 <b>مقدم الطلب:</b> ${payload?.applicantName || '—'}
📝 <b>سبب الرفض:</b> ${payload?.rejectionReason || 'غير محدد'}
📅 <b>التاريخ:</b> ${dateStr}

🔗 <a href="${BASE_URL}/requests?id=${entityId}">عرض الطلب المرفوض</a>
`.trim();

    case 'request_converted_to_case':
      return `
<b>⚖️ تحويل طلب إلى قضية تنفيذية</b>

📋 <b>رقم الطلب:</b> ${payload?.serialNumber || serialNumber}
⚖️ <b>رقم القضية:</b> ${payload?.caseSerialNumber || '—'}
👤 <b>العميل:</b> ${payload?.applicantName || '—'}
📅 <b>تاريخ التحويل:</b> ${dateStr}

🔗 <a href="${BASE_URL}/cases/${payload?.caseId || entityId}">عرض القضية</a>
`.trim();

    case 'case_created':
      return `
<b>⚖️ قضية تنفيذية جديدة</b>

⚖️ <b>رقم القضية:</b> ${payload?.caseSerialNumber || serialNumber}
👤 <b>المدعي:</b> ${payload?.plaintiff || 'غير محدد'}
👥 <b>المدعى عليه:</b> ${payload?.defendant || 'غير محدد'}
💰 <b>المبلغ المطالب به:</b> ${payload?.totalAmount?.toLocaleString('ar-SA') || '—'} ريال
📅 <b>التاريخ:</b> ${dateStr}

🔗 <a href="${BASE_URL}/cases/${entityId}">عرض تفاصيل القضية</a>
`.trim();

    case 'payment_added':
      return `
<b>💵 سداد جديد</b>

⚖️ <b>رقم القضية:</b> ${payload?.caseSerialNumber || serialNumber}
💰 <b>مبلغ السداد:</b> ${payload?.paymentAmount?.toLocaleString('ar-SA') || '—'} ريال
📊 <b>المتبقي:</b> ${payload?.remainingAmount?.toLocaleString('ar-SA') || '—'} ريال
📅 <b>تاريخ السداد:</b> ${payload?.paymentDate ? new Date(payload.paymentDate).toLocaleDateString('ar-SA') : dateStr}

🔗 <a href="${BASE_URL}/cases/${entityId}">عرض القضية</a>
`.trim();

    case 'case_paid_off':
      return `
<b>🎉 تم سداد القضية بالكامل</b>

⚖️ <b>رقم القضية:</b> ${payload?.caseSerialNumber || serialNumber}
💰 <b>إجمالي المحصل:</b> ${payload?.totalCollected?.toLocaleString('ar-SA') || payload?.receivedAmount?.toLocaleString('ar-SA') || '—'} ريال
📅 <b>تاريخ الإغلاق:</b> ${dateStr}

✅ <b>الحالة:</b> مغلقة - تم التحصيل بالكامل

🔗 <a href="${BASE_URL}/cases/${entityId}">عرض تفاصيل القضية</a>
`.trim();

    case 'request_reactivated':
      return `
<b>🔄 إعادة تفعيل طلب</b>

📋 <b>رقم الطلب:</b> ${payload?.serialNumber || serialNumber}
👤 <b>مقدم الطلب:</b> ${payload?.applicantName || '—'}
📅 <b>تاريخ إعادة التفعيل:</b> ${dateStr}

🔗 <a href="${BASE_URL}/requests?id=${entityId}">عرض الطلب</a>
`.trim();

    case 'request_approved_preliminary':
      return `
<b>✅ قبول مبدئي لطلب</b>

📋 <b>رقم الطلب:</b> ${payload?.serialNumber || serialNumber}
👤 <b>مقدم الطلب:</b> ${payload?.applicantName || '—'}
📅 <b>تاريخ القبول:</b> ${dateStr}

🔗 <a href="${BASE_URL}/requests?id=${entityId}">عرض الطلب</a>
`.trim();

    case 'case_status_changed':
      return `
<b>🔄 تغيير حالة قضية</b>

⚖️ <b>رقم القضية:</b> ${payload?.caseSerialNumber || serialNumber}
📊 <b>الحالة السابقة:</b> ${payload?.oldStatusLabel || payload?.oldStatus || '—'}
➡️ <b>الحالة الجديدة:</b> ${payload?.newStatusLabel || payload?.newStatus || '—'}
📅 <b>التاريخ:</b> ${dateStr}

🔗 <a href="${BASE_URL}/cases/${entityId}">عرض القضية</a>
`.trim();

    default:
      const emoji = getEmojiForEventType(event.type as string);
      return `${emoji} <b>إشعار مهم: حدث جديد</b>\n\n${event.message}\n\n#الشؤون_القانونية #${event.type}`;
  }
}

function getEmojiForEventType(type: string): string {
  switch (type) {
    case 'request_created': return '📥';
    case 'request_approved_preliminary': return '✅';
    case 'request_rejected': return '❌';
    case 'request_reactivated': return '🔄';
    case 'request_converted_to_case': return '⚖️';
    case 'case_created': return '🚀';
    case 'payment_added': return '💵';
    case 'case_paid_off': return '💰';
    case 'case_status_changed': return '🔄';
    default: return '📢';
  }
}

/**
 * Helper to get global notification settings
 */
async function getNotificationSettings(): Promise<NotificationSettings | null> {
  const settingsSnap = await getDoc(doc(db, 'notificationSettings', 'global'));
  if (settingsSnap.exists()) {
    return settingsSnap.data() as NotificationSettings;
  }
  return null;
}

/**
 * Actual Telegram API call with logging to Firestore
 */
async function sendTelegramMessage(
  chatId: string,
  message: string,
  eventId: string,
  eventType: string
): Promise<void> {
  try {
    const settings = await getNotificationSettings();
    const botToken = settings?.telegram?.botToken || import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
    
    if (!botToken) {
      throw new Error('Telegram Bot Token not configured');
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    const success = response.ok;
    const errorText = success ? null : await response.text();

    // Log the result
    await addDoc(collection(db, 'notificationLogs'), {
      eventId,
      eventType,
      channel: 'telegram',
      recipient: chatId,
      message,
      status: success ? 'sent' : 'failed',
      error: errorText,
      sentAt: Timestamp.now(),
    });

    if (!success) {
      console.error('[Telegram] API Error:', errorText);
    }
  } catch (error: any) {
    console.error('[Telegram] Failed to send message:', error);
    // Log failure
    await addDoc(collection(db, 'notificationLogs'), {
      eventId,
      eventType,
      channel: 'telegram',
      recipient: chatId,
      message,
      status: 'failed',
      error: error.message,
      sentAt: Timestamp.now(),
    });
  }
}

/**
 * Keep the old manual notification functions as fallback or utility
 */
export async function sendTelegramNotification(message: string): Promise<void> {
  // SECURITY FIX: Telegram Bot Token should be stored in Firestore notificationSettings (admin-configured)
  // or server-side env only. The VITE_ prefix exposes it to the browser.
  const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
  const chatId = import.meta.env.VITE_TELEGRAM_CHAT_ID;

  // SECURITY NOTE: This fallback is for development only. In production, 
  // all Telegram notifications should go through the server-side API endpoint
  // which reads the bot token from server-side environment variables.
  if (!botToken || !chatId) {
    console.warn('[Telegram] Bot token not configured. Skipping notification.');
    return;
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    });
  } catch (e) {
    console.error(e);
  }
}

export async function sendRequestEventNotification(event: any): Promise<void> {
  await sendEventNotification({ ...event, id: event.id || 'temp' });
}

export async function sendCaseEventNotification(event: any): Promise<void> {
  await sendEventNotification({ ...event, id: event.id || 'temp' });
}

/**
 * Builds a universal WhatsApp link for sharing event details
 */
export const buildWhatsAppLink = (phoneNumber: string, message: string) => {
  const encodedMsg = encodeURIComponent(message);
  // Clean phone number (remove +, spaces, etc.)
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  return `https://wa.me/${cleanPhone}?text=${encodedMsg}`;
};

export const getEventWhatsAppMessage = (event: AppEvent) => {
  let msg = `*إشعار من نظام الشؤون القانونية*\n\n`;
  msg += `*الحدث:* ${event.message}\n`;
  msg += `*المرجع:* ${event.serialNumber}\n`;
  
  if (event.payload?.rejectionReason || event.payload?.reason) {
    msg += `*السبب:* ${event.payload.rejectionReason || event.payload.reason}\n`;
  }
  
  if (event.category === 'case' && event.payload?.remainingAmount !== undefined) {
    msg += `*المتبقي:* ${event.payload.remainingAmount} ريال\n`;
  }
  
  msg += `\n_تم بواسطة النظام آلياً_`;
  return msg;
};

export async function testTelegramConnection(
  botToken: string,
  chatId: string
): Promise<{ success: boolean; message: string }> {
  try {
    if (!botToken || !chatId) {
      return {
        success: false,
        message: 'Bot Token أو Chat ID غير موجود',
      };
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: '✅ <b>اختبار الاتصال</b>\n\nتم إرسال هذه الرسالة للتأكد من صحة Bot Token و Chat ID.\n\n<b>النظام يعمل بشكل صحيح!</b> 🎉',
        parse_mode: 'HTML',
      }),
    });
    
    if (response.ok) {
      return {
        success: true,
        message: '✅ تم إرسال رسالة اختبار بنجاح! تحقق من تيليجرام.',
      };
    } else {
      const error = await response.json();
      return {
        success: false,
        message: `❌ فشل الإرسال: ${error.description || 'خطأ غير معروف'}`,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: `❌ خطأ في الاتصال: ${error.message}`,
    };
  }
}
