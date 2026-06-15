import React, { useState, useEffect } from 'react';
import { 
  collection, 
  getDocs, 
  addDoc, 
  serverTimestamp, 
  query, 
  orderBy, 
  runTransaction, 
  doc, 
  getDoc, 
  where,
  updateDoc
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEmployees } from '../hooks/useEmployees';
import { motion, AnimatePresence } from 'motion/react';
import { createRequestEvent, createCaseEvent } from '../services/eventService';
import { buildWhatsAppLink, getEventWhatsAppMessage } from '../services/notificationsChannels';
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Loader2, 
  X, 
  CheckCircle2, 
  XCircle,
  Clock,
  ExternalLink,
  ChevronLeft,
  AlertTriangle,
  Building2,
  Calendar,
  Phone,
  Send as SendIcon,
  Users as UsersIcon,
  User as UserIcon,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Archive as ArchiveIcon,
  History as HistoryIcon
} from 'lucide-react';
import { cn } from '../lib/utils';

interface Attachment {
  type: string;
  url: string;
  customLabel?: string;
}

interface RequestItem {
  id: string;
  requestSerialNumber: string;
  najizClaimNumber?: string;
  clientNumber: string;
  clientId: string;
  clientName: string;
  defendantName: string;
  defendantPhone: string;
  claimAmount: number;
  electronicReferenceNumber?: string;
  promissoryNoteAmount?: number;
  transactionType: string;
  attachments: Attachment[];
  platform: string;
  status: 'pending_law_review' | 'approved_preliminary' | 'rejected_by_law_firm' | 'converted_to_case' | 'case_closed' | 'archived';
  statusLabel: string;
  rejectionReason?: string;
  approvalNote?: string;
  caseId?: string;
  createdBy: string;
  createdAt: any;
  reviewedBy?: string;
  reviewedAt?: any;
  approvedPreliminaryBy?: string;
  approvedPreliminaryAt?: any;
  convertedBy?: string;
  convertedAt?: any;
  reactivated?: boolean;
  reactivatedReason?: string;
  attachmentsUpdated?: boolean;
  reactivatedBy?: string;
  reactivatedAt?: any;
}

export default function RequestsListPage() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RequestItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [isReactivateModalOpen, setIsReactivateModalOpen] = useState(false);
  
  const [approvalNote, setApprovalNote] = useState('');
  const [convertData, setConvertData] = useState({
    externalCaseNumber: '',
    caseStatus: 'open',
    startDate: new Date().toISOString().split('T')[0]
  });

  const [reactivateData, setReactivateData] = useState({
    reason: '',
    attachmentsUpdated: false
  });
  
  const [platformOptions, setPlatformOptions] = useState<string[]>([]);
  const [requestors, setRequestors] = useState<{ id: string, name: string }[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  
  const [filters, setFilters] = useState({
    status: 'الكل',
    platform: 'الكل',
    requestSerialNumber: ''
  });

  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestIdParam = searchParams.get('id');

  useEffect(() => {
    if (requestIdParam && requests.length > 0) {
      const found = requests.find(r => r.id === requestIdParam);
      if (found) {
        setSelectedRequest(found);
        setIsDetailsOpen(true);
      }
    }
  }, [requestIdParam, requests]);

  const canCreateRequest = ['admin', 'company_manager'].includes(profile?.role || '');
  const canReviewRequest = ['admin', 'law_firm_manager'].includes(profile?.role || '');
  const canReactivate = ['admin', 'law_firm_manager', 'company_manager'].includes(profile?.role || '');
  
  const { employees, loading: loadingEmployees } = useEmployees();
  
  const [allUsers, setAllUsers] = useState<Record<string, string>>({});
  const [telegramUsers, setTelegramUsers] = useState<any[]>([]);
  const [showNotificationOptions, setShowNotificationOptions] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState({
    companyAccount: true,
    allAdmins: false,
    userIds: [] as string[]
  });

  const [formData, setFormData] = useState({
    najizClaimNumber: '',
    clientNumber: '',
    clientId: '',
    clientName: '',
    defendantName: '',
    defendantPhone: '',
    claimAmount: '',
    electronicReferenceNumber: '',
    promissoryNoteAmount: '',
    transactionType: '',
    platform: '',
    attachments: [{ type: '', url: '', customLabel: '' }] as Attachment[],
    assignedEmployeeId: '',
    assignedEmployeeName: ''
  });

  const attachmentTypes = [
    { value: 'id', label: 'الهوية' },
    { value: 'residency', label: 'الإقامة' },
    { value: 'cr', label: 'السجل التجاري' },
    { value: 'national_address', label: 'العنوان الوطني' },
    { value: 'e_promissory', label: 'سند لأمر إلكتروني' },
    { value: 'p_promissory', label: 'سند لأمر ورقي' },
    { value: 'bank_statement', label: 'كشف حساب' },
    { value: 'other', label: 'أخرى' }
  ];

  const getAttachmentLabel = (type: string, customLabel?: string) => {
    if (type === 'other' && customLabel) return customLabel;
    const found = attachmentTypes.find(t => t.value === type);
    return found ? found.label : type;
  };

  useEffect(() => {
    if (user) {
      fetchRequests();
      fetchExecutionSettings();
      fetchAllUsers();
      fetchTelegramUsers();
    }
  }, [user, filters.status, filters.platform]);

  const fetchTelegramUsers = async () => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef, 
        where('telegramChatId', '!=', null)
      );
      const snapshot = await getDocs(q);
      
      const users = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        role: doc.data().role,
        roleLabel: doc.data().roleLabel || doc.data().role,
        telegramChatId: doc.data().telegramChatId,
      }));
      
      setTelegramUsers(users);
    } catch (error) {
      console.error("Error fetching telegram users:", error);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const usersMap: Record<string, string> = {};
      usersSnap.docs.forEach(doc => {
        usersMap[doc.id] = doc.data().name || 'مستخدم';
      });
      setAllUsers(usersMap);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchExecutionSettings = async () => {
    try {
      const platformsRef = doc(db, 'settings', 'executionPlatforms');
      const platformsSnap = await getDoc(platformsRef);
      if (platformsSnap.exists()) {
        setPlatformOptions(platformsSnap.data().options || []);
      }

      const execRef = doc(db, 'settings', 'execution');
      const execSnap = await getDoc(execRef);
      if (execSnap.exists()) {
        const data = execSnap.data();
        setRequestors(data.requestors || []);
        setTransactionTypes(data.transactionTypes || []);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      let q = query(collection(db, 'requests'));

      if (profile?.role === 'company_manager') {
        q = query(q, where('createdBy', '==', user?.uid));
      } else if (profile?.role === 'law_firm_manager') {
        q = query(q, where('lawFirmId', '==', 'LAW-JPF-001'));
      }

      if (filters.status !== 'الكل') {
        q = query(q, where('status', '==', filters.status));
      }
      if (filters.platform !== 'الكل') {
        q = query(q, where('platform', '==', filters.platform));
      }

      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RequestItem[];
      
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

      docs.sort((a, b) => getMs(b.createdAt) - getMs(a.createdAt));
      setRequests(docs);
    } catch (error) {
      console.error("Error fetching requests:", error);
    }
    setLoading(false);
  };

  const handleAddRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const transactionResult = await runTransaction(db, async (transaction) => {
        // 1. Get and increment serial number
        const sequenceRef = doc(db, 'settings', 'sequences');
        const sequenceSnap = await transaction.get(sequenceRef);
        let nextSerial = 1;
        if (sequenceSnap.exists()) {
          nextSerial = (sequenceSnap.data().nextRequestSerial || 1);
        }
        
        const year = new Date().getFullYear();
        const formattedSerial = `REQ-${year}-${nextSerial.toString().padStart(5, '0')}`;
        
        // 2. Prepare request data
        const validAttachments = formData.attachments.filter(a => a.type && a.url.trim() !== '');
        
        const newRequest = {
          najizClaimNumber: formData.najizClaimNumber,
          clientNumber: formData.clientNumber,
          clientId: formData.clientId,
          clientName: formData.clientName,
          defendantName: formData.defendantName,
          defendantPhone: formData.defendantPhone,
          claimAmount: parseFloat(formData.claimAmount),
          electronicReferenceNumber: formData.electronicReferenceNumber,
          promissoryNoteAmount: parseFloat(formData.promissoryNoteAmount) || 0,
          transactionType: formData.transactionType,
          platform: formData.platform,
          attachments: validAttachments,
          requestSerialNumber: formattedSerial,
          status: 'pending_law_review',
          statusLabel: 'بانتظار مراجعة مكتب المحاماة',
          lawFirmId: 'LAW-JPF-001',
          createdBy: user?.uid,
          createdAt: serverTimestamp(),
          assignedEmployeeId: formData.assignedEmployeeId || '',
          assignedEmployeeName: formData.assignedEmployeeName || ''
        };

        const requestRef = doc(collection(db, 'requests'));
        transaction.set(requestRef, newRequest);
        transaction.set(sequenceRef, { nextRequestSerial: nextSerial + 1 }, { merge: true });
        
        // Return data for post-transaction event creation
        return { requestId: requestRef.id, serialNumber: formattedSerial };
      });

      // استدعاء createRequestEvent فوراً بعد نجاح الترانزكشن
      if (transactionResult) {
        // Resolve custom recipients
        const recipientChatIds: string[] = [];
        
        if (selectedRecipients.companyAccount) {
          recipientChatIds.push('218601139');
        }
        
        if (selectedRecipients.allAdmins) {
          const admins = telegramUsers.filter(u => u.role === 'admin');
          recipientChatIds.push(...admins.map(a => a.telegramChatId).filter(Boolean));
        }
        
        selectedRecipients.userIds.forEach(userId => {
          const targetUser = telegramUsers.find(u => u.id === userId);
          if (targetUser?.telegramChatId) {
            recipientChatIds.push(targetUser.telegramChatId);
          }
        });

        // Use custom recipients ONLY if at least one was selected, 
        // OR if companyAccount was deliberately unchecked to send to NO ONE 
        // Actually, the prompt says "إذا المستخدم ما حدد شي، يستخدم القواعد الافتراضية"
        // But the user interface starts with companyAccount: true.
        // If they click "Unselect all", then payload will have empty list?
        // Let's stick strictly to: if ANY selection was made, use customRecipients.
        
        const hasCustomSelection = selectedRecipients.companyAccount || selectedRecipients.allAdmins || selectedRecipients.userIds.length > 0;

        await createRequestEvent({
          requestId: transactionResult.requestId,
          requestSerialNumber: transactionResult.serialNumber,
          type: 'request_created',
          message: `تم إنشاء طلب جديد برقم ${transactionResult.serialNumber} للعميل ${formData.clientName}`,
          payload: {
            serialNumber: transactionResult.serialNumber,
            applicantName: formData.clientName,
            claimAmount: parseFloat(formData.claimAmount),
            platform: formData.platform,
            customRecipients: hasCustomSelection ? Array.from(new Set(recipientChatIds)) : undefined
          },
          createdBy: user?.uid || '',
          createdByName: profile?.name || 'مستخدم'
        });
      }

      setIsAddModalOpen(false);
      setSelectedRecipients({
        companyAccount: true,
        allAdmins: false,
        userIds: []
      });
      setShowNotificationOptions(false);
      setFormData({
        najizClaimNumber: '',
        clientNumber: '',
        clientId: '',
        clientName: '',
        defendantName: '',
        defendantPhone: '',
        claimAmount: '',
        electronicReferenceNumber: '',
        promissoryNoteAmount: '',
        transactionType: '',
        platform: '',
        attachments: [{ type: '', url: '', customLabel: '' }],
        assignedEmployeeId: '',
        assignedEmployeeName: ''
      });
      fetchRequests();
    } catch (error) {
      console.error("Error adding request:", error);
      alert("حدث خطأ أثناء إضافة الطلب");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprovePreliminary = async () => {
    if (!selectedRequest || isSubmitting) return;
    
    // 1. Validate required data fields
    const missingFields = [];
    if (!selectedRequest.clientName) missingFields.push("اسم العميل");
    if (!selectedRequest.defendantName) missingFields.push("اسم المنفذ ضده");
    if (!selectedRequest.claimAmount || Number(selectedRequest.claimAmount) <= 0) missingFields.push("مبلغ المطالبة");
    
    if (missingFields.length > 0) {
      alert(`تعذر إتمام القبول المبدئي بسبب نقص بيانات في الطلب. الرجاء مراجعة الحقول الأساسية التالية: ${missingFields.join('، ')}.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const currentYear = new Date().getFullYear();
      let generatedCaseSerial = '';
      const caseRef = doc(collection(db, 'cases'));
      const counterRef = doc(db, 'counters', 'executionCases');

      await runTransaction(db, async (transaction) => {
        // 1. Generate Case Serial Number
        const counterDoc = await transaction.get(counterRef);
        let newCount = 1;
        let prefix = 'CASE';
        if (counterDoc.exists()) {
          newCount = (counterDoc.data().currentSerial || 0) + 1;
        } else {
          transaction.set(counterRef, { currentSerial: 1, prefix: 'CASE' });
        }
        const paddedCount = String(newCount).padStart(5, '0');
        generatedCaseSerial = `${prefix}-${currentYear}-${paddedCount}`;
        transaction.update(counterRef, { currentSerial: newCount });

        // 2. Write Case Document
        const caseData = {
          id: caseRef.id,
          serialNumber: generatedCaseSerial,
          sourceRequestId: selectedRequest.id,
          requestId: selectedRequest.id,
          requestSerialNumber: selectedRequest.requestSerialNumber || '',
          lawFirmId: profile?.lawFirmId || "LAW-JPF-001",
          lawManagerId: user?.uid || '',
          status: 'external_assigned',
          statusLabel: 'مسندة للمكتب القانوني',
          claimAmount: Number(selectedRequest.claimAmount) || 0,
          receivedAmount: 0,
          remainingAmount: Number(selectedRequest.claimAmount) || 0,
          defendantName: selectedRequest.defendantName || '',
          defendantPhone: selectedRequest.defendantPhone || '',
          applicantName: selectedRequest.clientName || '',
          clientNumber: selectedRequest.clientNumber || '',
          electronicReferenceNumber: selectedRequest.electronicReferenceNumber || '',
          platform: selectedRequest.platform || '',
          attachments: (selectedRequest.attachments || []).map((att: any) => ({
            ...att,
            archived: false
          })),
          isDeleted: false,
          requestType: 'تنفيذ',
          requestCreatedBy: selectedRequest.createdBy || '', // Connects the case back to the company manager creator
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: user?.uid || '',
        };
        transaction.set(caseRef, caseData);

        // 3. Update Request document
        const requestRef = doc(db, 'requests', selectedRequest.id);
        transaction.update(requestRef, {
          status: 'approved_preliminary',
          statusLabel: 'مقبول ومحول لقضية',
          approvedPreliminaryBy: user?.uid,
          approvedPreliminaryAt: serverTimestamp(),
          approvalNote: approvalNote,
          caseId: caseRef.id,
          caseSerialNumber: generatedCaseSerial,
          updatedAt: serverTimestamp()
        });
      });

      // 4. Log events
      try {
        await createRequestEvent({
          requestId: selectedRequest.id,
          requestSerialNumber: selectedRequest.requestSerialNumber,
          type: 'request_approved_preliminary' as any,
          message: `تم قبول الطلب ${selectedRequest.requestSerialNumber} مبدئياً وتوليد ملف القضية رقم ${generatedCaseSerial} بواسطة ${profile?.name}.`,
          payload: { 
            serialNumber: selectedRequest.requestSerialNumber,
            applicantName: selectedRequest.clientName,
            approvalNote 
          },
          createdBy: user?.uid || '',
          createdByName: profile?.name || 'مستخدم'
        });

        await createCaseEvent({
          caseId: caseRef.id,
          caseSerialNumber: generatedCaseSerial,
          type: 'case_created' as any,
          message: `تم إنشاء قضية تنفيذية جديدة للمنفذ ضده ${selectedRequest.defendantName} بمبلغ ${selectedRequest.claimAmount} ريال عند اعتماد الطلب.`,
          payload: { 
            caseId: caseRef.id,
            requestId: selectedRequest.id,
            caseSerialNumber: generatedCaseSerial,
            plaintiff: selectedRequest.clientName,
            defendant: selectedRequest.defendantName,
            totalAmount: selectedRequest.claimAmount
          },
          createdBy: user?.uid || '',
          createdByName: profile?.name || 'مستخدم'
        });
      } catch (evtErr) {
        console.error("Event system error: ", evtErr);
      }

      setIsApproveModalOpen(false);
      setIsDetailsOpen(false);
      setApprovalNote('');
      fetchRequests();
      alert(`تم قبول الطلب مبدئياً وتوليد ملف القضية رقم ${generatedCaseSerial} بنجاح`);
    } catch (error: any) {
      console.error("Detailed error approving request:", error);
      const errorMessage = error?.message || String(error);
      const errorCode = error?.code || '';
      
      if (errorCode === 'permission-denied' || errorMessage.includes('permission-denied') || errorMessage.includes('Permission denied')) {
        alert(`ليس لديك صلاحية لإتمام هذه العملية (تفاصيل: قد تكون صلاحيات حسابك كمدير مكتب غير مطابقة للمكتب المحدد LAW-JPF-001 أو هناك مشكلة في قواعد قواعد البيانات لقاعدة Firestore).`);
      } else {
        alert(`حدث خطأ أثناء القبول المبدئي والتحويل لقضية. التفاصيل: ${errorMessage}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConvertToCase = async () => {
    // Deprecated in favor of the single atomic approval transaction.
    alert("هذه الخطوة مدمجة تلقائياً مع زر القبول المبدئي.");
  };

  const handleRejectRequest = async () => {
    if (!selectedRequest || !rejectionReason || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const requestRef = doc(db, 'requests', selectedRequest.id);
      await updateDoc(requestRef, {
        status: 'rejected_by_law_firm',
        statusLabel: 'مرفوض من المكتب القانوني',
        rejectionReason: rejectionReason,
        reviewedBy: user?.uid,
        reviewedAt: serverTimestamp()
      });

      // Log event
      await createRequestEvent({
        requestId: selectedRequest.id,
        requestSerialNumber: selectedRequest.requestSerialNumber,
        type: 'request_rejected',
        message: `تم رفض الطلب ${selectedRequest.requestSerialNumber}. السبب: ${rejectionReason}`,
        payload: { 
          serialNumber: selectedRequest.requestSerialNumber,
          applicantName: selectedRequest.clientName,
          rejectionReason 
        },
        createdBy: user?.uid || '',
        createdByName: profile?.name || 'مستخدم'
      });

      setIsRejectModalOpen(false);
      setIsDetailsOpen(false);
      setRejectionReason('');
      fetchRequests();
    } catch (error) {
      console.error("Error rejecting request:", error);
      alert("حدث خطأ أثناء رفض الطلب");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReactivateRequest = async () => {
    if (!selectedRequest || !reactivateData.reason || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const requestRef = doc(db, 'requests', selectedRequest.id);
      const updateData = {
        status: 'pending_law_review',
        statusLabel: 'بانتظار مراجعة مكتب المحاماة (معاد تفعيله)',
        reactivated: true,
        reactivatedReason: reactivateData.reason,
        attachmentsUpdated: reactivateData.attachmentsUpdated,
        reactivatedBy: user?.uid,
        reactivatedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await updateDoc(requestRef, updateData);

      // Log event
      await createRequestEvent({
        requestId: selectedRequest.id,
        requestSerialNumber: selectedRequest.requestSerialNumber,
        type: 'request_reactivated',
        message: `تم إعادة تفعيل الطلب ${selectedRequest.requestSerialNumber}. السبب: ${reactivateData.reason}`,
        payload: { 
          serialNumber: selectedRequest.requestSerialNumber,
          applicantName: selectedRequest.clientName,
          reactivatedReason: reactivateData.reason,
          attachmentsUpdated: reactivateData.attachmentsUpdated 
        },
        createdBy: user?.uid || '',
        createdByName: profile?.name || 'مستخدم'
      });

      setIsReactivateModalOpen(false);
      setIsDetailsOpen(false);
      setReactivateData({ reason: '', attachmentsUpdated: false });
      fetchRequests();
      alert('تم إعادة تفعيل الطلب بنجاح');
    } catch (error) {
      console.error("Error reactivating request:", error);
      alert("حدث خطأ أثناء إعادة تفعيل الطلب");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredRequests = requests.filter(req => {
    if (!filters.requestSerialNumber) return true;
    return req.requestSerialNumber?.includes(filters.requestSerialNumber);
  });

  const activeRequests = filteredRequests.filter(r => r.status === 'pending_law_review');
  const archivedRequests = filteredRequests.filter(r => r.status === 'approved_preliminary' || r.status === 'rejected_by_law_firm' || r.status === 'case_closed' || r.status === 'archived');
  const displayedRequests = activeTab === 'active' ? activeRequests : archivedRequests;

  const handleArchiveRequest = async (e: React.MouseEvent, reqId: string, reqData: any) => {
    e.stopPropagation();
    if (!window.confirm('هل أنت متأكد من أرشفة هذا الطلب؟')) return;
    
    try {
      await updateDoc(doc(db, 'requests', reqId), {
        status: 'archived',
        statusLabel: 'مؤرشف',
        archivedAt: serverTimestamp(),
        archivedBy: user?.uid
      });

      await createRequestEvent({
        requestId: reqId,
        requestSerialNumber: reqData.requestSerialNumber || '',
        type: 'request_archived' as any,
        message: `تم أرشفة الطلب بواسطة ${profile?.name}.`,
        createdBy: user?.uid || '',
        createdByName: profile?.name || 'مستخدم'
      });

      fetchRequests();
    } catch (err) {
      console.error("Error archiving request:", err);
      alert("حدث خطأ أثناء الأرشفة");
    }
  };

  const getStatusBadge = (status: string, reactivated?: boolean) => {
    if (status === 'pending_law_review' && reactivated) return 'bg-indigo-50 text-indigo-700 border-indigo-100';
    switch (status) {
      case 'pending_law_review': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'approved_preliminary': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'rejected_by_law_firm': return 'bg-rose-50 text-rose-700 border-rose-100';
      case 'case_closed': return 'bg-slate-50 text-slate-700 border-slate-100';
      default: return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  const getStatusIcon = (status: string, reactivated?: boolean) => {
    if (status === 'pending_law_review' && reactivated) return <Clock size={12} />;
    switch (status) {
      case 'pending_law_review': return <Clock size={12} />;
      case 'approved_preliminary': return <CheckCircle2 size={12} className="text-emerald-400" />;
      case 'rejected_by_law_firm': return <XCircle size={12} className="text-rose-400" />;
      case 'case_closed': return <CheckCircle2 size={12} className="text-slate-400" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-8" dir="rtl">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-indigo-600 rounded-[1.25rem] flex items-center justify-center text-white shadow-xl shadow-indigo-100">
            <FileText size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">نظام إدارة الطلبات</h1>
            <p className="text-sm text-slate-500 font-medium">مراجعة وتحويل الطلبات إلى قضايا تنفيذية</p>
          </div>
        </div>

        {canCreateRequest && (
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center justify-center gap-2 px-6 py-4 bg-slate-900 text-white rounded-2xl text-sm font-bold hover:bg-slate-800 transition-all shadow-xl active:scale-95 shrink-0"
          >
            <Plus size={20} />
            <span>إضافة طلب جديد</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-100 mb-6">
        <button
          onClick={() => setActiveTab('active')}
          className={cn(
            "px-6 py-4 -mb-px font-bold text-sm transition-all relative",
            activeTab === 'active' 
              ? "text-indigo-600 border-b-2 border-indigo-600" 
              : "text-slate-400 hover:text-slate-600"
          )}
        >
          الطلبات النشطة ({activeRequests.length})
        </button>
        <button
          onClick={() => setActiveTab('archived')}
          className={cn(
            "px-6 py-4 -mb-px font-bold text-sm transition-all relative",
            activeTab === 'archived' 
              ? "text-red-600 border-b-2 border-red-600" 
              : "text-slate-400 hover:text-slate-600"
          )}
        >
          الأرشيف ({archivedRequests.length})
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">رقم الطلب</label>
            <div className="relative">
              <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text"
                placeholder="أدخل الرقم..."
                value={filters.requestSerialNumber}
                onChange={(e) => setFilters({...filters, requestSerialNumber: e.target.value})}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl pr-11 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">حالة الطلب</label>
            <select 
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700"
            >
              <option value="الكل">جميع الحالات</option>
              <option value="pending_law_review">بانتظار مراجعة المكتب</option>
              <option value="approved_preliminary">مقبول ومحول لقضية</option>
              <option value="rejected_by_law_firm">مرفوض من المكتب</option>
              <option value="case_closed">مغلق ومؤرشف</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">المنصة</label>
            <select 
              value={filters.platform}
              onChange={(e) => setFilters({...filters, platform: e.target.value})}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700"
            >
              <option value="الكل">جميع المنصات</option>
              {platformOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          <div className="flex items-end">
            <button 
              onClick={() => setFilters({ status: 'الكل', platform: 'الكل', requestSerialNumber: '' })}
              className="w-full h-[42px] flex items-center justify-center gap-2 px-4 text-sm font-bold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-dashed border-slate-200"
            >
              <Filter size={16} />
              <span>إعادة الضبط</span>
            </button>
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden overflow-x-auto relative min-h-[400px]">
        {loading ? (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            <span className="text-slate-400 font-bold">جاري تحميل الطلبات...</span>
          </div>
        ) : (
          <table className="w-full text-right border-collapse min-w-[1000px]">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">رقم الطلب</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">نوع المعاملة</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">مقدم الطلب</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">المنفذ ضده</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">المبلغ</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">المنصة</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">الحالة</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">تاريخ الإنشاء</th>
                <th className="px-6 py-5 text-left"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedRequests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-30">
                      <FileText size={64} />
                      <p className="font-bold text-lg">لا يوجد طلبات حالياً</p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedRequests.map((req) => (
                  <tr 
                    key={req.id}
                    onClick={() => {
                      setSelectedRequest(req);
                      setIsDetailsOpen(true);
                    }}
                    className={cn(
                      "hover:bg-slate-50/50 transition-all cursor-pointer group",
                      (req.status === 'archived' || req.status === 'rejected_by_law_firm' || req.status === 'case_closed') ? "bg-rose-50/10 text-rose-950" : "text-slate-700"
                    )}
                  >
                    <td className="px-6 py-5 text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-black text-slate-900 font-mono tracking-tight">{req.requestSerialNumber}</span>
                        {req.najizClaimNumber && <span className="text-[10px] text-indigo-500 font-mono font-bold">ناجز: {req.najizClaimNumber}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black border border-slate-200">
                        {req.transactionType}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700">{req.clientName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">#{req.clientNumber}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{req.defendantName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{req.defendantPhone}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="font-black text-slate-900 font-mono">{(Number(req.claimAmount) || 0).toLocaleString()} <span className="text-[10px] font-bold text-slate-400 mr-1">ر.س</span></span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-100 flex items-center gap-2 w-fit">
                        <Building2 size={12} />
                        {req.platform}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black border w-fit shadow-xs whitespace-nowrap",
                        getStatusBadge(req.status, req.reactivated)
                      )}>
                        {getStatusIcon(req.status, req.reactivated)}
                        {req.status === 'pending' && req.reactivated ? 'قيد المراجعة – معاد تفعيله' : req.statusLabel}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-slate-400 text-xs font-medium font-mono">
                      {req.createdAt?.toDate().toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-6 py-5 text-left">
                      <div className="flex items-center justify-end gap-2">
                        {req.status === 'pending_law_review' && (
                          <button
                            onClick={(e) => handleArchiveRequest(e, req.id, req)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                            title="أرشفة"
                          >
                            <ArchiveIcon size={16} />
                          </button>
                        )}
                        {req.caseId ? (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/cases/${req.caseId}`);
                            }}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                            title="فتح القضية"
                          >
                            <ExternalLink size={18} />
                          </button>
                        ) : (
                          <div className="p-2 text-slate-300">
                             <ChevronLeft size={18} />
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Request Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl max-h-[90vh] overflow-y-auto"
              dir="rtl"
            >
              <div className="p-8 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white">
                      <Plus size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-slate-900">إنشاء طلب جديد</h2>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">أدخل البيانات الأساسية للطلب</p>
                    </div>
                  </div>
                  <button onClick={() => setIsAddModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                    <X size={20} />
                  </button>
                </div>
              </div>

              <form onSubmit={handleAddRequest} className="p-8 pb-12 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Basic Info */}
                  <div className="md:col-span-2">
                    <h3 className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                      <div className="h-px flex-1 bg-indigo-100" />
                      <span>البيانات الأساسية</span>
                      <div className="h-px flex-1 bg-indigo-100" />
                    </h3>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">مقدم الطلب (المنفذ له)</label>
                    <select 
                      required
                      value={formData.clientId}
                      onChange={(e) => {
                        const selected = requestors.find(r => r.id === e.target.value);
                        setFormData({...formData, clientId: e.target.value, clientName: selected?.name || ''});
                      }}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-bold text-slate-700"
                    >
                      <option value="">اختر مقدم الطلب...</option>
                      {requestors.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">رقم العميل</label>
                    <input 
                      required
                      type="text"
                      value={formData.clientNumber}
                      onChange={(e) => setFormData({...formData, clientNumber: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-bold text-slate-700 font-mono"
                      placeholder="رقم العميل في السجلات"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">نوع المعاملة</label>
                    <select 
                      required
                      value={formData.transactionType}
                      onChange={(e) => setFormData({...formData, transactionType: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-bold text-slate-700"
                    >
                      <option value="">اختر نوع المعاملة...</option>
                      {transactionTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">المنصة</label>
                    <select 
                      required
                      value={formData.platform}
                      onChange={(e) => setFormData({...formData, platform: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-bold text-slate-700"
                    >
                      <option value="">اختر المنصة...</option>
                      {platformOptions.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>

                  {/* Financial & References */}
                  <div className="md:col-span-2 pt-4">
                    <h3 className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                      <div className="h-px flex-1 bg-indigo-100" />
                      <span>المبالغ والمراجِع</span>
                      <div className="h-px flex-1 bg-indigo-100" />
                    </h3>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">رقم المطالبة في ناجز (إن وجد)</label>
                    <input 
                      type="text"
                      value={formData.najizClaimNumber}
                      onChange={(e) => setFormData({...formData, najizClaimNumber: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-bold text-slate-700 font-mono"
                      placeholder="رقم طلب التنفيذ في ناجز"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">الرقم المرجعي الإلكتروني</label>
                    <input 
                      required
                      type="text"
                      value={formData.electronicReferenceNumber}
                      onChange={(e) => setFormData({...formData, electronicReferenceNumber: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-bold text-slate-700 font-mono"
                      placeholder="رقم المرجع الإلكتروني"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">مبلغ المطالبة</label>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">ر.س</span>
                      <input 
                        required
                        type="number"
                        step="0.01"
                        value={formData.claimAmount}
                        onChange={(e) => setFormData({...formData, claimAmount: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-black text-slate-900 font-mono"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">مبلغ الكمبيالة</label>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">ر.س</span>
                      <input 
                        required
                        type="number"
                        step="0.01"
                        value={formData.promissoryNoteAmount}
                        onChange={(e) => setFormData({...formData, promissoryNoteAmount: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-black text-slate-900 font-mono"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Defendant Info */}
                  <div className="md:col-span-2 pt-4">
                    <h3 className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                      <div className="h-px flex-1 bg-indigo-100" />
                      <span>بيانات المنفذ ضده</span>
                      <div className="h-px flex-1 bg-indigo-100" />
                    </h3>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">اسم المنفذ ضده</label>
                    <input 
                      required
                      type="text"
                      value={formData.defendantName}
                      onChange={(e) => setFormData({...formData, defendantName: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-bold text-slate-700"
                      placeholder="اسم الطرف الآخر"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">رقم جوال المنفذ ضده</label>
                    <div className="relative">
                      <Phone size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        required
                        type="tel"
                        value={formData.defendantPhone}
                        onChange={(e) => setFormData({...formData, defendantPhone: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl pr-12 py-4 focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-bold text-slate-700 font-mono"
                        placeholder="05xxxxxxxx"
                      />
                    </div>
                  </div>

                  {/* Assigned Employee Section */}
                  <div className="md:col-span-2 pt-4">
                    <h3 className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                      <div className="h-px flex-1 bg-indigo-100" />
                      <span>تكليف وتعيين الموظف المسؤول</span>
                      <div className="h-px flex-1 bg-indigo-100" />
                    </h3>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">الموظف المكلف بالمتابعة والمعالجة</label>
                    {loadingEmployees ? (
                      <div className="text-xs text-slate-400 animate-pulse py-2">جاري تحميل قائمة الموظفين...</div>
                    ) : (
                      <select 
                        value={formData.assignedEmployeeId}
                        onChange={(e) => {
                          const empId = e.target.value;
                          const selectedEmp = employees.find(emp => emp.uid === empId);
                          setFormData({
                            ...formData,
                            assignedEmployeeId: empId,
                            assignedEmployeeName: selectedEmp ? selectedEmp.name : ''
                          });
                        }}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-bold text-slate-705 text-slate-900 dark:text-white"
                      >
                        <option value="" className="text-slate-500">-- اختياري: غير مسند حالياً --</option>
                        {employees.map((emp) => (
                          <option key={emp.uid || emp.id} value={emp.uid || emp.id} className="text-slate-900">
                            👤 {emp.name || emp.fullName} | عبء التكليفات: ({emp.activeRequestsCount}) طلبات نشطة
                          </option>
                        ))}
                      </select>
                    )}
                    <span className="text-[10px] text-slate-450 dark:text-slate-500 leading-tight block">يساعد إسناد الموظف عند إنشاء الطلب على المتابعة الفورية والتكامل التلقائي مع لوحات التكليفات.</span>
                  </div>

                  {/* Attachments Section */}
                  <div className="md:col-span-2 pt-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em] flex items-center gap-2">
                        <div className="h-px w-8 bg-indigo-100" />
                        <span>مرفقات المعاملة (حتى 5 مرفقات)</span>
                      </h3>
                      {formData.attachments.length < 5 && (
                        <button 
                          type="button"
                          onClick={() => setFormData({
                            ...formData, 
                            attachments: [...formData.attachments, { type: '', url: '', customLabel: '' }]
                          })}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black hover:bg-indigo-100 transition-all"
                        >
                          <Plus size={14} />
                          إضافة مرفق
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-4">
                    {formData.attachments.map((attachment, idx) => (
                      <div key={idx} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4 relative group">
                        {formData.attachments.length > 1 && (
                          <button 
                            type="button"
                            onClick={() => {
                              const newAttachments = [...formData.attachments];
                              newAttachments.splice(idx, 1);
                              setFormData({...formData, attachments: newAttachments});
                            }}
                            className="absolute top-4 left-4 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          >
                            <X size={16} />
                          </button>
                        )}
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">نوع المرفق</label>
                            <select 
                              required
                              value={attachment.type}
                              onChange={(e) => {
                                const newAttachments = [...formData.attachments];
                                newAttachments[idx].type = e.target.value;
                                if (e.target.value !== 'other') newAttachments[idx].customLabel = '';
                                setFormData({...formData, attachments: newAttachments});
                              }}
                              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            >
                              <option value="">اختر نوع الملف...</option>
                              {attachmentTypes.map(type => (
                                <option key={type.value} value={type.value}>{type.label}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">رابط الملف</label>
                            <input 
                              required
                              type="url"
                              value={attachment.url}
                              onChange={(e) => {
                                const newAttachments = [...formData.attachments];
                                newAttachments[idx].url = e.target.value;
                                setFormData({...formData, attachments: newAttachments});
                              }}
                              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                              placeholder="https://..."
                            />
                          </div>

                          {attachment.type === 'other' && (
                            <div className="md:col-span-2 space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">اسم المرفق المخصص</label>
                              <input 
                                required
                                type="text"
                                value={attachment.customLabel}
                                onChange={(e) => {
                                  const newAttachments = [...formData.attachments];
                                  newAttachments[idx].customLabel = e.target.value;
                                  setFormData({...formData, attachments: newAttachments});
                                }}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                placeholder="مثلاً: صورة الصك، عقد الإيجار..."
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Telegram Notifications Section */}
                  <div className="md:col-span-2 pt-4">
                    <div 
                      className="bg-slate-50 border border-slate-200 rounded-3xl overflow-hidden shadow-sm"
                    >
                      <button 
                        type="button"
                        onClick={() => setShowNotificationOptions(!showNotificationOptions)}
                        className="w-full flex items-center justify-between p-5 hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                            <MessageSquare size={20} />
                          </div>
                          <div className="text-right">
                            <h3 className="font-black text-slate-800 text-sm">📲 إشعارات تيليجرام (اختياري)</h3>
                            <p className="text-[10px] font-bold text-slate-400">حدد من سيستلم إشعار هذا الطلب</p>
                          </div>
                        </div>
                        {showNotificationOptions ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                      </button>

                      {showNotificationOptions && (
                        <div className="p-6 border-t border-slate-100 space-y-4">
                          <label className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-2xl cursor-pointer hover:bg-blue-50/30 transition-all">
                             <div className="relative">
                               <input 
                                 type="checkbox"
                                 checked={selectedRecipients.companyAccount}
                                 onChange={(e) => setSelectedRecipients({...selectedRecipients, companyAccount: e.target.checked})}
                                 className="peer sr-only"
                               />
                               <div className="w-6 h-6 bg-white border-2 border-slate-200 rounded-lg peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-all flex items-center justify-center">
                                 <CheckCircle2 size={14} className="text-white opacity-0 peer-checked:opacity-100" />
                               </div>
                             </div>
                             <div className="flex flex-col">
                               <span className="text-sm font-bold text-slate-700">إرسال لحساب الشركة</span>
                               <span className="text-[10px] font-bold text-slate-400">المعرف: 218601139</span>
                             </div>
                          </label>

                          <label className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-2xl cursor-pointer hover:bg-blue-50/30 transition-all">
                             <div className="relative">
                               <input 
                                 type="checkbox"
                                 checked={selectedRecipients.allAdmins}
                                 onChange={(e) => setSelectedRecipients({...selectedRecipients, allAdmins: e.target.checked})}
                                 className="peer sr-only"
                               />
                               <div className="w-6 h-6 bg-white border-2 border-slate-200 rounded-lg peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-all flex items-center justify-center">
                                 <CheckCircle2 size={14} className="text-white opacity-0 peer-checked:opacity-100" />
                               </div>
                             </div>
                             <div className="flex flex-col">
                               <span className="text-sm font-bold text-slate-700">إرسال لكل المدراء</span>
                               <span className="text-[10px] font-bold text-slate-400">سيتم الإرسال لجميع الحسابات بصلاحية مدير</span>
                             </div>
                          </label>

                          <div className="pt-2">
                             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 mr-1">إرسال لموظفين محددين</h4>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                               {telegramUsers.length === 0 ? (
                                 <div className="col-span-2 p-4 bg-white border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400 font-bold">
                                   لا يوجد موظفين مسجلين بحساب تيليجرام
                                 </div>
                               ) : (
                                 telegramUsers.map(u => (
                                   <label key={u.id} className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-2xl cursor-pointer hover:bg-blue-50/30 transition-all">
                                     <div className="relative">
                                       <input 
                                         type="checkbox"
                                         checked={selectedRecipients.userIds.includes(u.id)}
                                         onChange={(e) => {
                                           if (e.target.checked) {
                                             setSelectedRecipients({...selectedRecipients, userIds: [...selectedRecipients.userIds, u.id]});
                                           } else {
                                             setSelectedRecipients({...selectedRecipients, userIds: selectedRecipients.userIds.filter(id => id !== u.id)});
                                           }
                                         }}
                                         className="peer sr-only"
                                       />
                                       <div className="w-6 h-6 bg-white border-2 border-slate-200 rounded-lg peer-checked:bg-slate-900 peer-checked:border-slate-900 transition-all flex items-center justify-center">
                                         <CheckCircle2 size={14} className="text-white opacity-0 peer-checked:opacity-100" />
                                       </div>
                                     </div>
                                     <div className="flex flex-col">
                                       <span className="text-sm font-bold text-slate-700">{u.name}</span>
                                       <span className="text-[10px] font-bold text-slate-400">{u.roleLabel}</span>
                                     </div>
                                   </label>
                                 ))
                               )}
                             </div>
                          </div>

                          <div className="flex gap-2 pt-2">
                             <button 
                               type="button"
                               onClick={() => setSelectedRecipients({ companyAccount: true, allAdmins: true, userIds: telegramUsers.map(u => u.id) })}
                               className="px-3 py-1.5 bg-slate-900 text-white text-[10px] font-black rounded-lg hover:bg-slate-800 transition-all shadow-sm"
                             >
                               تحديد الكل
                             </button>
                             <button 
                               type="button"
                               onClick={() => setSelectedRecipients({ companyAccount: false, allAdmins: false, userIds: [] })}
                               className="px-3 py-1.5 bg-white text-slate-500 border border-slate-200 text-[10px] font-black rounded-lg hover:bg-slate-50 transition-all shadow-sm"
                             >
                               إلغاء التحديد
                             </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-indigo-600 text-white rounded-2xl py-4 font-black transition-all hover:bg-indigo-700 shadow-xl shadow-indigo-100 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={20} />}
                    <span>إرسال الطلب للمراجعة</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-8 bg-slate-50 text-slate-600 rounded-2xl py-4 font-bold hover:bg-slate-100 transition-all border border-slate-100"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Details Drawer */}
      <AnimatePresence>
        {isDetailsOpen && selectedRequest && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDetailsOpen(false)}
              className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-xl bg-white shadow-2xl h-full overflow-y-auto"
              dir="rtl"
            >
              {/* Drawer Header */}
              <div className="p-8 border-b border-slate-100 sticky top-0 bg-white z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black border w-fit shadow-xs",
                    getStatusBadge(selectedRequest.status, selectedRequest.reactivated)
                  )}>
                    {getStatusIcon(selectedRequest.status, selectedRequest.reactivated)}
                    {selectedRequest.status === 'pending' && selectedRequest.reactivated ? 'قيد المراجعة – معاد تفعيله' : selectedRequest.statusLabel}
                  </div>
                  <button onClick={() => setIsDetailsOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                    <X size={20} />
                  </button>
                </div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">
                  طلب مراجعة قضية
                  <span className="block text-base font-mono text-indigo-600 mt-1">#{selectedRequest.requestSerialNumber}</span>
                </h2>
              </div>

              {/* Drawer Content */}
              <div className="p-8 space-y-10 pb-20">
                {/* Main Stats */}
                <div className="grid grid-cols-2 gap-4">
                   <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">مبلغ المطالبة</span>
                     <div className="text-2xl font-black text-slate-900 font-mono tracking-tighter">
                       {selectedRequest.claimAmount.toLocaleString()}
                       <span className="text-xs font-bold text-slate-400 mr-1">ر.س</span>
                     </div>
                   </div>
                   <div className="p-6 bg-indigo-50 rounded-[2rem] border border-indigo-100">
                     <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-2">نوع المعاملة</span>
                     <div className="text-xl font-black text-indigo-700 truncate">
                       {selectedRequest.transactionType}
                     </div>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">مبلغ الكمبيالة</span>
                     <div className="text-lg font-black text-slate-900 font-mono">
                       {(selectedRequest.promissoryNoteAmount || 0).toLocaleString()} <span className="text-[10px] mr-1">ر.س</span>
                     </div>
                   </div>
                   <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">المنصة</span>
                     <div className="text-lg font-black text-slate-900">
                       {selectedRequest.platform}
                     </div>
                   </div>
                </div>

                {/* Info List */}
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">مقدم الطلب</span>
                      <p className="text-lg font-bold text-slate-900">{selectedRequest.clientName}</p>
                      <span className="text-xs font-mono text-slate-400 font-bold tracking-widest">عميل رقم: {selectedRequest.clientNumber}</span>
                    </div>
                  </div>

                  <div className="p-6 bg-slate-900 rounded-[2rem] text-white">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white shrink-0">
                        <Calendar size={20} />
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest block">المنفذ ضده</span>
                        <p className="text-lg font-bold text-white">{selectedRequest.defendantName}</p>
                        <div className="flex items-center gap-1.5 text-xs font-mono text-white/50 mt-1 font-bold">
                          <Phone size={12} />
                          {selectedRequest.defendantPhone}
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/10">
                       <div>
                         <span className="text-[10px] font-black text-white/40 uppercase tracking-widest block mb-1">الرقم المرجعي الإلكتروني</span>
                         <p className="font-mono font-bold text-indigo-400">{selectedRequest.electronicReferenceNumber || '—'}</p>
                       </div>
                       <div>
                         <span className="text-[10px] font-black text-white/40 uppercase tracking-widest block mb-1">مرجع ناجز</span>
                         <p className="font-mono font-bold text-indigo-400">{selectedRequest.najizClaimNumber || '—'}</p>
                       </div>
                    </div>
                  </div>

                  {/* Attachments Section */}
                  <div className="space-y-4 pt-4">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                       <ExternalLink size={14} />
                       <span>ملفات المعاملة ({selectedRequest.attachments?.length || 0})</span>
                    </h3>
                    
                    <div className="grid grid-cols-1 gap-2">
                      {selectedRequest.attachments && selectedRequest.attachments.length > 0 ? (
                        selectedRequest.attachments.map((att, idx) => (
                          <a 
                            key={idx}
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-100 rounded-2xl transition-all group"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-400 group-hover:text-indigo-600 shadow-sm transition-colors">
                                <FileText size={16} />
                              </div>
                              <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-700 transition-colors">
                                {getAttachmentLabel(att.type, att.customLabel)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                               <span className="text-[10px] font-black text-slate-300 group-hover:text-indigo-400 uppercase tracking-widest">فتح الملف</span>
                               <ChevronLeft size={16} className="text-slate-300 group-hover:text-indigo-400 transition-colors" />
                            </div>
                          </a>
                        ))
                      ) : (
                        <div className="py-8 text-center text-slate-400 text-xs italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                          لا توجد مرفقات لهذا الطلب
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Reactivation Log */}
                {selectedRequest.reactivated && (
                  <div className="p-6 bg-indigo-50/50 rounded-[2rem] border border-indigo-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                        <Clock size={14} />
                        <span>سجل إعادة التفعيل</span>
                      </h3>
                      <a 
                        href={buildWhatsAppLink(selectedRequest.defendantPhone, `تم إعادة تفعيل الطلب ${selectedRequest.requestSerialNumber}. السبب: ${selectedRequest.reactivatedReason}`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[9px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-lg hover:bg-green-100 transition-colors"
                      >
                        <Phone size={10} />
                        مشاركة واتساب
                      </a>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">تم بواسطة:</span>
                        <span className="font-bold text-slate-700">{selectedRequest.reactivatedBy || 'النظام'}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">تاريخ الإعادة:</span>
                        <span className="font-bold text-slate-700 font-mono">{selectedRequest.reactivatedAt?.toDate().toLocaleString('ar-SA')}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">تحديث المرفقات:</span>
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold",
                          selectedRequest.attachmentsUpdated ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"
                        )}>
                          {selectedRequest.attachmentsUpdated ? 'نعم' : 'لا'}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-indigo-100/50">
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-1">سبب إعادة التفعيل</span>
                        <p className="text-sm font-bold text-slate-700 leading-relaxed bg-white/50 p-3 rounded-xl">
                          {selectedRequest.reactivatedReason}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Timeline / Action Log */}
                <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <HistoryIcon size={14} />
                    <span>سجل الإجراءات</span>
                  </h3>
                  
                  <div className="relative space-y-8 pr-4">
                    <div className="absolute top-0 bottom-0 right-0 w-px bg-slate-200" />
                    
                    {/* Creation */}
                    <div className="relative pr-8">
                       <div className="absolute top-0 right-[-4.5px] w-2 h-2 rounded-full bg-slate-400" />
                       <div className="space-y-1">
                         <p className="text-xs font-bold text-slate-700">تم إنشاء الطلب بواسطة <span className="text-indigo-600">{allUsers[selectedRequest.createdBy] || '...'}</span></p>
                         <p className="text-[10px] text-slate-400 font-mono">{selectedRequest.createdAt?.toDate().toLocaleString('ar-SA')}</p>
                       </div>
                    </div>

                    {/* Preliminary Approval */}
                    {selectedRequest.approvedPreliminaryAt && (
                      <div className="relative pr-8">
                         <div className="absolute top-0 right-[-4.5px] w-2 h-2 rounded-full bg-green-500" />
                         <div className="space-y-1">
                           <p className="text-xs font-bold text-slate-700">تم القبول المبدئي بواسطة <span className="text-indigo-600">{allUsers[selectedRequest.approvedPreliminaryBy!] || '...'}</span></p>
                           <p className="text-[10px] text-slate-400 font-mono">{selectedRequest.approvedPreliminaryAt?.toDate().toLocaleString('ar-SA')}</p>
                           {selectedRequest.approvalNote && (
                             <p className="text-[11px] bg-white p-2 rounded-lg border border-slate-100 mt-2 text-slate-600 italic">"{selectedRequest.approvalNote}"</p>
                           )}
                         </div>
                      </div>
                    )}

                    {/* Rejection */}
                    {selectedRequest.reviewedAt && selectedRequest.status === 'rejected_by_law_firm' && (
                      <div className="relative pr-8">
                         <div className="absolute top-0 right-[-4.5px] w-2 h-2 rounded-full bg-red-500" />
                         <div className="space-y-1">
                           <p className="text-xs font-bold text-slate-700">تم رفض الطلب بواسطة <span className="text-indigo-600">{allUsers[selectedRequest.reviewedBy!] || '...'}</span></p>
                           <p className="text-[10px] text-slate-400 font-mono">{selectedRequest.reviewedAt?.toDate().toLocaleString('ar-SA')}</p>
                           <p className="text-[11px] bg-red-50 text-red-700 p-2 rounded-lg border border-red-100 mt-2">السبب: {selectedRequest.rejectionReason}</p>
                         </div>
                      </div>
                    )}

                    {/* Conversion */}
                    {selectedRequest.convertedAt && (
                      <div className="relative pr-8">
                         <div className="absolute top-0 right-[-4.5px] w-2 h-2 rounded-full bg-indigo-600" />
                         <div className="space-y-1">
                           <p className="text-xs font-bold text-slate-700">تم التحويل لقضية بواسطة <span className="text-indigo-600">{allUsers[selectedRequest.convertedBy!] || '...'}</span></p>
                           <p className="text-[10px] text-slate-400 font-mono">{selectedRequest.convertedAt?.toDate().toLocaleString('ar-SA')}</p>
                           <div className="mt-2 p-3 bg-white border border-indigo-100 rounded-xl shadow-sm space-y-1">
                              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">تفاصيل القضية</p>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500">رقم القضية:</span>
                                <span className="font-bold text-slate-900 font-mono">{selectedRequest.caseId}</span>
                              </div>
                           </div>
                         </div>
                      </div>
                    )}

                    {/* Reactivation */}
                    {selectedRequest.reactivatedAt && (
                      <div className="relative pr-8">
                         <div className="absolute top-0 right-[-4.5px] w-2 h-2 rounded-full bg-amber-500" />
                         <div className="space-y-1">
                           <p className="text-xs font-bold text-slate-700">تم إعادة تفعيل الطلب بواسطة <span className="text-indigo-600">{allUsers[selectedRequest.reactivatedBy!] || '...'}</span></p>
                           <p className="text-[10px] text-slate-400 font-mono">{selectedRequest.reactivatedAt?.toDate().toLocaleString('ar-SA')}</p>
                           <p className="text-[11px] bg-amber-50 text-amber-800 p-2 rounded-lg border border-amber-100 mt-2">السبب: {selectedRequest.reactivatedReason}</p>
                         </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Audit Trail */}
                <div className="border-t border-slate-100 pt-8 space-y-4">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">سجل المراجعة</h3>
                  <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold">
                       <span className="text-slate-400">تاريخ الإنشاء:</span>
                       <span className="text-slate-700 font-mono">{selectedRequest.createdAt?.toDate().toLocaleString('ar-SA')}</span>
                    </div>
                    {selectedRequest.reviewedAt && (
                      <div className="flex items-center justify-between text-xs font-bold pt-3 border-t border-slate-200/50">
                        <span className="text-slate-400">تاريخ المراجعة:</span>
                        <span className="text-slate-700 font-mono">{selectedRequest.reviewedAt?.toDate().toLocaleString('ar-SA')}</span>
                      </div>
                    )}
                  </div>

                  {selectedRequest.rejectionReason && (
                    <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex gap-3 text-red-700">
                      <AlertTriangle size={20} className="shrink-0" />
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest mb-1">سبب الرفض:</p>
                        <p className="text-sm font-bold">{selectedRequest.rejectionReason}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Request Actions */}
                <div className="pt-10 sticky bottom-0 bg-white pb-8 space-y-3">
                  {selectedRequest.status === 'pending_law_review' && canReviewRequest && (
                    <div className="flex gap-3">
                      <button 
                        onClick={() => setIsApproveModalOpen(true)}
                        disabled={isSubmitting}
                        className="flex-1 bg-green-600 text-white rounded-[1.5rem] py-4 font-black transition-all hover:bg-green-700 shadow-xl shadow-green-100 flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 size={20} />
                        <span>قبول الطلب ومحول لقضية</span>
                      </button>
                      <button 
                        onClick={() => setIsRejectModalOpen(true)}
                        disabled={isSubmitting}
                        className="px-8 bg-red-50 text-red-600 rounded-[1.5rem] py-4 font-black transition-all hover:bg-red-100 flex items-center justify-center gap-2"
                      >
                        <span>رفض</span>
                      </button>
                    </div>
                  )}

                  {selectedRequest.status === 'rejected_by_law_firm' && canReactivate && (
                    <button 
                      onClick={() => setIsReactivateModalOpen(true)}
                      disabled={isSubmitting}
                      className="w-full bg-indigo-600 text-white rounded-[1.5rem] py-4 font-black transition-all hover:bg-indigo-700 shadow-xl shadow-indigo-100 flex items-center justify-center gap-2"
                    >
                      <Clock size={20} />
                      <span>إعادة تفعيل الطلب</span>
                    </button>
                  )}

                  {selectedRequest.caseId && (
                    <button 
                      onClick={() => navigate(`/cases/${selectedRequest.caseId}`)}
                      className="w-full bg-slate-900 text-white rounded-[1.5rem] py-4 font-black transition-all hover:bg-slate-800 flex items-center justify-center gap-2"
                    >
                      <ExternalLink size={20} />
                      <span>فتح القضية التنفيذية الحالية</span>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reject Reason Modal */}
      <AnimatePresence>
        {isRejectModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsRejectModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto"
              dir="rtl"
            >
              <div className="flex items-center gap-4 mb-6">
                 <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center">
                    <AlertTriangle size={24} />
                 </div>
                 <div>
                    <h3 className="text-xl font-black text-slate-900">توضيح سبب الرفض</h3>
                    <p className="text-sm font-bold text-slate-400">يجب كتابة سبب واضح ليتمكن مقدم الطلب من المعالجة</p>
                 </div>
              </div>

              <textarea 
                required
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="اكتب سبب الرفض هنا..."
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-6 min-h-[150px] focus:ring-2 focus:ring-red-600 outline-none transition-all font-medium text-slate-700"
              />

              <div className="flex gap-3 mt-8">
                 <button 
                  onClick={handleRejectRequest}
                  disabled={!rejectionReason || isSubmitting}
                  className="flex-1 bg-red-600 text-white rounded-2xl py-4 font-black transition-all hover:bg-red-700 shadow-xl shadow-red-100 flex items-center justify-center gap-2"
                 >
                   {isSubmitting ? <Loader2 className="animate-spin" /> : <XCircle size={18} />}
                   <span>تأكيد الرفض</span>
                 </button>
                 <button 
                  onClick={() => setIsRejectModalOpen(false)}
                  className="px-8 bg-slate-50 text-slate-600 rounded-2xl py-4 font-bold border border-slate-100"
                 >
                   إلغاء
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Approve Preliminary Modal */}
      <AnimatePresence>
        {isApproveModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsApproveModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto"
              dir="rtl"
            >
              <div className="flex items-center gap-4 mb-6">
                 <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center">
                    <CheckCircle2 size={24} />
                 </div>
                 <div>
                    <h3 className="text-xl font-black text-slate-900">قبول الطلب مبدئياً</h3>
                    <p className="text-sm font-bold text-slate-400">تأكيد صحة البيانات والمستندات</p>
                 </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">ملاحظات الاعتماد (اختياري)</label>
                  <textarea 
                    value={approvalNote}
                    onChange={(e) => setApprovalNote(e.target.value)}
                    placeholder="أدخل أي ملاحظات حول مراجعة هذا الطلب..."
                    rows={4}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-6 min-h-[120px] focus:ring-2 focus:ring-green-600 outline-none transition-all font-medium text-slate-700"
                  />
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={handleApprovePreliminary}
                    disabled={isSubmitting}
                    className="flex-1 bg-green-600 text-white rounded-2xl py-4 font-black transition-all hover:bg-green-700 shadow-xl shadow-green-100 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={18} />}
                    <span>تأكيد القبول المبدئي</span>
                  </button>
                  <button 
                    onClick={() => setIsApproveModalOpen(false)}
                    className="px-8 bg-slate-50 text-slate-600 rounded-2xl py-4 font-bold border border-slate-100"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Convert to Case Modal */}
      <AnimatePresence>
        {isConvertModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsConvertModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto custom-scrollbar"
              dir="rtl"
            >
              <div className="flex items-center gap-4 mb-8">
                 <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                    <ExternalLink size={24} />
                 </div>
                 <div>
                    <h3 className="text-xl font-black text-slate-900">التحويل لقضية تنفيذية</h3>
                    <p className="text-sm font-bold text-slate-400">بدأ ملف القضية في النظام وتوثيق المراجع الخارجية</p>
                 </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">رقم الطلب/القضية الخارجي (اختياري)</label>
                  <input 
                    type="text"
                    value={convertData.externalCaseNumber}
                    onChange={(e) => setConvertData({...convertData, externalCaseNumber: e.target.value})}
                    placeholder="مثلاً رقم الصك أو رقم المتابعة في ناجز..."
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-bold text-slate-700 font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">تاريخ البدء</label>
                    <input 
                      type="date"
                      value={convertData.startDate}
                      onChange={(e) => setConvertData({...convertData, startDate: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-bold text-slate-700 font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">حالة القضية</label>
                    <select 
                      value={convertData.caseStatus}
                      onChange={(e) => setConvertData({...convertData, caseStatus: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-bold text-slate-700"
                    >
                      <option value="open">مفتوحة</option>
                      <option value="in_progress">قيد التنفيذ</option>
                      <option value="closed">منتهية</option>
                    </select>
                  </div>
                </div>

                <div className="bg-indigo-50/50 rounded-2xl p-6 border border-indigo-100 space-y-4">
                   <div className="flex items-center gap-3 text-indigo-600 font-black text-xs uppercase tracking-widest">
                      <AlertTriangle size={16} />
                      تأكيد التحويل
                   </div>
                   <p className="text-xs font-bold text-indigo-400 leading-relaxed">
                      عند التحويل، سيتم إنشاء سجل قضية جديد مرتبط بهذا الطلب، وسيتم نقل كافة المرفقات والبيانات المالية. لا يمكن التراجع عن هذه الخطوة.
                   </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={handleConvertToCase}
                    disabled={isSubmitting}
                    className="flex-1 bg-indigo-600 text-white rounded-2xl py-4 font-black transition-all hover:bg-indigo-700 shadow-xl shadow-indigo-100 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={18} />}
                    <span>تأكيد التحويل وإنشاء القضية</span>
                  </button>
                  <button 
                    onClick={() => setIsConvertModalOpen(false)}
                    className="px-8 bg-slate-50 text-slate-600 rounded-2xl py-4 font-bold border border-slate-100"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reactivate Modal */}
      <AnimatePresence>
        {isReactivateModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsReactivateModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto"
              dir="rtl"
            >
              <div className="flex items-center gap-4 mb-6">
                 <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                    <Clock size={24} />
                 </div>
                 <div>
                    <h3 className="text-xl font-black text-slate-900">إعادة تفعيل الطلب</h3>
                    <p className="text-sm font-bold text-slate-400">توضيح أسباب إعادة التفعيل وتحديث الحالة</p>
                 </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">سبب إعادة التفعيل (إلزامي)</label>
                  <textarea 
                    required
                    value={reactivateData.reason}
                    onChange={(e) => setReactivateData({...reactivateData, reason: e.target.value})}
                    placeholder="لماذا يتم إعادة تفعيل هذا الطلب؟ اذكر التعديلات التي تمت..."
                    rows={4}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-6 min-h-[120px] focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-medium text-slate-700"
                  />
                </div>

                <label className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl cursor-pointer group hover:bg-indigo-50 hover:border-indigo-100 transition-all">
                  <div className="relative">
                    <input 
                      type="checkbox"
                      checked={reactivateData.attachmentsUpdated}
                      onChange={(e) => setReactivateData({...reactivateData, attachmentsUpdated: e.target.checked})}
                      className="peer sr-only"
                    />
                    <div className="w-6 h-6 bg-white border-2 border-slate-200 rounded-lg peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-all flex items-center justify-center">
                      <CheckCircle2 size={14} className="text-white opacity-0 peer-checked:opacity-100" />
                    </div>
                  </div>
                  <span className="text-sm font-bold text-slate-700">تم تحديث المستندات / المرفقات الخاصة بالطلب</span>
                </label>

                <div className="flex gap-3">
                  <button 
                    onClick={handleReactivateRequest}
                    disabled={!reactivateData.reason || isSubmitting}
                    className="flex-1 bg-indigo-600 text-white rounded-2xl py-4 font-black transition-all hover:bg-indigo-700 shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" /> : <Clock size={18} />}
                    <span>تأكيد إعادة التفعيل</span>
                  </button>
                  <button 
                    onClick={() => setIsReactivateModalOpen(false)}
                    className="px-8 bg-slate-50 text-slate-600 rounded-2xl py-4 font-bold border border-slate-100"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
