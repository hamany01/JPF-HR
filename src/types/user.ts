import { Timestamp } from 'firebase/firestore';

export type UserRole = 
  | 'admin' 
  | 'company_manager' 
  | 'company_assistant' 
  | 'law_manager' 
  | 'law_assistant' 
  | 'employee';

export interface UserProfile {
  id: string;
  uid: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  telegramChatId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
