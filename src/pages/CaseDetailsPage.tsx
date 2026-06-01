import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, addDoc, updateDoc, serverTimestamp, query, orderBy, Timestamp, where } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { createCaseEvent } from '../services/eventService';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronRight, 
  Calendar, 
  FileText, 
  CreditCard, 
  Activity as ActivityIcon, 
  Plus, 
  Loader2, 
  Clock, 
  User, 
  ExternalLink,
  Edit,
  Save,
  X,
  Info,
  Hash,
  Scale,
  Briefcase,
  UserCheck,
  Globe,
  TrendingUp,
  AlertCircle,
  Phone
} from 'lucide-react';
import { cn } from '../lib/utils';
import CasePaymentsTab from '../components/CasePaymentsTab';

type TabType = 'activities' | 'documents' | 'finance' | 'sessions';

export default function CaseDetailsPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [caseData, setCaseData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<TabType>('activities');
  const [platformOptions, setPlatformOptions] = useState<string[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState<any>({});

  const canAddItems = ['admin', 'company_manager', 'assistant_manager', 'law_firm_manager', 'law_firm_assistant'].includes(profile?.role || '');
  const canEditCase = ['admin', 'company_manager', 'assistant_manager', 'law_firm_manager'].includes(profile?.role || '');
  
  // Subcollections data
  const [tabData, setTabData] = useState<any[]>([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states for adding items
  const [activityForm, setActivityForm] = useState({ description: '', type: 'note' });
  const [documentForm, setDocumentForm] = useState({ name: '', url: '', type: 'pdf' });
  const [sessionForm, setSessionForm] = useState({ 
    sessionDate: '', 
    location: '', 
    type: 'استماع',
    notes: ''
  });

  const [statusOptions, setStatusOptions] = useState<any[]>([]);
  const [decisionOptions, setDecisionOptions] = useState<any[]>([
    { code: '', label: 'لا يوجد' },
    { code: '34', label: 'قرار 34' },
    { code: '46', label: 'قرار 46' },
    { code: '34+46', label: 'قرار 34 + 46' },
    { code: 'under_execution', label: 'تحت التنفيذ' },
  ]);

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

  const fetchCase = async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      const activeUser = auth.currentUser;
      if (!activeUser) {
        console.warn("No active user available yet.");
        setLoading(false);
        return;
      }

      const docRef = doc(db, 'cases', caseId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = { id: docSnap.id, caseId: docSnap.id, ...docSnap.data() } as any;
        
        // Authorization check on the client-side matching the backend logic
        const role = profile?.role || '';
        const uid = activeUser.uid;
        const userData = profile || {};

        // Soft delete check
        if (data.isDeleted === true && role !== 'admin') {
          alert('غير مصرح بعرض هذه القضية المؤرشفة');
          navigate('/cases');
          return;
        }

        // Role eligibility check
        let authorized = false;
        if (role === 'admin' || role === 'company_manager' || role === 'assistant_manager') {
          authorized = true;
        } else if (role === 'sales_employee') {
          authorized = data.salesEmployeeId === uid;
        } else if (role === 'law_firm_manager') {
          authorized = !!(userData.lawFirmId && data.lawFirmId === userData.lawFirmId);
        } else if (role === 'law_firm_assistant') {
          authorized = data.assignedAssistantId === uid;
        }

        if (!authorized) {
          alert('ليس لديك صلاحية للاطلاع على هذه القضية');
          navigate('/cases');
          return;
        }

        setCaseData(data);
        
        let formattedDate = '';
        if (data.fileDate) {
          const d = data.fileDate instanceof Timestamp ? data.fileDate.toDate() : new Date(data.fileDate);
          if (!isNaN(d.getTime())) {
            formattedDate = d.toISOString().split('T')[0];
          }
        }
        setEditForm({ ...data, fileDate: formattedDate });
      } else {
        alert('القضية المطلوبة غير موجودة');
        navigate('/cases');
      }
    } catch (error) {
      console.error("Error fetching case:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCase();
    fetchPlatforms();
    fetchStatuses();
    fetchDecisions();
    fetchAllUsers();
  }, [caseId]);

  const [lawFirmManagers, setLawFirmManagers] = useState<any[]>([]);
  const [lawFirmAssistants, setLawFirmAssistants] = useState<any[]>([]);
  const [salesEmployees, setSalesEmployees] = useState<any[]>([]);
  const [transitioning, setTransitioning] = useState(false);
  const [submittingAssignment, setSubmittingAssignment] = useState(false);
  const [assignForm, setAssignForm] = useState({
    assignmentType: 'internal',
    lawFirmId: '',
    assignedAssistantId: '',
    salesEmployeeId: ''
  });

  const fetchAllUsers = async () => {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const usersMap: Record<string, string> = {};
      const lfManagers: any[] = [];
      const lfAssistants: any[] = [];
      const sales: any[] = [];

      usersSnap.docs.forEach(docSnap => {
        const udata = docSnap.data();
        const uid = docSnap.id;
        usersMap[uid] = udata.name || udata.fullName || 'مستخدم';
        
        if (udata.role === 'law_firm_manager') {
          lfManagers.push({ id: uid, name: udata.name || udata.fullName || uid, ...udata });
        } else if (udata.role === 'law_firm_assistant') {
          lfAssistants.push({ id: uid, name: udata.name || udata.fullName || uid, ...udata });
        } else if (udata.role === 'sales_employee') {
          sales.push({ id: uid, name: udata.name || udata.fullName || uid, ...udata });
        }
      });

      setAllUsers(usersMap);
      setLawFirmManagers(lfManagers);
      setLawFirmAssistants(lfAssistants);
      setSalesEmployees(sales);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  useEffect(() => {
    if (caseData) {
      setAssignForm({
        assignmentType: caseData.assignmentType || 'internal',
        lawFirmId: caseData.lawFirmId || '',
        assignedAssistantId: caseData.assignedAssistantId || '',
        salesEmployeeId: caseData.salesEmployeeId || ''
      });
    }
  }, [caseData]);

  const handleTransitionStatus = async (newStatus: string) => {
    if (!caseId || !caseData) return;
    setTransitioning(true);
    try {
      const activeUser = auth.currentUser;
      if (!activeUser) throw new Error("لم يتم تلقيم جلسة التحقق الحالية.");

      const role = profile?.role || '';
      const currentStatus = caseData.status || 'draft';

      // Verify Role Permission
      let authorizedForTransition = false;
      if (role === 'admin' || role === 'company_manager' || role === 'assistant_manager') {
        authorizedForTransition = true;
      } else if (role === 'law_firm_manager') {
        if (currentStatus === 'external_assigned' && newStatus === 'in_court') {
          const pLawFirmId = profile?.lawFirmId || '';
          if (caseData.lawFirmId && caseData.lawFirmId === pLawFirmId) {
            authorizedForTransition = true;
          }
        }
      }

      if (!authorizedForTransition) {
        throw new Error('ليس لديك صلاحية لإجراء هذا الانتقال للحالة');
      }

      // State Machine transitions:
      if (role !== 'admin') {
        let isValidTransition = false;
        if (currentStatus === 'draft' && newStatus === 'under_review') isValidTransition = true;
        if (currentStatus === 'under_review' && (newStatus === 'internal' || newStatus === 'external_assigned')) isValidTransition = true;
        if ((currentStatus === 'internal' || currentStatus === 'external_assigned') && newStatus === 'in_court') isValidTransition = true;
        if (currentStatus === 'in_court' && newStatus === 'closed') isValidTransition = true;

        if (currentStatus === newStatus) isValidTransition = true;

        if (!isValidTransition) {
          throw new Error(`انتقال غير مسموح به من حالة (${currentStatus}) إلى حالة (${newStatus}). تسلسل المراحل: مسودة ← تحت المراجعة ← داخلية/إسناد خارجي ← بالمحكمة ← مغلقة`);
        }
      }

      // Check fields
      if (newStatus === 'external_assigned') {
        if (!caseData.lawFirmId) {
          throw new Error('لا يمكن تحويل القضية لجهات خارجية دون تحديد مكتب المحاماة الشريك');
        }
      }

      // Cannot move to in_court unless there is at least one session scheduled
      if (newStatus === 'in_court') {
        const globalSessionsRef = collection(db, 'case_sessions');
        const qGlobal = query(globalSessionsRef, where('caseId', '==', caseId));
        const globalSnap = await getDocs(qGlobal);

        const subSessionsRef = collection(db, 'cases', caseId, 'sessions');
        const subSnap = await getDocs(subSessionsRef);

        const totalSessionsCount = globalSnap.size + subSnap.size;
        if (totalSessionsCount === 0) {
          throw new Error('لا يمكن نقل القضية للمحكمة إلا بعد تسجيل موعد جلسة واحدة على الأقل');
        }
      }

      // Cannot move to closed unless financials are resolved
      if (newStatus === 'closed') {
        const plansSnapshot = await getDocs(query(collection(db, 'payment_plans'), where('caseId', '==', caseId), where('isDeleted', '==', false)));
        let hasUnpaidInstallments = false;
        plansSnapshot.forEach((doc) => {
          const plan = doc.data();
          if (plan.status !== 'paid' && plan.status !== 'partially_paid') {
            hasUnpaidInstallments = true;
          }
        });

        if (hasUnpaidInstallments) {
          throw new Error('تنبيه مالي: لا يمكن إغلاق القضية قبل تحصيل أو تسوية الأقساط المجدولة والمعلقة في خطة الدفع');
        }
      }

      // Perform update
      const caseDocRef = doc(db, 'cases', caseId);
      await updateDoc(caseDocRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });

      // Add system log event
      await addDoc(collection(db, 'appEvents'), {
        type: 'case_status_changed',
        caseId,
        oldStatus: currentStatus,
        newStatus,
        performedBy: activeUser.uid,
        performedByName: profile?.fullName || profile?.name || 'مستخدم',
        timestamp: serverTimestamp()
      });

      await fetchCase(); // reload case
    } catch (err: any) {
      alert("خطأ أثناء تحديث حالة المرحلة: " + err.message);
    } finally {
      setTransitioning(false);
    }
  };

  const handleUpdateAssignment = async () => {
    if (!caseId) return;
    setSubmittingAssignment(true);
    try {
      const activeUser = auth.currentUser;
      if (!activeUser) throw new Error("لم يتم تلقيم كود تحقيق الهوية.");

      const caseDocRef = doc(db, 'cases', caseId);
      await updateDoc(caseDocRef, {
        assignmentType: assignForm.assignmentType,
        lawFirmId: assignForm.lawFirmId || null,
        assignedAssistantId: assignForm.assignedAssistantId || null,
        salesEmployeeId: assignForm.salesEmployeeId || null,
        updatedAt: serverTimestamp()
      });

      alert("تم تحديث أسماء وبيانات الإسناد بنجاح! 🎉");
      await fetchCase();
    } catch (error: any) {
      alert("خطأ: " + error.message);
    } finally {
      setSubmittingAssignment(false);
    }
  };

  const fetchDecisions = async () => {
    try {
      const docRef = doc(db, 'settings', 'executionDecisions');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const options = docSnap.data().options || [];
        if (options.length > 0) {
          setDecisionOptions(options);
        }
      }
    } catch (error) {
      console.error("Error fetching decisions:", error);
    }
  };

  const fetchPlatforms = async () => {
    try {
      const docRef = doc(db, 'settings', 'executionPlatforms');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setPlatformOptions(docSnap.data().options || []);
      }
    } catch (error) {
      console.error("Error fetching platforms:", error);
    }
  };

  const fetchStatuses = async () => {
    try {
      const docRef = doc(db, 'settings', 'executionStatuses');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setStatusOptions(docSnap.data().options || []);
      }
    } catch (error) {
      console.error("Error fetching statuses:", error);
    }
  };

  const getStatusStyle = (status: string) => {
    const statusObj = statusOptions.find(s => s.value === status);
    const color = statusObj?.color || 'blue';
    const colorStyles: any = {
      blue: "bg-blue-50 text-blue-700 border-blue-100",
      green: "bg-green-50 text-green-700 border-green-100",
      red: "bg-red-50 text-red-700 border-red-100",
      gray: "bg-slate-50 text-slate-700 border-slate-100",
      orange: "bg-orange-50 text-orange-700 border-orange-100",
      purple: "bg-purple-50 text-purple-700 border-purple-100",
    };
    return colorStyles[color] || colorStyles.blue;
  };

  const renderDate = (dateField: any) => {
    if (!dateField) return '—';
    let d: Date;
    if (dateField instanceof Timestamp) d = dateField.toDate();
    else if (dateField instanceof Date) d = dateField;
    else if (dateField.seconds) d = new Date(dateField.seconds * 1000);
    else d = new Date(dateField);

    if (isNaN(d.getTime())) return String(dateField);

    const gregorian = d.toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const hijri = d.toLocaleDateString('ar-SA-u-ca-islamic-uma-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' });
    
    return (
      <div className="flex flex-col">
        <span className="font-bold text-slate-800">{gregorian}</span>
        <span className="text-xs text-slate-400 font-medium">{hijri} هـ</span>
      </div>
    );
  };

  useEffect(() => {
    const fetchTabData = async () => {
      if (!caseId || !activeTab) return;
      setTabLoading(true);
      try {
        const q = query(
          collection(db, 'cases', caseId, activeTab),
          orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTabData(docs);
      } catch (error) {
        console.error(`Error fetching ${activeTab}:`, error);
        setTabData([]);
      }
      setTabLoading(false);
    };

    if (caseData) {
      fetchTabData();
    }
  }, [caseId, activeTab, caseData]);

  const handleUpdateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseId || !canEditCase) return;
    setEditSubmitting(true);
    try {
      const claim = Number(editForm.claimAmount) || 0;
      const received = Number(editForm.receivedAmount) || 0;
      const remaining = claim - received;
      const selectedStatus = statusOptions.find(s => s.value === editForm.status);

      const payload = {
        ...editForm,
        fileDate: editForm.fileDate ? Timestamp.fromDate(new Date(editForm.fileDate)) : null,
        claimAmount: claim,
        receivedAmount: received,
        remainingAmount: remaining,
        statusLabel: selectedStatus?.label || editForm.statusLabel,
        updatedAt: serverTimestamp()
      };

      const caseDocRef = doc(db, 'cases', caseId);
      await updateDoc(caseDocRef, payload);
      
      // Log event if status changed
      if (caseData.status !== editForm.status) {
        await createCaseEvent({
          caseId: caseId,
          caseSerialNumber: caseData.requestSerialNumber || '',
          type: 'case_status_changed',
          message: `تم تغيير حالة القضية ${caseData.requestSerialNumber || ''} من ${caseData.statusLabel || 'غير معروف'} إلى ${selectedStatus?.label || editForm.statusLabel}.`,
          payload: { 
            caseSerialNumber: caseData.requestSerialNumber || '',
            oldStatus: caseData.status, 
            newStatus: editForm.status,
            oldStatusLabel: caseData.statusLabel,
            newStatusLabel: selectedStatus?.label || editForm.statusLabel
          },
          createdBy: user?.uid || '',
          createdByName: profile?.name || 'مستخدم'
        });
      }

      setIsEditModalOpen(false);
      await fetchCase();
    } catch (error: any) {
      alert(`خطأ في التحديث: ${error.message}`);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseId || !user) return;
    setSubmitting(true);

    let data: any = {
      createdAt: serverTimestamp(),
      createdBy: user.uid,
    };

    if (activeTab === 'activities') data = { ...data, ...activityForm };
    if (activeTab === 'documents') data = { ...data, ...documentForm };
    
    if (activeTab === 'sessions') {
      data = { 
        ...data, 
        ...sessionForm,
        sessionDate: Timestamp.fromDate(new Date(sessionForm.sessionDate)),
        caseId: caseId,
        caseSerialNumber: caseData.requestSerialNumber || '',
        defendantName: caseData.defendantName,
        applicantName: caseData.applicantName,
        notification7Days: false,
        notification1Day: false,
        notification30Min: false,
        status: 'scheduled'
      };
      
      try {
        // Also add to global sessions collection for the reminder hook
        await addDoc(collection(db, 'case_sessions'), data);
      } catch (err) {
        console.error("Error adding to global sessions:", err);
      }
    }

    try {
      await addDoc(collection(db, 'cases', caseId, activeTab), data);
      setIsAddModalOpen(false);
      // Reset forms
      setActivityForm({ description: '', type: 'note' });
      setDocumentForm({ name: '', url: '', type: 'pdf' });
      setSessionForm({ sessionDate: '', location: '', type: 'استماع', notes: '' });
      
      // Refresh tab data
      const q = query(collection(db, 'cases', caseId, activeTab), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      setTabData(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error: any) {
      alert(`خطأ: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const tabs = [
    { id: 'activities', label: 'النشاطات', icon: ActivityIcon },
    { id: 'documents', label: 'المستندات', icon: FileText },
    { id: 'sessions', label: 'الجلسات', icon: Calendar },
    { id: 'finance', label: 'الحركات المالية', icon: CreditCard },
  ];

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      <p className="text-slate-500 font-medium font-sans">جاري تحميل بيانات القضية...</p>
    </div>
  );

  return (
    <div className="space-y-8" dir="rtl">
      {/* Breadcrumbs & Header */}
      <div className="flex flex-col gap-4">
        <button 
          onClick={() => navigate('/cases')}
          className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors text-sm font-bold group"
        >
          <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
          <span>العودة لقائمة القضايا</span>
        </button>
        
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-col gap-1">
                <span className="px-4 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-black tracking-widest font-mono border border-indigo-100 shadow-sm w-fit">
                  طلب رقم: {caseData.requestSerialNumber || caseData.requestNumber}
                </span>
                {caseData.electronicReferenceNumber && (
                  <span className="px-4 py-1 bg-amber-50 text-amber-700 rounded-lg text-[10px] font-black font-mono border border-amber-100 w-fit">
                    مرجع إلكتروني: {caseData.electronicReferenceNumber}
                  </span>
                )}
              </div>
              <span className={cn(
                "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border shadow-sm",
                getStatusStyle(caseData.status)
              )}>
                {caseData.statusLabel || 'قيد الإجراء'}
              </span>
              <span className={cn(
                "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border shadow-sm",
                caseData.decisionCode === "34" ? "bg-amber-50 text-amber-700 border-amber-200" :
                caseData.decisionCode === "46" ? "bg-red-50 text-red-700 border-red-200" :
                caseData.decisionCode === "34+46" ? "bg-orange-50 text-orange-700 border-orange-200" :
                caseData.decisionCode === "under_execution" ? "bg-blue-50 text-blue-700 border-blue-200" :
                "bg-slate-50 text-slate-500 border-slate-100"
              )}>
                {caseData.decisionLabel || 'لا يوجد قرار'}
              </span>
              <span className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-[10px] font-bold shadow-md shadow-indigo-100">
                {caseData.requestType}
              </span>
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-tight">
              {caseData.defendantName}
              <div className="flex flex-col gap-2 mt-2">
                <span className="text-lg font-medium text-slate-500">مقدم الطلب: {caseData.applicantName}</span>
                {caseData.defendantPhone && (
                  <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 w-fit px-3 py-1 rounded-xl border border-indigo-100">
                    <Phone size={14} />
                    <span className="text-sm font-bold font-mono">{caseData.defendantPhone}</span>
                  </div>
                )}
              </div>
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {canEditCase && (
              <button 
                onClick={() => setIsEditModalOpen(true)}
                className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-slate-200 text-slate-700 rounded-2xl text-sm font-bold hover:border-indigo-600 hover:text-indigo-600 transition-all shadow-sm active:scale-95"
              >
                <Edit size={18} />
                تعديل البيانات
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* PHASE 2 - WORKFLOW STEPPER & ASSIGNMENT PANEL */}
      {/* ========================================================= */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm space-y-6">
        <div>
          <h2 className="text-xl font-bold font-sans text-slate-800 flex items-center gap-2">
            <Scale className="text-indigo-600" size={24} />
            <span>لوحة مراحل وسير العمل التنفيذي (Case Lifecycle)</span>
          </h2>
          <p className="text-xs text-slate-400 font-medium">متابعة مسار الإجراءات التنفيذية وإسنادها إلى موظفي المبيعات ومكاتب المحاماة</p>
        </div>

        {/* Dynamic Horizontal Stepper */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {[
            { key: 'draft', label: 'مسودة', desc: 'القضية مسودة أولية', col: 'text-slate-600 bg-slate-50' },
            { key: 'under_review', label: 'تحت المراجعة', desc: 'قيد التدقيق والتحقق', col: 'text-amber-750 bg-amber-50' },
            { key: 'internal', label: 'متابعة داخلية', desc: 'متابعة بداخل الشركة', col: 'text-cyan-750 bg-cyan-50' },
            { key: 'external_assigned', label: 'إسناد خارجي', desc: 'إحالتها لمكتب محاماة', col: 'text-purple-750 bg-purple-50' },
            { key: 'in_court', label: 'بالمحكمة', desc: 'جلسات وقرارات المحاكم', col: 'text-indigo-750 bg-indigo-50' },
            { key: 'closed', label: 'مغلقة ومكتملة', desc: 'تم تسديد كامل المبلغ', col: 'text-emerald-750 bg-emerald-50' }
          ].map((step, idx) => {
            const isCurrent = caseData.status === step.key;
            return (
              <div 
                key={step.key} 
                className={cn(
                  "p-5 rounded-2xl border transition-all text-right relative flex flex-col justify-between overflow-hidden",
                  isCurrent 
                    ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/10 shadow-sm" 
                    : "border-slate-100 bg-slate-50/30"
                )}
              >
                {isCurrent && (
                  <div className="absolute top-0 right-0 left-0 h-1 bg-indigo-600" />
                )}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-400 font-mono">الخطوة {idx + 1}</span>
                    {isCurrent && <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />}
                  </div>
                  <h4 className="font-sans font-black text-slate-900 text-sm">{step.label}</h4>
                  <p className="text-[10px] text-slate-400 font-medium leading-normal mt-1">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Status Actions Block */}
        <div className="flex flex-wrap items-center gap-4 bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
          <div className="shrink-0 font-sans">
            <span className="text-xs text-slate-400 font-black block mb-1">التحكم في المرحلة</span>
            <span className="text-sm font-bold text-slate-800">الانتقال للمرحلة التالية:</span>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {/* Show transitions dynamically */}
            {transitioning ? (
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 font-sans">
                <Loader2 size={16} className="animate-spin text-indigo-600" />
                <span>جاري حفظ وتوثيق المعاملة...</span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 font-sans">
                {/* Draft -> Under Review */}
                {caseData.status === 'draft' && ['admin', 'company_manager', 'assistant_manager'].includes(profile?.role || '') && (
                  <button 
                    onClick={() => handleTransitionStatus('under_review')}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl transition-all"
                  >
                    إرسال للمراجعة
                  </button>
                )}

                {/* Under Review -> Internal OR External_Assigned */}
                {caseData.status === 'under_review' && ['admin', 'company_manager', 'assistant_manager'].includes(profile?.role || '') && (
                  <>
                    <button 
                      onClick={() => handleTransitionStatus('internal')}
                      className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-black rounded-xl transition-all"
                    >
                      إقرار متابعة داخلية
                    </button>
                    <button 
                      onClick={() => {
                        if (!caseData.lawFirmId) {
                          alert("تنبيه: يجب إسناد القضية لمكتب محاماة خارجي أولاً وحفظ بيانات الإسناد من الجدول بالأسفل.");
                        } else {
                          handleTransitionStatus('external_assigned');
                        }
                      }}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-black rounded-xl transition-all"
                    >
                      إقرار إسناد لمستشار خارجي
                    </button>
                  </>
                )}

                {/* Internal -> Court OR Closed */}
                {caseData.status === 'internal' && ['admin', 'company_manager', 'assistant_manager'].includes(profile?.role || '') && (
                  <>
                    <button 
                      onClick={() => handleTransitionStatus('closed')}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-all"
                    >
                      إغلاق القضية (تسوية كاملة)
                    </button>
                  </>
                )}

                {/* External Assigned -> Court OR Closed */}
                {caseData.status === 'external_assigned' && (
                  <>
                    {/* Company Managers and External Law Managers can transition */}
                    {['admin', 'company_manager', 'assistant_manager', 'law_firm_manager', 'law_firm_assistant'].includes(profile?.role || '') && (
                      <button 
                        onClick={() => handleTransitionStatus('in_court')}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-750 text-white text-xs font-black rounded-xl transition-all"
                      >
                        إحالة المحاكمة (حضور الجلسات)
                      </button>
                    )}
                  </>
                )}

                {/* In Court -> Closed */}
                {caseData.status === 'in_court' && (
                  <>
                    {['admin', 'company_manager', 'assistant_manager', 'law_firm_manager', 'law_firm_assistant'].includes(profile?.role || '') && (
                      <button 
                        onClick={() => handleTransitionStatus('closed')}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-all"
                      >
                        إغلاق القضية بانتهاء التحصيل
                      </button>
                    )}
                  </>
                )}

                {/* Closed -> Reopen to Review */}
                {caseData.status === 'closed' && ['admin', 'company_manager'].includes(profile?.role || '') && (
                  <button 
                    onClick={() => handleTransitionStatus('under_review')}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-xs font-black rounded-xl transition-all"
                  >
                    إعادة فتح القضية للتدقيق
                  </button>
                )}

                {/* No transitions found or allowed */}
                {!(
                  (caseData.status === 'draft' && ['admin', 'company_manager', 'assistant_manager'].includes(profile?.role || '')) ||
                  (caseData.status === 'under_review' && ['admin', 'company_manager', 'assistant_manager'].includes(profile?.role || '')) ||
                  (caseData.status === 'internal' && ['admin', 'company_manager', 'assistant_manager'].includes(profile?.role || '')) ||
                  (caseData.status === 'external_assigned' && ['admin', 'company_manager', 'assistant_manager', 'law_firm_manager', 'law_firm_assistant'].includes(profile?.role || '')) ||
                  (caseData.status === 'in_court' && ['admin', 'company_manager', 'assistant_manager', 'law_firm_manager', 'law_firm_assistant'].includes(profile?.role || '')) ||
                  (caseData.status === 'closed' && ['admin', 'company_manager'].includes(profile?.role || ''))
                ) && (
                  <span className="text-xs text-slate-400 font-bold bg-slate-100 px-3 py-1 rounded-lg">لا توجد إجراءات متاحة لصلاحيات دورك الحالي على هذه القضية حالياً.</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Assignment & Designation Panel (Managers Only) */}
        {['admin', 'company_manager', 'assistant_manager'].includes(profile?.role || '') && (
          <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black font-sans text-slate-800 flex items-center gap-2">
                <UserCheck size={18} className="text-indigo-600" />
                <span>إعدادات وهيكلة الإسناد والمهام للقضية</span>
              </h3>
              <button 
                onClick={handleUpdateAssignment}
                disabled={submittingAssignment}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all active:scale-95 shadow-sm font-sans"
              >
                {submittingAssignment ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>حفظ التعديلات الحالية</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-sans">
              {/* Assignment Type */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-indigo-600 uppercase tracking-wider block">نوع المتابعة والإشراف</label>
                <select 
                  value={assignForm.assignmentType}
                  onChange={(e) => setAssignForm({ ...assignForm, assignmentType: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-705"
                >
                  <option value="internal">داخلي (بالشركة)</option>
                  <option value="external">خارجي (من مكتب محاماة متعاون)</option>
                </select>
              </div>

              {/* Law Firm Manager Dropdown */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 block">مكتب المحاماة الخارجي (المدير)</label>
                <select
                  disabled={assignForm.assignmentType === 'internal'}
                  value={assignForm.lawFirmId}
                  onChange={(e) => setAssignForm({ ...assignForm, lawFirmId: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-750 disabled:opacity-50"
                >
                  <option value="">-- لم يتم إسناد محامي خارجي بعد --</option>
                  {lawFirmManagers.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              {/* Law Firm Assistant Dropdown */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 block">المسؤول المعين بمكتب المحاماة</label>
                <select
                  disabled={assignForm.assignmentType === 'internal' || !assignForm.lawFirmId}
                  value={assignForm.assignedAssistantId}
                  onChange={(e) => setAssignForm({ ...assignForm, assignedAssistantId: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-750 disabled:opacity-50"
                >
                  <option value="">-- لم يتم تحديد مساعد مسؤول بعد --</option>
                  {lawFirmAssistants.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              {/* JPF Sales Employee Dropdown */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 block">مندوب أو موظف المبيعات المسؤول</label>
                <select
                  value={assignForm.salesEmployeeId}
                  onChange={(e) => setAssignForm({ ...assignForm, salesEmployeeId: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-750 font-sans"
                >
                  <option value="">-- لم يتم إسناد مندوب مبيعات بعد --</option>
                  {salesEmployees.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Data Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Financial Overview Card */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm space-y-8 h-full">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <CreditCard size={18} />
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">الوضع المالي</h3>
          </div>
          
          <div className="space-y-6">
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-bold">مبلغ المطالبة</span>
              <div className="text-2xl font-black text-slate-900 font-mono tracking-tighter">
                {caseData.claimAmount?.toLocaleString()} <span className="text-xs font-medium text-slate-400">ر.س</span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-green-500 font-bold">المبلغ المستلم</span>
              <div className="text-2xl font-black text-green-600 font-mono tracking-tighter">
                {caseData.receivedAmount?.toLocaleString()} <span className="text-xs font-medium text-slate-400">ر.س</span>
              </div>
            </div>
            <div className="pt-6 border-t border-slate-100">
              <span className="text-xs text-red-500 font-bold">المبلغ المتبقي</span>
              <div className="text-3xl font-black text-red-600 font-mono tracking-tighter">
                {caseData.remainingAmount?.toLocaleString()} <span className="text-xs font-medium text-slate-400">ر.س</span>
              </div>
            </div>
          </div>
        </div>

        {/* Case Info Bento */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-8 space-y-6">
            <div className="flex items-center gap-2 text-indigo-500">
              <Hash size={18} />
              <span className="text-xs font-black uppercase tracking-widest">معلومات الطلب</span>
            </div>
            <div className="space-y-5 text-right">
              {caseData.electronicReferenceNumber && (
                <div>
                  <label className="text-[11px] text-slate-400 font-bold block mb-1">الرقم المرجعي الإلكتروني</label>
                  <span className="text-base font-bold text-indigo-600 font-mono tracking-tight">{caseData.electronicReferenceNumber}</span>
                </div>
              )}
              <div>
                <label className="text-[11px] text-slate-400 font-bold block mb-1">الرقم التسلسلي</label>
                <span className="text-base font-bold text-slate-800">{caseData.serialNumber || '—'}</span>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-bold block mb-1">وضع القرار</label>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    caseData.decisionCode === "34" ? "bg-amber-500" :
                    caseData.decisionCode === "46" ? "bg-red-500" :
                    caseData.decisionCode === "34+46" ? "bg-orange-500" :
                    caseData.decisionCode === "under_execution" ? "bg-blue-500" :
                    "bg-slate-300"
                  )} />
                  <span className="text-base font-bold text-indigo-600">{caseData.decisionLabel || '—'}</span>
                </div>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-bold block mb-1">النوع الفرعي</label>
                <span className="text-base font-bold text-slate-800">{caseData.subType || '—'}</span>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-bold block mb-1">تاريخ الرفع (ميلادي)</label>
                {renderDate(caseData.fileDate)}
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-bold block mb-1">تاريخ الرفع (هجري)</label>
                <span className="text-base font-bold text-slate-800">{caseData.fileDateHijri || '—'}</span>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-bold block mb-1">المنصة</label>
                <span className="text-base font-bold text-indigo-600 px-3 py-1 bg-indigo-50 rounded-lg">{caseData.platform || '—'}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-8 space-y-6">
            <div className="flex items-center gap-2 text-indigo-500">
              <UserCheck size={18} />
              <span className="text-xs font-black uppercase tracking-widest">أطراف الطلب</span>
            </div>
            <div className="space-y-5 text-right">
              <div>
                <label className="text-[11px] text-slate-400 font-bold block mb-1">رقم هوية المنفذ ضده</label>
                <span className="text-base font-bold text-slate-800 font-mono tracking-tight">{caseData.idNumber || '—'}</span>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-bold block mb-1">نوع الهوية</label>
                <span className="text-base font-bold text-slate-800">{caseData.idType || '—'}</span>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-bold block mb-1">الجنسية</label>
                <span className="text-base font-bold text-slate-800">{caseData.nationality || '—'}</span>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-bold block mb-1">الصفة</label>
                <span className="text-base font-bold text-slate-800">{caseData.legalCapacity || '—'}</span>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-bold block mb-1">اسم المندوب</label>
                <span className="text-base font-bold text-slate-800">{caseData.representativeName || '—'}</span>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-bold block mb-1">رقم العميل</label>
                <span className="text-base font-bold text-slate-800 font-mono">{caseData.clientNumber || '—'}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 rounded-[2rem] p-8 space-y-6 shadow-xl shadow-slate-200">
            <div className="flex items-center gap-2 text-indigo-400">
              <TrendingUp size={18} />
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">سير الإجراء</span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed font-medium line-clamp-5">
              {caseData.executionProgress || 'لا يوجد تحديث لسير الإجراء حالياً.'}
            </p>
            <div className="pt-6 border-t border-slate-800">
              <label className="text-[10px] text-slate-500 font-bold block uppercase mb-1.5 tracking-wider">تحديث السحب الأخير</label>
              <span className="text-xs text-indigo-400 font-black">{caseData.lastWithdrawalUpdate || 'لم يتم التحديث'}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Tabs Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-1">
          <div className="flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={cn(
                  "flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all relative",
                  activeTab === tab.id 
                    ? "text-indigo-600" 
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                <tab.icon size={18} />
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border-2 border-slate-50 rounded-[2.5rem] shadow-sm overflow-hidden flex flex-col min-h-[500px]">
          <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                {activeTab === 'activities' && <ActivityIcon size={24} />}
                {activeTab === 'documents' && <FileText size={24} />}
                {activeTab === 'finance' && <CreditCard size={24} />}
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  سجل {tabs.find(t => t.id === activeTab)?.label}
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">إدارة وتتبع كافة العمليات في هذا القسم</p>
              </div>
            </div>
            {canAddItems && activeTab !== 'finance' && (
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-sm font-bold hover:bg-slate-800 transition-all shadow-xl"
              >
                <Plus size={18} />
                إضافة جديد
              </button>
            )}
          </div>

          <div className="flex-1 p-10">
            {activeTab === 'documents' && caseData.attachments && caseData.attachments.length > 0 && (
              <div className="mb-10 space-y-4">
                <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                  <div className="w-1 h-1 bg-indigo-600 rounded-full" />
                  مرفقات الطلب الأساسية
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {caseData.attachments.map((att: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-5 bg-indigo-50/30 rounded-[2rem] border border-indigo-100/50 group">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-white rounded-2xl text-indigo-600 shadow-sm">
                          <FileText size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900">{getAttachmentLabel(att.type, att.customLabel)}</p>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">مرفق أساسي</span>
                        </div>
                      </div>
                      <a 
                        href={att.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="p-3 text-indigo-600 hover:bg-white rounded-2xl transition-all shadow-sm shadow-indigo-100 group-hover:scale-110 active:scale-95"
                      >
                        <ExternalLink size={20} />
                      </a>
                    </div>
                  ))}
                </div>
                <div className="h-px bg-slate-100 my-8" />
              </div>
            )}

            {tabLoading && activeTab !== 'finance' ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 py-20">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                <span className="text-sm text-slate-400 font-bold">جاري تحميل السجلات...</span>
              </div>
            ) : activeTab === 'finance' ? (
              <CasePaymentsTab 
                caseId={caseId || ''}
                claimAmount={caseData.claimAmount || 0}
                receivedAmount={caseData.receivedAmount || 0}
                remainingAmount={caseData.remainingAmount || 0}
                isClosed={caseData.status === 'closed'}
                onRefresh={fetchCase}
              />
            ) : tabData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 py-20 opacity-30">
                <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center">
                  <Info size={40} className="text-slate-300" />
                </div>
                <p className="text-sm font-black text-slate-400">لا توجد سجلات مسجلة في هذا القسم</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tabData.map((item, idx) => (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    key={item.id}
                    className="flex flex-col gap-4 p-6 bg-slate-50/50 rounded-3xl border border-slate-100 hover:border-indigo-100 transition-all group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-900 text-lg leading-snug">
                          {activeTab === 'documents' ? item.name : item.description}
                        </h4>
                        <div className="flex items-center gap-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">
                          <div className="flex items-center gap-1">
                            <Clock size={12} />
                            {item.createdAt?.toDate()?.toLocaleString('ar-EG')}
                          </div>
                          <div className="flex items-center gap-1">
                            <User size={12} />
                            <span>بواسطة: {item.createdByName || allUsers[item.createdBy] || '...'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {activeTab === 'activities' && (
                      <div className="mt-2 text-xs font-bold text-indigo-600 px-3 py-1 bg-white border border-indigo-50 rounded-lg w-fit">
                        {item.type}
                      </div>
                    )}

                    {activeTab === 'sessions' && (
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-4 mt-2">
                          <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
                             <Calendar size={14} className="text-indigo-600" />
                             <span className="text-xs font-bold text-indigo-700">{renderDate(item.sessionDate)}</span>
                          </div>
                          {item.location && (
                            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                               <Globe size={14} className="text-slate-500" />
                               <span className="text-xs font-bold text-slate-700">{item.location}</span>
                            </div>
                          )}
                        </div>
                        {item.notes && (
                          <p className="text-sm text-slate-500 bg-slate-50 p-4 rounded-2xl border border-slate-100 border-dashed">
                            {item.notes}
                          </p>
                        )}
                        <div className="flex items-center justify-between pt-2">
                           <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{item.type}</span>
                           <div className="flex gap-2">
                              {item.notification7Days && <span className="text-[8px] bg-green-50 text-green-600 px-1 rounded border border-green-100">7أ</span>}
                              {item.notification1Day && <span className="text-[8px] bg-green-50 text-green-600 px-1 rounded border border-green-100">1ي</span>}
                              {item.notification30Min && <span className="text-[8px] bg-green-50 text-green-600 px-1 rounded border border-green-100">30د</span>}
                           </div>
                        </div>
                      </div>
                    )}
                    
                    {activeTab === 'documents' && (
                      <div className="flex items-center justify-between mt-2 pt-4 border-t border-slate-100">
                        <span className="text-xs px-3 py-1 bg-slate-200 rounded-lg font-black text-slate-600 uppercase">{item.type}</span>
                        <a 
                          href={item.url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-black hover:bg-indigo-600 hover:text-white transition-all"
                        >
                          <ExternalLink size={14} />
                          معاينة
                        </a>
                      </div>
                    )}
                    
                    {activeTab === 'finance' && (
                      <div className="mt-2 flex items-center justify-between pt-4 border-t border-slate-100">
                        <div className={cn(
                          "px-3 py-1 rounded-lg text-[10px] font-black uppercase",
                          item.type === 'income' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        )}>
                          {item.type === 'income' ? 'إيراد' : 'مصروف'}
                        </div>
                        <div className="text-xl font-black text-slate-900 font-mono tracking-tighter">
                          {item.amount?.toLocaleString()} <span className="text-[10px] font-bold text-slate-400">ر.س</span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Case Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !editSubmitting && setIsEditModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                    <Edit size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900">تعديل بيانات الملف التنفيذي</h3>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">تحديث معلومات القضية والأطراف والمبالغ</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={editSubmitting}
                  className="p-3 text-slate-400 hover:bg-slate-50 rounded-2xl transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="max-h-[70vh] overflow-y-auto">
                <form onSubmit={handleUpdateCase} className="p-10 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mr-1">رقم الطلب</label>
                       <input 
                         required
                         type="text"
                         value={editForm.requestNumber}
                         onChange={(e) => setEditForm({...editForm, requestNumber: e.target.value})}
                         className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-bold text-slate-700 font-mono"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mr-1">نوع الطلب</label>
                       <select 
                         required
                         value={editForm.requestType}
                         onChange={(e) => setEditForm({...editForm, requestType: e.target.value})}
                         className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-bold text-slate-700"
                       >
                         <option value="تنفيذ">تنفيذ</option>
                         <option value="عامة">عامة</option>
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mr-1">المنفذ ضده</label>
                       <input 
                         required
                         type="text"
                         value={editForm.defendantName}
                         onChange={(e) => setEditForm({...editForm, defendantName: e.target.value})}
                         className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-bold text-slate-700"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mr-1">مقدم الطلب</label>
                       <input 
                         required
                         type="text"
                         value={editForm.applicantName}
                         onChange={(e) => setEditForm({...editForm, applicantName: e.target.value})}
                         className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-bold text-slate-700"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mr-1">رقم جوال المنفذ ضده</label>
                       <input 
                         type="tel"
                         value={editForm.defendantPhone || ''}
                         onChange={(e) => setEditForm({...editForm, defendantPhone: e.target.value})}
                         className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-bold text-slate-700 font-mono"
                         placeholder="05xxxxxxxx"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mr-1">رقم العميل</label>
                       <input 
                         type="text"
                         value={editForm.clientNumber || ''}
                         onChange={(e) => setEditForm({...editForm, clientNumber: e.target.value})}
                         className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-bold text-slate-700 font-mono"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mr-1">مبلغ المطالبة</label>
                       <input 
                         required
                         type="number"
                         value={editForm.claimAmount}
                         onChange={(e) => setEditForm({...editForm, claimAmount: e.target.value})}
                         className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-black text-slate-900 font-mono"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mr-1 text-green-600">المبلغ المستلم</label>
                       <input 
                         required
                         type="number"
                         value={editForm.receivedAmount}
                         onChange={(e) => setEditForm({...editForm, receivedAmount: e.target.value})}
                         className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-black text-green-600 font-mono"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mr-1">حالة الطلب</label>
                       <select 
                         value={editForm.status}
                         onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                         className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-black text-slate-700"
                       >
                         {statusOptions.map(opt => (
                           <option key={opt.value} value={opt.value}>{opt.label}</option>
                         ))}
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mr-1">تاريخ الرفع (ميلادي)</label>
                       <input 
                         type="date"
                         value={editForm.fileDate}
                         onChange={(e) => setEditForm({...editForm, fileDate: e.target.value})}
                         className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-bold text-slate-700"
                       />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mr-1">المنصة</label>
                        <select 
                          value={editForm.platform || ''}
                          onChange={(e) => setEditForm({...editForm, platform: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-black text-slate-700"
                        >
                          <option value="">اختر المنصة</option>
                          {platformOptions.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mr-1">وضع القرار</label>
                        <select 
                          value={editForm.decisionCode || ''}
                          onChange={(e) => {
                            const opt = decisionOptions.find(d => d.code === e.target.value);
                            setEditForm({...editForm, decisionCode: e.target.value, decisionLabel: opt?.label || ''});
                          }}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-black text-slate-700"
                        >
                          {decisionOptions.map(opt => (
                            <option key={opt.code} value={opt.code}>{opt.label}</option>
                          ))}
                        </select>
                     </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mr-1">سير الإجراء التنفيذي</label>
                    <textarea 
                      value={editForm.executionProgress}
                      onChange={(e) => setEditForm({...editForm, executionProgress: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-medium text-slate-700 h-32 leading-relaxed"
                    />
                  </div>

                  <div className="pt-6 flex gap-4">
                    <button 
                      type="submit"
                      disabled={editSubmitting}
                      className="flex-[2] py-5 bg-indigo-600 text-white rounded-3xl font-black hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-100 flex items-center justify-center gap-3 active:scale-95"
                    >
                      {editSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save size={20} />}
                      حفظ كافة التعديلات
                    </button>
                    <button 
                      type="button"
                      onClick={() => setIsEditModalOpen(false)}
                      disabled={editSubmitting}
                      className="flex-1 py-5 bg-slate-50 text-slate-400 rounded-3xl font-bold hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Modal (Items) */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !submitting && setIsAddModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="px-10 py-8 border-b border-slate-100">
                <h3 className="text-xl font-black text-slate-900">
                  إضافة {activeTab === 'activities' ? 'نشاط جديد' : activeTab === 'documents' ? 'مستند جديد' : activeTab === 'sessions' ? 'جلسة جديدة' : 'حركة مالية'}
                </h3>
              </div>

              <form onSubmit={handleAddItem} className="p-10 space-y-6 text-right">
                {activeTab === 'sessions' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">موعد الجلسة</label>
                      <input 
                        required
                        type="datetime-local"
                        value={sessionForm.sessionDate}
                        onChange={(e) => setSessionForm({...sessionForm, sessionDate: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-600 outline-none font-bold text-slate-700"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">مكان الجلسة</label>
                      <input 
                        type="text"
                        value={sessionForm.location}
                        onChange={(e) => setSessionForm({...sessionForm, location: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-700"
                        placeholder="قاعة / رابط إلكتروني"
                      />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">نوع الجلسة</label>
                       <select 
                         value={sessionForm.type}
                         onChange={(e) => setSessionForm({...sessionForm, type: e.target.value})}
                         className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-black"
                       >
                         <option value="استماع">استماع</option>
                         <option value="مرافعة">مرافعة</option>
                         <option value="نطق بالحكم">نطق بالحكم</option>
                         <option value="صلح">صلح</option>
                       </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">ملاحظات إضافية</label>
                      <textarea 
                        value={sessionForm.notes}
                        onChange={(e) => setSessionForm({...sessionForm, notes: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-600 outline-none h-24 text-sm font-medium"
                      />
                    </div>
                  </>
                )}

                {activeTab === 'activities' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">وصف النشاط</label>
                      <textarea 
                        required
                        value={activityForm.description}
                        onChange={(e) => setActivityForm({...activityForm, description: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-600 outline-none h-32 text-sm leading-relaxed"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">نوع النشاط</label>
                      <select 
                        value={activityForm.type}
                        onChange={(e) => setActivityForm({...activityForm, type: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-black text-slate-700"
                      >
                        <option value="note">ملاحظة</option>
                        <option value="meeting">اجتماع</option>
                        <option value="call">مكالمة</option>
                        <option value="deadline">موعد نهائي</option>
                      </select>
                    </div>
                  </>
                )}

                {activeTab === 'documents' && (
                  <>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">اسم المستند</label>
                       <input 
                         required
                         type="text"
                         value={documentForm.name}
                         onChange={(e) => setDocumentForm({...documentForm, name: e.target.value})}
                         className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">رابط المستند</label>
                       <input 
                         required
                         type="url"
                         value={documentForm.url}
                         onChange={(e) => setDocumentForm({...documentForm, url: e.target.value})}
                         placeholder="https://..."
                         className="w-full bg-slate-50 border border-slate-100 rounded-2xl pr-5 pl-5 py-4 text-left font-mono text-sm"
                         dir="ltr"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">نوع الملف</label>
                       <select 
                         value={documentForm.type}
                         onChange={(e) => setDocumentForm({...documentForm, type: e.target.value})}
                         className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-black"
                       >
                         <option value="pdf">PDF</option>
                         <option value="docx">Word</option>
                         <option value="jpg">صورة</option>
                       </select>
                    </div>
                  </>
                )}

                <div className="pt-6 flex gap-4">
                  <button 
                    type="submit"
                    disabled={submitting}
                    className="flex-[2] py-5 bg-slate-900 text-white rounded-3xl font-black hover:bg-slate-800 transition-all flex items-center justify-center gap-3"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save size={20} />}
                    حفظ البيانات
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    disabled={submitting}
                    className="flex-1 py-5 bg-slate-100 text-slate-400 rounded-3xl font-bold hover:bg-slate-200 transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
