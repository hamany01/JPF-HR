import { Timestamp, FieldValue } from 'firebase/firestore';

export type RequestEventType = 
  | 'request_created' 
  | 'request_rejected' 
  | 'request_reactivated' 
  | 'request_approved_preliminary'
  | 'request_converted_to_case';

export type CaseEventType = 
  | 'case_created'
  | 'payment_added'
  | 'case_paid_off'
  | 'case_status_changed'
  | 'case_stale';

export type AppEventType = RequestEventType | CaseEventType;

export interface AppEvent {
  id?: string;
  category: 'request' | 'case';
  requestId?: string;
  caseId?: string;
  serialNumber: string; // Unified field for requestSerialNumber or caseNumber
  type: AppEventType;
  message: string;
  payload?: Record<string, any>;
  createdAt: Timestamp | FieldValue;
  createdBy: string;
  seenBy?: string[];
}
