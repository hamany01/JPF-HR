import { Timestamp } from 'firebase/firestore';

export interface Note {
  id: string;
  requestId: string;
  requestSerialNumber?: string;
  content: string;
  createdBy: string;
  creatorName: string;
  creatorRole: 'admin' | 'law_manager' | 'company_manager' | 'company_assistant' | 'law_assistant' | 'employee';
  createdAt: Timestamp | any;
  updatedAt?: Timestamp | any;
  
  // نوع الملاحظة
  scope: 'internal' | 'employee_targeted' | 'employee_public';
  
  // إذا كانت موجهة لموظف محدد
  targetEmployeeId?: string;
  targetEmployeeName?: string;
  
  // من يستطيع رؤية الملاحظة
  visibleTo: string[]; // ['admin', 'law_manager', 'employee_xyz']
  
  // اختياري: المرفقات
  attachments?: {
    name: string;
    url: string;
    type: string;
  }[];
}
