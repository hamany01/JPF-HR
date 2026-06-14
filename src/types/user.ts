import { Timestamp } from 'firebase/firestore';

export type UserRole = 
  | 'admin' 
  | 'company_manager' 
  | 'assistant_manager' 
  | 'sales_employee' 
  | 'law_firm_manager' 
  | 'law_firm_assistant'
  | 'law_manager'
  | 'law_assistant'
  | 'company_assistant'
  | 'employee';

export interface UserProfile {
  id: string;
  uid: string;
  name: string; // fallback
  fullName: string;
  email: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  lawFirmId?: string;
  assignedCaseIds?: string[];
  telegramChatId?: string;
  theme?: 'classic' | 'glass';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
