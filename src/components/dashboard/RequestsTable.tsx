import React from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import { ChevronLeft, Eye, ShieldAlert, BadgeDollarSign, User, HelpCircle, Hash, Clock } from 'lucide-react';

interface RequestsTableProps {
  requests: any[];
  onView: (id: string | any) => void;
}

export default function RequestsTable({ requests, onView }: RequestsTableProps) {
  const { viewField, getFieldVisibility } = usePermissions();

  const serialNumberVisibility = getFieldVisibility('serialNumber');
  const clientNameVisibility = getFieldVisibility('clientName');
  const nationalIdVisibility = getFieldVisibility('nationalId');
  const financialAmountsVisibility = getFieldVisibility('financialAmounts');

  // تنسيق العملة
  const formatCurrency = (val: number) => {
    if (!val && val !== 0) return '-';
    return val.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            قيد المراجعة
          </span>
        );
      case 'approved_preliminary':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            موافق عليه مبدئياً
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            مكتمل ومعتمد
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            مرفوض
          </span>
        );
      case 'converted_to_case':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            مُحوّل إلى قضية
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-400 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  const getRelativeTime = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = typeof timestamp.toDate === 'function' ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/40 shadow-sm" dir="rtl">
      <div className="overflow-x-auto">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="bg-slate-50/50 dark:bg-slate-900/80 border-b border-slate-100 dark:border-slate-800">
              {serialNumberVisibility !== 'hidden' && (
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap">
                  <span className="flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5" />
                    رقم الطلب
                  </span>
                </th>
              )}
              {clientNameVisibility !== 'hidden' && (
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    اسم العميل
                  </span>
                </th>
              )}
              {nationalIdVisibility !== 'hidden' && (
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap">
                  رقم الهوية / الإقامة
                </th>
              )}
              {financialAmountsVisibility !== 'hidden' && (
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap">
                  <span className="flex items-center gap-1">
                    <BadgeDollarSign className="w-3.5 h-3.5" />
                    المبلغ المطالب به
                  </span>
                </th>
              )}
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap">
                حالة الطلب
              </th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  آخر تحديث
                </span>
              </th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap text-center">
                خيارات
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60 bg-white dark:bg-transparent">
            {requests.map((r) => {
              const serialNum = r.requestSerialNumber || r.id;
              const clName = r.clientName || '-';
              const natId = r.clientId || r.nationalId || '-';
              const claimAmt = r.claimAmount || 0;

              return (
                <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/30 transition-colors">
                  {/* رقم الطلب */}
                  {serialNumberVisibility !== 'hidden' && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs font-black text-slate-700 dark:text-slate-300 font-mono">
                        {viewField('serialNumber', serialNum)}
                      </span>
                    </td>
                  )}

                  {/* اسم العميل */}
                  {clientNameVisibility !== 'hidden' && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {viewField('clientName', clName)}
                      </span>
                    </td>
                  )}

                  {/* رقم الهوية */}
                  {nationalIdVisibility !== 'hidden' && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs font-bold font-mono text-slate-500 dark:text-slate-400">
                        {viewField('nationalId', natId)}
                      </span>
                    </td>
                  )}

                  {/* المبالغ المالية */}
                  {financialAmountsVisibility !== 'hidden' && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
                        {financialAmountsVisibility === 'masked' 
                          ? '***,*** ر.س' 
                          : formatCurrency(claimAmt)}
                      </span>
                    </td>
                  )}

                  {/* حالة الطلب */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(r.status)}
                  </td>

                  {/* آخر تحديث */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 font-mono">
                      {getRelativeTime(r.updatedAt || r.createdAt)}
                    </span>
                  </td>

                  {/* زر عرض التفاصيل */}
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <button
                      type="button"
                      onClick={() => onView(r.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-950 bg-slate-50/50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer shadow-none hover:shadow-sm"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>عرض</span>
                    </button>
                  </td>
                </tr>
              );
            })}

            {requests.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-50/10">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <ShieldAlert className="w-8 h-8 text-slate-350" />
                    <span>لا توجد معاملات جارية حالياً لهذا الاختيار.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
