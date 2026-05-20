import React, { useState, useEffect } from 'react';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  Timestamp,
  updateDoc,
  deleteDoc,
  getDocs,
  where,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'motion/react';
import { testTelegramConnection } from '../services/notificationsChannels';
import { toast } from 'react-hot-toast';
import { 
  Settings as SettingsIcon, 
  Bell as BellIcon, 
  MessageSquare as MessageSquareIcon, 
  Mail as MailIcon, 
  ShieldCheck as ShieldCheckIcon, 
  History as LucideHistory, 
  Save as SaveIcon, 
  Plus as PlusIcon, 
  Trash2 as TrashIcon, 
  Edit2 as EditIcon, 
  ExternalLink as ExternalLinkIcon, 
  CheckCircle2 as CheckCircleIcon, 
  XCircle as XCircleIcon,
  Eye as EyeIcon,
  EyeOff as EyeOffIcon,
  Users as UsersIcon,
  User as UserIcon,
  Hash as HashIcon,
  AlertCircle as AlertCircleIcon,
  RefreshCw as RefreshIcon,
  Send as SendIcon
} from 'lucide-react';
import { cn } from '../lib/utils';
import { 
  NotificationSettings, 
  NotificationRule, 
  NotificationLog,
  NotificationRecipient
} from '../types/notifications';

const TABS = [
  { id: 'settings', label: 'الإعدادات العامة', icon: SettingsIcon },
  { id: 'rules', label: 'قواعد الإشعارات', icon: ShieldCheckIcon },
  { id: 'logs', label: 'سجل الإشعارات', icon: LucideHistory },
];

export default function NotificationSettingsPage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('settings');
  const [loading, setLoading] = useState(true);
  
  // Settings State
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [showToken, setShowToken] = useState(false);
  
  // Rules State
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null);
  
  // Logs State
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  // Testing State
  const [testingCompany, setTestingCompany] = useState(false);
  const [testingPersonal, setTestingPersonal] = useState(false);

  useEffect(() => {
    // التحقق من القواعد وإنشائها تلقائياً إذا لم توجد
    checkAndInitializeRules();
  }, []);

  const checkAndInitializeRules = async () => {
    try {
      // التحقق من وجود أي قاعدة
      const rulesRef = collection(db, 'notificationRules');
      const rulesSnap = await getDocs(query(rulesRef, limit(1)));
      
      if (rulesSnap.empty) {
        console.log('🔧 [Settings] No rules found, initializing defaults...');
        await initializeDefaultRules();
        toast.success('تم تهيئة القواعد الافتراضية تلقائياً');
      } else {
        console.log('✅ [Settings] Rules already exist');
      }
    } catch (error) {
      console.error('Failed to check rules:', error);
    }
  };

  useEffect(() => {
    setLoading(true);
    
    // Listen to Settings
    const unsubscribeSettings = onSnapshot(doc(db, 'notificationSettings', 'global'), (snapshot) => {
      if (snapshot.exists()) setSettings(snapshot.data() as NotificationSettings);
      else {
        // Initialize default settings if missing
        const defaultSettings: NotificationSettings = {
          telegram: { enabled: false, botToken: '', defaultChatId: '', channels: [] },
          whatsapp: { enabled: false },
          email: { enabled: false }
        };
        setSettings(defaultSettings);
      }
    });

    // Listen to Rules
    const unsubscribeRules = onSnapshot(query(collection(db, 'notificationRules'), orderBy('eventType')), (snapshot) => {
      setRules(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NotificationRule)));
    });

    // Listen to Logs
    const unsubscribeLogs = onSnapshot(query(collection(db, 'notificationLogs'), orderBy('sentAt', 'desc'), limit(100)), (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NotificationLog)));
    });

    // Fetch users for recipient selection
    getDocs(collection(db, 'users')).then(snapshot => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    setLoading(false);
    return () => {
      unsubscribeSettings();
      unsubscribeRules();
      unsubscribeLogs();
    };
  }, []);

  const handleSaveSettings = async () => {
    if (!settings) return;
    try {
      await setDoc(doc(db, 'notificationSettings', 'global'), settings);
      toast.success('تم حفظ الإعدادات بنجاح');
    } catch (err) {
      console.error(err);
      toast.error('فشل حفظ الإعدادات');
    }
  };

  const handleRuleToggle = async (ruleId: string, enabled: boolean) => {
    try {
      await updateDoc(doc(db, 'notificationRules', ruleId), { enabled, updatedAt: serverTimestamp() });
    } catch (err) {
      console.error(err);
    }
  };

  const handleTestCompanyAccount = async () => {
    if (!settings?.telegram?.botToken || !settings?.telegram?.defaultChatId) return;
    setTestingCompany(true);
    try {
      const result = await testTelegramConnection(
        settings.telegram.botToken,
        settings.telegram.defaultChatId
      );
      if (result.success) toast.success(result.message);
      else toast.error(result.message);
    } catch (err: any) {
      toast.error('فشل الاختبار: ' + err.message);
    } finally {
      setTestingCompany(false);
    }
  };

  const handleTestPersonalAccount = async () => {
    if (!settings?.telegram?.botToken || !profile?.telegramChatId) {
      if (!profile?.telegramChatId) toast.error('لم يتم ربط حسابك بتيليجرام بعد. اذهب للملف الشخصي وأضف معرّف تيليجرام.');
      return;
    }
    setTestingPersonal(true);
    try {
      const result = await testTelegramConnection(
        settings.telegram.botToken,
        profile.telegramChatId
      );
      if (result.success) toast.success(result.message);
      else toast.error(result.message);
    } catch (err: any) {
      toast.error('فشل الاختبار: ' + err.message);
    } finally {
      setTestingPersonal(false);
    }
  };

  const initializeDefaultRules = async (force: boolean = false) => {
    try {
      const defaultRules = [
        {
          id: 'request_created_rule',
          eventType: 'request_created',
          entityType: 'request',
          label: 'طلب جديد',
          enabled: true,
          channels: {
            telegram: {
              enabled: true,
              recipients: [
                { type: 'chatId', value: '218601139' },
                { type: 'role', value: 'admin' }
              ],
              messageTemplate: null
            }
          }
        },
        {
          id: 'request_approved_preliminary_rule',
          eventType: 'request_approved_preliminary',
          entityType: 'request',
          label: 'قبول مبدئي',
          enabled: false,
          channels: {
            telegram: {
              enabled: false,
              recipients: []
            }
          }
        },
        {
          id: 'request_rejected_rule',
          eventType: 'request_rejected',
          entityType: 'request',
          label: 'رفض طلب',
          enabled: true,
          channels: {
            telegram: {
              enabled: true,
              recipients: [
                { type: 'chatId', value: '218601139' },
                { type: 'role', value: 'admin' }
              ]
            }
          }
        },
        {
          id: 'request_reactivated_rule',
          eventType: 'request_reactivated',
          entityType: 'request',
          label: 'إعادة تفعيل',
          enabled: true,
          channels: {
            telegram: {
              enabled: true,
              recipients: [
                { type: 'role', value: 'admin' }
              ]
            }
          }
        },
        {
          id: 'request_converted_to_case_rule',
          eventType: 'request_converted_to_case',
          entityType: 'request',
          label: 'تحويل لقضية',
          enabled: true,
          channels: {
            telegram: {
              enabled: true,
              recipients: [
                { type: 'chatId', value: '218601139' },
                { type: 'role', value: 'admin' },
                { type: 'role', value: 'manager' }
              ]
            }
          }
        },
        {
          id: 'case_created_rule',
          eventType: 'case_created',
          entityType: 'case',
          label: 'قضية جديدة',
          enabled: true,
          channels: {
            telegram: {
              enabled: true,
              recipients: [
                { type: 'chatId', value: '218601139' },
                { type: 'role', value: 'admin' }
              ]
            }
          }
        },
        {
          id: 'payment_added_rule',
          eventType: 'payment_added',
          entityType: 'case',
          label: 'سداد جديد',
          enabled: true,
          channels: {
            telegram: {
              enabled: true,
              recipients: [
                { type: 'chatId', value: '218601139' },
                { type: 'role', value: 'admin' }
              ]
            }
          }
        },
        {
          id: 'case_paid_off_rule',
          eventType: 'case_paid_off',
          entityType: 'case',
          label: 'سداد كامل',
          enabled: true,
          channels: {
            telegram: {
              enabled: true,
              recipients: [
                { type: 'chatId', value: '218601139' },
                { type: 'role', value: 'admin' },
                { type: 'role', value: 'manager' }
              ]
            }
          }
        },
        {
          id: 'case_status_changed_rule',
          eventType: 'case_status_changed',
          entityType: 'case',
          label: 'تغيير حالة',
          enabled: false,
          channels: {
            telegram: {
              enabled: false,
              recipients: []
            }
          }
        }
      ];

      let createdCount = 0;
      let updatedCount = 0;
      for (const ruleData of defaultRules) {
        const ruleRef = doc(db, 'notificationRules', ruleData.id);
        const ruleSnap = await getDoc(ruleRef);
        
        const { id, ...data } = ruleData;
        if (!ruleSnap.exists()) {
          await setDoc(ruleRef, {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          createdCount++;
        } else if (force) {
          await updateDoc(ruleRef, {
            ...data,
            updatedAt: serverTimestamp(),
          });
          updatedCount++;
        }
      }
      
      if (createdCount > 0 || updatedCount > 0) {
        toast.success(`تم تهيئة القواعد بنجاح (${createdCount} جديدة، ${updatedCount} تم تحديثها)`);
      } else {
        toast.success('جميع القواعد موجودة ومحدثة مسبقاً');
      }
    } catch (error) {
      console.error('Failed to initialize rules:', error);
      toast.error('فشل تهيئة القواعد');
      throw error;
    }
  };

  if (profile?.role !== 'admin') {
    return <div className="p-20 text-center font-bold text-red-500">غير مسموح لك بالوصول لهذه الصفحة</div>;
  }

  return (
    <div className="space-y-8 pb-10" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-3xl font-black text-slate-900 tracking-tight">إدارة الإشعارات المركزية</h1>
           <p className="text-slate-400 font-bold mt-1 text-sm">تحكم في القنوات، القواعد، وراقب سجلات الإرسال.</p>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={() => initializeDefaultRules(true)}
             className="bg-white text-slate-900 border border-slate-200 px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm flex items-center gap-2 hover:bg-slate-50 transition-all"
           >
            <RefreshIcon size={18} />
             <span>إعادة ضبط القواعد</span>
           </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-slate-100/50 rounded-2xl w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all",
              activeTab === tab.id 
                ? "bg-white text-indigo-600 shadow-sm" 
                : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
            )}
          >
            <tab.icon size={18} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'settings' && settings && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Telegram Settings */}
              <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                      <MessageSquareIcon size={24} />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800">إعدادات تيليجرام</h3>
                      <p className="text-xs text-slate-400 font-bold">تكوين Bot API والقنوات الافتراضية</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={settings.telegram.enabled}
                      onChange={(e) => setSettings({...settings, telegram: {...settings.telegram, enabled: e.target.checked}})}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-1">رقم البوت (Bot Token)</label>
                    <div className="relative">
                      <input 
                        type={showToken ? "text" : "password"}
                        value={settings.telegram.botToken}
                        onChange={(e) => setSettings({...settings, telegram: {...settings.telegram, botToken: e.target.value}})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-sm"
                        placeholder="8862190181:AAFpvtNB..."
                      />
                      <button 
                        onClick={() => setShowToken(!showToken)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showToken ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-1">معرف المحادثة الافتراضي (Default Chat ID)</label>
                    <input 
                      type="text"
                      value={settings.telegram.defaultChatId}
                      onChange={(e) => setSettings({...settings, telegram: {...settings.telegram, defaultChatId: e.target.value}})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-sm"
                      placeholder="218601139"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button 
                      onClick={handleTestCompanyAccount}
                      disabled={!settings.telegram.enabled || !settings.telegram.botToken || !settings.telegram.defaultChatId || testingCompany}
                      className="flex-1 bg-white border border-slate-200 text-slate-700 px-4 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <SendIcon size={14} className={testingCompany ? "animate-pulse" : ""} />
                      <span>{testingCompany ? 'جاري الإرسال...' : 'اختبار حساب الشركة'}</span>
                    </button>
                    
                    <button 
                      onClick={handleTestPersonalAccount}
                      disabled={!settings.telegram.enabled || !settings.telegram.botToken || !profile?.telegramChatId || testingPersonal}
                      className="flex-1 bg-white border border-slate-200 text-slate-700 px-4 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <UserIcon size={14} className={testingPersonal ? "animate-pulse" : ""} />
                      <span>{testingPersonal ? 'جاري الإرسال...' : 'اختبار حسابي الشخصي'}</span>
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-50">
                  <button 
                    onClick={handleSaveSettings}
                    className="w-full bg-slate-900 text-white p-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                  >
                    <SaveIcon size={18} />
                    <span>حفظ التعديلات</span>
                  </button>
                </div>
              </div>

              {/* Other Channels info */}
              <div className="space-y-6">
                <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm opacity-50 grayscale cursor-not-allowed relative overflow-hidden group">
                   <div className="absolute top-4 left-4 bg-amber-100 text-amber-600 text-[10px] font-black px-2 py-0.5 rounded-lg border border-amber-200">قريباً</div>
                   <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-green-50 text-green-600 rounded-2xl">
                      <SendIcon size={24} />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800">إشعارات واتساب</h3>
                      <p className="text-xs text-slate-400 font-bold">ربط حساب الأعمال (WhatsApp Business API)</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm opacity-50 grayscale cursor-not-allowed relative overflow-hidden group">
                   <div className="absolute top-4 left-4 bg-amber-100 text-amber-600 text-[10px] font-black px-2 py-0.5 rounded-lg border border-amber-200">قريباً</div>
                   <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-red-50 text-red-600 rounded-2xl">
                      <MailIcon size={24} />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800">إشعارات البريد</h3>
                      <p className="text-xs text-slate-400 font-bold">تكوين خادم SMTP أو SendGrid</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'rules' && (
            <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">نوع الحدث</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">القنوات المفعّلة</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">المستلمون</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">التفعيل</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rules.map(rule => (
                      <tr key={rule.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-slate-700">{formatEventLabel(rule.eventType)}</span>
                            <span className="text-[10px] text-slate-400 font-mono italic">{rule.eventType}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                             {rule.channels.telegram?.enabled && <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg" title="تيليجرام"><MessageSquareIcon size={14} /></div>}
                             {rule.channels.whatsapp?.enabled && <div className="p-1.5 bg-green-50 text-green-600 rounded-lg" title="واتساب"><SendIcon size={14} /></div>}
                             {rule.channels.email?.enabled && <div className="p-1.5 bg-red-50 text-red-600 rounded-lg" title="بريد"><MailIcon size={14} /></div>}
                             {!rule.channels.telegram?.enabled && !rule.channels.whatsapp?.enabled && !rule.channels.email?.enabled && <span className="text-[10px] text-slate-300 font-bold">لا يوجد قنوات</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                           <span className="text-xs font-black text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                             {rule.channels.telegram?.recipients?.length || 0} مستلم
                           </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="sr-only peer" 
                              checked={rule.enabled}
                              onChange={(e) => handleRuleToggle(rule.id, e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                          </label>
                        </td>
                        <td className="px-6 py-4 text-left">
                           <button 
                             onClick={() => { setEditingRule(rule); setIsRuleModalOpen(true); }}
                             className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                           >
                             <EditIcon size={16} />
                           </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">التاريخ والوقت</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">نوع الحدث</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">القناة</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">المستلم</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {logs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                           <span className="text-[10px] font-black text-slate-500 font-mono uppercase italic">
                             {log.sentAt?.toDate().toLocaleString('ar-SA')}
                           </span>
                        </td>
                        <td className="px-6 py-4">
                           <span className="text-xs font-bold text-slate-700">{formatEventLabel(log.eventType)}</span>
                        </td>
                        <td className="px-6 py-4">
                           <div className={cn(
                             "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-black uppercase",
                             log.channel === 'telegram' ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-500"
                           )}>
                             {log.channel === 'telegram' ? <MessageSquareIcon size={12} /> : null}
                             <span>{log.channel}</span>
                           </div>
                        </td>
                        <td className="px-6 py-4">
                           <span className="text-[10px] font-mono font-bold text-slate-500">{log.recipient}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                           <div className="flex justify-center" title={log.error || ''}>
                             {log.status === 'sent' ? (
                               <CheckCircleIcon className="text-emerald-500" size={18} />
                             ) : (
                               <div className="flex items-center gap-1 text-red-500">
                                 <XCircleIcon size={18} />
                                 <span className="text-[8px] font-black group-hover:block hidden">خطأ</span>
                               </div>
                             )}
                           </div>
                        </td>
                      </tr>
                    ))}
                    {logs.length === 0 && (
                      <tr><td colSpan={5} className="px-6 py-10 text-center text-xs font-bold text-slate-400">لا يوجد سجلات حالياً</td></tr>
                    )}
                  </tbody>
                </table>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Rule Modal */}
      <AnimatePresence>
        {isRuleModalOpen && editingRule && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               onClick={() => setIsRuleModalOpen(false)}
               className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" 
             />
             <motion.div
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 20 }}
               className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
             >
                <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                      <EditIcon size={20} />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800">تعديل قاعدة الإشعارات</h3>
                      <p className="text-xs text-slate-400 font-bold">{formatEventLabel(editingRule.eventType)}</p>
                    </div>
                  </div>
                  <button onClick={() => setIsRuleModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-xl">
                    <XCircleIcon size={24} />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-8">
                  {/* Channels selection */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                       <MessageSquareIcon size={16} />
                       <span>قناة تيليجرام</span>
                    </h4>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                       <span className="text-sm font-bold text-slate-700">تفعيل هذه القناة للقاعدة</span>
                       <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={editingRule.channels.telegram?.enabled}
                          onChange={(e) => setEditingRule({
                            ...editingRule, 
                            channels: {
                              ...editingRule.channels,
                              telegram: {...(editingRule.channels.telegram || {recipients: [], enabled: false}), enabled: e.target.checked}
                            }
                          })}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>

                    {editingRule.channels.telegram?.enabled && (
                      <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                         <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mr-1">المستلمون في تيليجرام</label>
                            <div className="space-y-2">
                               {editingRule.channels.telegram.recipients.map((recp, idx) => (
                                 <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                                    <div className="flex items-center gap-2">
                                       {recp.type === 'chatId' && <HashIcon size={14} className="text-slate-400" />}
                                       {recp.type === 'userId' && <UserIcon size={14} className="text-slate-400" />}
                                       {recp.type === 'role' && <UsersIcon size={14} className="text-slate-400" />}
                                       <span className="text-xs font-bold text-slate-600">
                                         {recp.type === 'chatId' ? `Chat ID: ${recp.value}` : null}
                                         {recp.type === 'userId' ? users.find(u => u.id === recp.value)?.name || recp.value : null}
                                         {recp.type === 'role' ? formatRole(recp.value) : null}
                                       </span>
                                    </div>
                                    <button 
                                      onClick={() => {
                                        const newRecp = [...editingRule.channels.telegram.recipients];
                                        newRecp.splice(idx, 1);
                                        setEditingRule({
                                          ...editingRule,
                                          channels: {...editingRule.channels, telegram: {...editingRule.channels.telegram, recipients: newRecp}}
                                        });
                                      }}
                                      className="text-red-400 hover:text-red-600 transition-colors"
                                    >
                                      <TrashIcon size={16} />
                                    </button>
                                 </div>
                               ))}
                               <div className="grid grid-cols-2 gap-2 mt-4">
                                  <button onClick={() => addRecipient('role','admin')} className="text-[10px] font-black text-indigo-600 bg-indigo-50 p-2 rounded-lg hover:bg-indigo-100 transition-colors">+ إضافة مديرين</button>
                                  <button onClick={() => addRecipient('role','company_manager')} className="text-[10px] font-black text-indigo-600 bg-indigo-50 p-2 rounded-lg hover:bg-indigo-100 transition-colors">+ إضافة مشرفين</button>
                               </div>
                            </div>
                         </div>

                         <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mr-1">قالب الرسالة (اختياري)</label>
                            <textarea 
                              value={editingRule.channels.telegram.messageTemplate || ''}
                              onChange={(e) => setEditingRule({
                                ...editingRule,
                                channels: {...editingRule.channels, telegram: {...editingRule.channels.telegram, messageTemplate: e.target.value}}
                              })}
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-xs h-24"
                              placeholder="يمكنك استخدام: {message}, {serialNumber}, {type}"
                            />
                         </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-6 bg-slate-50/50 border-t border-slate-50 flex gap-3">
                   <button 
                     onClick={() => setIsRuleModalOpen(false)}
                     className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-white transition-all text-sm"
                   >إلغاء</button>
                   <button 
                     onClick={handleSaveRule}
                     className="flex-1 px-4 py-3 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all text-sm"
                   >حفظ القاعدة</button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );

  function addRecipient(type: any, value: string) {
    if (!editingRule) return;
    const exists = editingRule.channels.telegram.recipients.find(r => r.type === type && r.value === value);
    if (!exists) {
      setEditingRule({
        ...editingRule,
        channels: {
          ...editingRule.channels,
          telegram: {
            ...editingRule.channels.telegram,
            recipients: [...editingRule.channels.telegram.recipients, { type, value }]
          }
        }
      });
    }
  }

  async function handleSaveRule() {
    if (!editingRule) return;
    try {
      const { id, ...data } = editingRule;
      await setDoc(doc(db, 'notificationRules', id), { ...data, updatedAt: serverTimestamp() });
      setIsRuleModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('فشل حفظ القاعدة');
    }
  }
}

function formatEventLabel(type: string) {
  const map: Record<string, string> = {
    'request_created': 'طلب جديد',
    'request_approved_preliminary': 'قبول مبدئي',
    'request_rejected': 'رفض طلب',
    'request_reactivated': 'إعادة تنشيط',
    'request_converted_to_case': 'تحويل لقضية',
    'case_created': 'قضية جديدة',
    'payment_added': 'سداد جديد',
    'case_paid_off': 'سداد كامل',
    'case_status_changed': 'تغيير حالة قضية'
  };
  return map[type] || type;
}

function formatRole(role: string) {
  const map: Record<string, string> = {
    'admin': 'مدير نظام',
    'company_manager': 'مدير شركة',
    'law_manager': 'مدير مكتب محاماة',
    'employee': 'موظف'
  };
  return map[role] || role;
}
