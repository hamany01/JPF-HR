import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { RequestEventType, CaseEventType, AppEventType } from '../types/events';
import { sendEventNotification } from './notificationsChannels';

interface CreateEventParams {
  category: 'request' | 'case';
  requestId?: string;
  caseId?: string;
  serialNumber: string;
  type: AppEventType;
  message: string;
  payload?: Record<string, any>;
  createdBy: string;
  createdByName?: string;
}

const createEvent = async (params: CreateEventParams) => {
  try {
    const eventData = {
      ...params,
      createdByName: params.createdByName || 'مستخدم النظام',
      createdAt: serverTimestamp(),
      seenBy: []
    };
    
    // We use a unified collection for efficient real-time notification feeds
    const docRef = await addDoc(collection(db, 'appEvents'), eventData);
    
    // Trigger Channel Notifications (Logic now handled by sendEventNotification)
    await sendEventNotification({ 
      ...eventData, 
      id: docRef.id 
    });
    
    return docRef.id;
  } catch (error) {
    console.error("Error creating event:", error);
    return null;
  }
};

export const createRequestEvent = async (params: {
  requestId: string;
  requestSerialNumber: string;
  type: RequestEventType;
  message: string;
  payload?: Record<string, any>;
  createdBy: string;
  createdByName?: string;
}) => {
  return createEvent({
    category: 'request',
    requestId: params.requestId,
    serialNumber: params.requestSerialNumber,
    type: params.type,
    message: params.message,
    payload: params.payload,
    createdBy: params.createdBy,
    createdByName: params.createdByName
  });
};

export const createCaseEvent = async (params: {
  caseId: string;
  caseSerialNumber: string;
  type: CaseEventType;
  message: string;
  payload?: Record<string, any>;
  createdBy: string;
  createdByName?: string;
}) => {
  return createEvent({
    category: 'case',
    caseId: params.caseId,
    serialNumber: params.caseSerialNumber,
    type: params.type,
    message: params.message,
    payload: params.payload,
    createdBy: params.createdBy,
    createdByName: params.createdByName
  });
};
