import { Timestamp } from 'firebase/firestore';

export interface NotificationChannelSettings {
  enabled: boolean;
  botToken?: string;
  defaultChatId?: string;
  channels?: Array<{
    id: string;
    name: string;
    chatId: string;
    enabled: boolean;
  }>;
}

export interface NotificationSettings {
  telegram: NotificationChannelSettings;
  whatsapp: { enabled: boolean };
  email: { enabled: boolean };
}

export interface NotificationRecipient {
  type: 'chatId' | 'userId' | 'role';
  value: string;
}

export interface NotificationRule {
  id: string;
  eventType: string;
  entityType: 'request' | 'case';
  enabled: boolean;
  channels: {
    telegram: {
      enabled: boolean;
      recipients: NotificationRecipient[];
      messageTemplate?: string;
    };
    whatsapp?: {
      enabled: boolean;
      recipients: NotificationRecipient[];
      messageTemplate?: string;
    };
    email?: {
      enabled: boolean;
      recipients: NotificationRecipient[];
      messageTemplate?: string;
    };
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface NotificationLog {
  id?: string;
  eventId: string;
  eventType: string;
  channel: 'telegram' | 'whatsapp' | 'email';
  recipient: string;
  message: string;
  status: 'sent' | 'failed' | 'pending';
  error?: string | null;
  sentAt: Timestamp;
}
