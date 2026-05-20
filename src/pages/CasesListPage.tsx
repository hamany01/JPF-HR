import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy, runTransaction, doc, getDoc, Timestamp, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Plus, Search, Filter, Loader2, X, ChevronLeft, UploadCloud } from 'lucide-react';
import { cn } from '../lib/utils';
import DataImporter from '../components/DataImporter';
import CasesDashboard from '../components/cases/CasesDashboard';

export default function CasesListPage() {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [platformOptions, setPlatformOptions] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    phone: '',
    nationality: 'الكل',
    status: 'الكل',
    platform: 'الكل',
    requestSerialNumber: '',
    defendantName: '',
    idType: 'الكل'
  });
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const nationalities = ['الكل', 'سعودي', 'يمني', 'مصري', 'هندي', 'بنغالي', 'باكستاني', 'سوداني', 'سوري', 'أردني', 'فلسطيني'];
  const idTypes = ['الكل', 'فرد', 'مؤسسة', 'شركة'];

  const [formData, setFormData] = useState({
    serialNumber: '',
    requestType: 'تنفيذ',
    requestNumber: '',
    fileDate: '',
    subType: 'سند لأمر إلكتروني',
    status: 'in_progress',
    statusLabel: 'قيد التنفيذ',
    claimAmount: 0,
    receivedAmount: 0,
    applicantName: '',
    defendantName: '',
    defendantPhone: '',
    idType: 'فرد',
    idNumber: '',
    clientNumber: '',
    legalCapacity: 'فرد',
    nationality: 'سعودي',
    platform: '',
    decisionCode: '',
    decisionLabel: 'لا يوجد',
    representativeName: '',
    lastWithdrawalUpdate: '',
    executionProgress: ''
  });

  const [statusOptions, setStatusOptions] = useState<any[]>([]);
  const [decisionOptions, setDecisionOptions] = useState<any[]>([
    { code: '', label: 'لا يوجد' },
    { code: '34', label: 'قرار 34' },
    { code: '46', label: 'قرار 46' },
    { code: '34+46', label: 'قرار 34 + 46' },
    { code: 'under_execution', label: 'تحت التنفيذ' },
  ]);

  // Check if user has permission to add cases
  const canAddCase = ['admin', 'company_manager', 'company_assistant'].includes(profile?.role || '');

  const fetchCases = async () => {
    setLoading(true);
    try {
      let q = query(collection(db, 'cases'), orderBy('createdAt', 'desc'));

      if (filters.nationality !== 'الكل') {
        q = query(q, where('nationality', '==', filters.nationality));
      }
      if (filters.status !== 'الكل') {
        q = query(q, where('status', '==', filters.status));
      }
      if (filters.platform !== 'الكل') {
        q = query(q, where('platform', '==', filters.platform));
      }
      if (filters.idType !== 'الكل') {
        q = query(q, where('idType', '==', filters.idType));
      }

      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCases(docs);
    } catch (error) {
      console.error("Error fetching cases:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCases();
  }, [filters.nationality, filters.status, filters.platform, filters.idType]);

  useEffect(() => {
    fetchPlatforms();
    fetchStatuses();
    fetchDecisions();
  }, []);

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
        const options = docSnap.data().options || [];
        setStatusOptions(options);
        if (options.length > 0 && !formData.status) {
          setFormData(prev => ({ ...prev, status: options[0].value, statusLabel: options[0].label }));
        }
      }
    } catch (error) {
      console.error("Error fetching statuses:", error);
    }
  };

  const handleAddCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAddCase) return;
    setIsSubmitting(true);

    try {
      const claim = Number(formData.claimAmount) || 0;
      const received = Number(formData.receivedAmount) || 0;
      const remaining = claim - received;

      const selectedStatus = statusOptions.find(s => s.value === formData.status);

      // Automatic Serial Number Generation using Transaction
      const currentYear = new Date().getFullYear();
      let generatedSerial = '';

      const counterRef = doc(db, 'counters', 'executionCases');

      await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        
        let newCount = 1;
        let prefix = 'EXE';

        if (counterDoc.exists()) {
          newCount = (counterDoc.data().currentSerial || 0) + 1;
          prefix = counterDoc.data().prefix || 'EXE';
        } else {
          // Initialize if doesn't exist
          transaction.set(counterRef, { currentSerial: 1, prefix: 'EXE' });
        }

        const paddedCount = String(newCount).padStart(5, '0');
        generatedSerial = `${prefix}-${currentYear}-${paddedCount}`;

        // Update the counter
        transaction.update(counterRef, { currentSerial: newCount });

        // Create the case document reference
        const caseRef = doc(collection(db, 'cases'));
        
        // Write the case document
        transaction.set(caseRef, {
          ...formData,
          fileDate: formData.fileDate ? Timestamp.fromDate(new Date(formData.fileDate)) : null,
          serialNumber: generatedSerial,
          claimAmount: claim,
          receivedAmount: received,
          remainingAmount: remaining,
          statusLabel: selectedStatus?.label || 'قيد التنفيذ',
          createdBy: user?.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      setIsModalOpen(false);
      setFormData({
        serialNumber: '',
        requestType: 'التنفيذ',
        requestNumber: '',
        fileDate: '',
        subType: 'سند لأمر إلكتروني',
        status: 'in_progress',
        statusLabel: 'قيد التنفيذ',
        claimAmount: 0,
        receivedAmount: 0,
        applicantName: '',
        defendantName: '',
        defendantPhone: '',
        idType: 'فرد',
        idNumber: '',
        clientNumber: '',
        legalCapacity: 'فرد',
        nationality: 'سعودي',
        platform: '',
        decisions: 'لا يوجد',
        representativeName: '',
        lastWithdrawalUpdate: '',
        executionProgress: ''
      });
      fetchCases();
    } catch (error: any) {
      alert(`خطأ في الإضافة: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string, label: string) => {
    const statusObj = statusOptions.find(s => s.value === status);
    const color = statusObj?.color || 'blue';
    
    const colorStyles: any = {
      blue: "bg-blue-100 text-blue-700 border-blue-200",
      green: "bg-green-100 text-green-700 border-green-200",
      red: "bg-red-100 text-red-700 border-red-200",
      gray: "bg-slate-100 text-slate-700 border-slate-200",
      orange: "bg-orange-100 text-orange-700 border-orange-200",
      purple: "bg-purple-100 text-purple-700 border-purple-200",
    };

    return (
      <span className={cn("px-2.5 py-1 rounded-lg text-[10px] font-bold border", colorStyles[color] || colorStyles.blue)}>
        {label || "قيد التنفيذ"}
      </span>
    );
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
        <span className="font-bold text-slate-700">{gregorian}</span>
        <span className="text-[10px] text-slate-400">{hijri} هـ</span>
      </div>
    );
  };

  const filteredCases = cases.filter(item => {
    const matchesPhone = !filters.phone || item.defendantPhone?.includes(filters.phone);
    const matchesRequest = !filters.requestSerialNumber || 
                          item.requestSerialNumber?.includes(filters.requestSerialNumber) || 
                          item.requestNumber?.includes(filters.requestSerialNumber);
    const matchesName = !filters.defendantName || item.defendantName?.toLowerCase().includes(filters.defendantName.toLowerCase());
    return matchesPhone && matchesRequest && matchesName;
  });

  if (loading && cases.length === 0) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      <div className="text-slate-500 font-medium">جاري تحميل القضايا...</div>
    </div>
  );

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">إدارة القضايا التنفيذية</h1>
          <p className="text-slate-500 text-sm">قائمة شاملة بجميع الطلبات والاجراءات التنفيذية</p>
        </div>
        <div className="flex gap-2">
          {canAddCase && (
            <>
              <button 
                onClick={() => setIsImportModalOpen(true)}
                className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all flex items-center gap-2 border border-slate-200"
              >
                <UploadCloud size={18} />
                <span>استيراد جماعي</span>
              </button>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2"
              >
                <Plus size={18} />
                <span>إضافة ملف تنفيذي</span>
              </button>
            </>
          )}
        </div>
      </div>

      <CasesDashboard cases={filteredCases} />

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">رقم الطلب / المرجع</label>
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
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">المنفذ ضده</label>
            <div className="relative">
              <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text"
                placeholder="بحث بالاسم..."
                value={filters.defendantName}
                onChange={(e) => setFilters({...filters, defendantName: e.target.value})}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl pr-11 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">رقم الجوال</label>
            <div className="relative">
              <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text"
                placeholder="05..."
                value={filters.phone}
                onChange={(e) => setFilters({...filters, phone: e.target.value})}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl pr-11 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">نوع الهوية</label>
            <select 
              value={filters.idType}
              onChange={(e) => setFilters({...filters, idType: e.target.value})}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700"
            >
              {idTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">الجنسية</label>
            <select 
              value={filters.nationality}
              onChange={(e) => setFilters({...filters, nationality: e.target.value})}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700"
            >
              {nationalities.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">حالة الطلب</label>
            <select 
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700"
            >
              <option value="الكل">الكل</option>
              {statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">المنصة</label>
            <select 
              value={filters.platform}
              onChange={(e) => setFilters({...filters, platform: e.target.value})}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700"
            >
              <option value="الكل">الكل</option>
              {platformOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          <div className="flex items-end">
            <button 
              onClick={() => setFilters({ 
                phone: '', 
                nationality: 'الكل', 
                status: 'الكل', 
                platform: 'الكل',
                requestNumber: '',
                defendantName: '',
                idType: 'الكل'
              })}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-dashed border-slate-200 hover:border-indigo-200"
            >
              <X size={16} />
              <span>مسح الفلاتر</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-x-auto relative">
        {loading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
        )}
        <table className="w-full text-right border-collapse min-w-[1600px]">
          <thead className="bg-slate-50/50 text-slate-500 uppercase tracking-tight text-xs font-medium border-b border-slate-100">
            <tr>
              <th className="px-5 py-5 text-right">رقم الطلب المرجعي</th>
              <th className="px-5 py-5 text-right">وضع القرار</th>
              <th className="px-5 py-5 text-right">نوع الطلب</th>
              <th className="px-5 py-5 text-right">المنفذ ضده</th>
              <th className="px-5 py-5 text-right">تاريخ الرفع</th>
              <th className="px-5 py-5 text-right">الحالة</th>
              <th className="px-5 py-5 text-right">المطالبة</th>
              <th className="px-5 py-5 text-right">المستلم</th>
              <th className="px-5 py-5 text-right">المتبقي</th>
              <th className="px-5 py-5 text-right">الجنسية</th>
              <th className="px-5 py-5 text-right">الصفة</th>
              <th className="px-5 py-5 text-right">رقم العميل</th>
              <th className="px-5 py-5 text-right">تحديث السحب</th>
              <th className="px-5 py-5 text-right">سير الإجراء</th>
              <th className="px-5 py-5 text-left">إجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredCases.map((item) => (
              <tr 
                key={item.id} 
                className="hover:bg-slate-50/50 transition-colors cursor-pointer group text-sm text-slate-700 font-medium"
                onClick={() => navigate(`/cases/${item.id}`)}
              >
                <td className="px-5 py-5">
                  <div className="flex flex-col">
                    <span className="font-mono font-black text-indigo-600 line-clamp-1">{item.requestSerialNumber || item.requestNumber || '—'}</span>
                    <div className="flex flex-col gap-0.5">
                      {item.electronicReferenceNumber && <span className="text-[10px] text-indigo-500 font-mono font-bold">المرجع: {item.electronicReferenceNumber}</span>}
                      {item.najizClaimNumber && <span className="text-[10px] text-slate-400 font-mono">ناجز: {item.najizClaimNumber}</span>}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-5">
                  <span className={cn(
                    "px-2.5 py-1 rounded-lg text-[10px] font-bold border",
                    item.decisionCode === "34" ? "bg-amber-50 text-amber-700 border-amber-200" :
                    item.decisionCode === "46" ? "bg-red-50 text-red-700 border-red-200" :
                    item.decisionCode === "34+46" ? "bg-orange-50 text-orange-700 border-orange-200" :
                    item.decisionCode === "under_execution" ? "bg-blue-50 text-blue-700 border-blue-200" :
                    "bg-slate-50 text-slate-500 border-slate-100"
                  )}>
                    {item.decisionLabel || '—'}
                  </span>
                </td>
                <td className="px-5 py-5">
                  <div className="font-bold text-slate-900">{item.requestType}</div>
                  <div className="text-[11px] text-slate-400 font-normal">{item.subType}</div>
                </td>
                <td className="px-5 py-5 font-bold">
                  {item.defendantName}
                </td>
                <td className="px-5 py-5 whitespace-nowrap">
                  {renderDate(item.fileDate)}
                </td>
                <td className="px-5 py-5">
                  {getStatusBadge(item.status, item.statusLabel)}
                </td>
                <td className="px-5 py-5 font-bold text-slate-900">
                  {item.claimAmount?.toLocaleString()}
                </td>
                <td className="px-5 py-5 text-green-600 font-bold">
                  {item.receivedAmount?.toLocaleString()}
                </td>
                <td className="px-5 py-5 text-red-600 font-bold">
                  {item.remainingAmount?.toLocaleString()}
                </td>
                <td className="px-5 py-5">
                  {item.nationality}
                </td>
                <td className="px-5 py-5">
                  {item.legalCapacity}
                </td>
                <td className="px-5 py-5 font-mono">
                  {item.clientNumber}
                </td>
                <td className="px-5 py-5 text-xs text-slate-400 max-w-[150px] truncate">
                  {item.lastWithdrawalUpdate || '—'}
                </td>
                <td className="px-5 py-5 text-xs text-slate-400 max-w-[200px] truncate">
                  {item.executionProgress || '—'}
                </td>
                <td className="px-5 py-5 text-left">
                  <ChevronLeft size={18} className="text-slate-300 group-hover:text-indigo-600 transition-colors" />
                </td>
              </tr>
            ))}

            {filteredCases.length === 0 && (
              <tr>
                <td colSpan={15} className="px-6 py-20 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <FileText size={48} className="opacity-10" />
                    <p className="font-medium">
                      {cases.length === 0 ? 'لا توجد قضايا مسجلة حالياً' : 'لا توجد قضايا مطابقة لمعايير البحث الحالية.'}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Case Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 bg-slate-50/50 backdrop-blur-md">
                <h3 className="text-xl font-bold text-slate-900">إضافة ملف تنفيذي جديد</h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="max-h-[70vh] overflow-y-auto">
                <form onSubmit={handleAddCase} className="p-8 space-y-6">
                  {/* Grid layout for form fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5 opacity-60">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">الرقم التسلسلي (تلقائي)</label>
                      <div className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 font-mono text-slate-500 font-bold">
                        EXE-{new Date().getFullYear()}-XXXXX
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">رقم الطلب</label>
                      <input 
                        required
                        type="text"
                        value={formData.requestNumber}
                        onChange={(e) => setFormData({...formData, requestNumber: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono font-bold"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">نوع الطلب</label>
                      <select 
                        required
                        value={formData.requestType}
                        onChange={(e) => setFormData({...formData, requestType: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700"
                      >
                        <option value="تنفيذ">تنفيذ</option>
                        <option value="عامة">عامة</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">تاريخ الرفع (ميلادي)</label>
                      <input 
                        required
                        type="date"
                        value={formData.fileDate}
                        onChange={(e) => setFormData({...formData, fileDate: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">اسم العميل (مقدم الطلب)</label>
                      <input 
                        required
                        type="text"
                        value={formData.applicantName}
                        onChange={(e) => setFormData({...formData, applicantName: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">اسم المنفذ ضده</label>
                      <input 
                        required
                        type="text"
                        value={formData.defendantName}
                        onChange={(e) => setFormData({...formData, defendantName: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">رقم جوال المنفذ ضده</label>
                      <input 
                        type="tel"
                        value={formData.defendantPhone}
                        onChange={(e) => setFormData({...formData, defendantPhone: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono font-bold"
                        placeholder="05xxxxxxxx"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">مبلغ المطالبة</label>
                      <input 
                        required
                        type="number"
                        value={formData.claimAmount}
                        onChange={(e) => setFormData({...formData, claimAmount: Number(e.target.value)})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-900"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">المبلغ المستلم</label>
                      <input 
                        type="number"
                        value={formData.receivedAmount}
                        onChange={(e) => setFormData({...formData, receivedAmount: Number(e.target.value)})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-green-600"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">رقم العميل (في النظام)</label>
                      <input 
                        type="text"
                        value={formData.clientNumber}
                        onChange={(e) => setFormData({...formData, clientNumber: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">رقم الهوية/السجل</label>
                      <input 
                        type="text"
                        value={formData.idNumber}
                        onChange={(e) => setFormData({...formData, idNumber: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">المنصة</label>
                      <select 
                        value={formData.platform}
                        onChange={(e) => setFormData({...formData, platform: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700"
                      >
                        <option value="">اختر المنصة</option>
                        {platformOptions.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">حالة الطلب</label>
                      <select 
                        value={formData.status}
                        onChange={(e) => setFormData({...formData, status: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700"
                      >
                        {statusOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">وضع القرار</label>
                      <select 
                        value={formData.decisionCode}
                        onChange={(e) => {
                          const opt = decisionOptions.find(d => d.code === e.target.value);
                          setFormData({...formData, decisionCode: e.target.value, decisionLabel: opt?.label || ''});
                        }}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700"
                      >
                        {decisionOptions.map(opt => (
                          <option key={opt.code} value={opt.code}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">سير الإجراء التنفيذي</label>
                    <textarea 
                      value={formData.executionProgress}
                      onChange={(e) => setFormData({...formData, executionProgress: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none h-24"
                    />
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-colors"
                    >
                      إلغاء
                    </button>
                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-[2] px-4 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'إنشاء الملف التنفيذي'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Import Modal */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsImportModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden p-1"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                   <h3 className="text-xl font-bold text-slate-900">استيراد القضايا</h3>
                   <button 
                    onClick={() => setIsImportModalOpen(false)}
                    className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <DataImporter onComplete={() => {
                  fetchCases();
                  setTimeout(() => setIsImportModalOpen(false), 2000);
                }} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
