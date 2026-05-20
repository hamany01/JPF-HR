import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  Wallet, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  BarChart3,
  ArrowUpRight,
  ChevronLeft
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';

interface Case {
  id: string;
  claimAmount: number;
  receivedAmount: number;
  remainingAmount: number;
  status: string;
  statusLabel: string;
  defendantName: string;
  requestNumber: string;
}

interface CasesDashboardProps {
  cases: Case[];
}

export default function CasesDashboard({ cases }: CasesDashboardProps) {
  const stats = useMemo(() => {
    const totalClaim = cases.reduce((sum, c) => sum + (Number(c.claimAmount) || 0), 0);
    const totalReceived = cases.reduce((sum, c) => sum + (Number(c.receivedAmount) || 0), 0);
    const totalRemaining = cases.reduce((sum, c) => sum + (Number(c.remainingAmount) || 0), 0);
    const avgClaim = cases.length > 0 ? totalClaim / cases.length : 0;
    
    const statusCounts = cases.reduce((acc: Record<string, number>, c) => {
      const status = c.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, { open: 0, in_progress: 0, closed: 0 });

    const topRemaining = [...cases]
      .sort((a, b) => (Number(b.remainingAmount) || 0) - (Number(a.remainingAmount) || 0))
      .slice(0, 5);

    return { 
      totalClaim, 
      totalReceived, 
      totalRemaining, 
      avgClaim, 
      statusCounts, 
      topRemaining 
    };
  }, [cases]);

  return (
    <div className="space-y-6 mb-8" dir="rtl">
      {/* Financial Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="إجمالي المطالبة" 
          value={stats.totalClaim} 
          icon={<BarChart3 className="text-indigo-600" size={20} />}
          color="indigo"
        />
        <StatCard 
          title="إجمالي المستلم" 
          value={stats.totalReceived} 
          icon={<Wallet className="text-green-600" size={20} />}
          color="green"
        />
        <StatCard 
          title="إجمالي المتبقي" 
          value={stats.totalRemaining} 
          icon={<TrendingUp className="text-red-600" size={20} />}
          color="red"
        />
        <StatCard 
          title="متوسط المطالبة" 
          value={stats.avgClaim} 
          icon={<ArrowUpRight className="text-amber-600" size={20} />}
          color="amber"
          isAverage
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Distribution */}
        <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 mr-2">توزيع الحالات</h3>
          <div className="flex items-center justify-between gap-4">
            <StatusMetric 
              label="مفتوحة" 
              count={stats.statusCounts.open || 0} 
              icon={<AlertCircle size={14} />} 
              color="blue" 
            />
            <StatusMetric 
              label="قيد التنفيذ" 
              count={stats.statusCounts.in_progress || 0} 
              icon={<Clock size={14} />} 
              color="amber" 
            />
            <StatusMetric 
              label="منتهية" 
              count={stats.statusCounts.closed || 0} 
              icon={<CheckCircle2 size={14} />} 
              color="green" 
            />
          </div>
          
          <div className="mt-8 pt-6 border-top border-slate-50">
             <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2 px-2">
               <span>نسبة الإنجاز</span>
               <span className="font-mono">{Math.round((stats.statusCounts.closed / (cases.length || 1)) * 100)}%</span>
             </div>
             <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 transition-all duration-1000" 
                  style={{ width: `${(stats.statusCounts.closed / (cases.length || 1)) * 100}%` }}
                />
             </div>
          </div>
        </div>

        {/* Top 5 Remaining */}
        <div className="lg:col-span-2 bg-slate-900 rounded-[2rem] p-6 shadow-xl text-white">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-light text-slate-400 uppercase tracking-widest mr-2">أكبر 5 ملفات من حيث المتبقي</h3>
            <span className="text-[10px] bg-red-500/20 text-red-400 px-3 py-1 rounded-full font-bold">تتطلب متابعة</span>
          </div>
          
          <div className="space-y-3">
            {stats.topRemaining.length === 0 ? (
              <div className="py-10 text-center text-slate-500 text-sm italic">لا توجد قضايا لعرضها</div>
            ) : (
              stats.topRemaining.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all group cursor-pointer border border-white/5">
                  <div className="flex flex-col">
                    <span className="text-xs font-mono text-indigo-400 mb-1">{c.requestNumber}</span>
                    <span className="text-sm font-bold truncate max-w-[200px]">{c.defendantName}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-widest">المبلغ المتبقي</span>
                      <span className="text-lg font-black font-mono tracking-tighter text-red-400">
                        {c.remainingAmount.toLocaleString()}
                        <span className="text-[10px] font-bold text-slate-600 mr-1">ر.س</span>
                      </span>
                    </div>
                    <div className="p-2 bg-white/5 rounded-xl group-hover:bg-indigo-600 transition-colors">
                      <ChevronLeft size={16} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color, isAverage }: { title: string, value: number, icon: React.ReactNode, color: string, isAverage?: boolean }) {
  const colorClasses: Record<string, string> = {
    indigo: "bg-indigo-50 border-indigo-100",
    green: "bg-green-50 border-green-100",
    red: "bg-red-50 border-red-100",
    amber: "bg-amber-50 border-amber-100",
  };

  return (
    <div className={cn("rounded-[2rem] p-6 border shadow-sm flex flex-col justify-between h-40", colorClasses[color])}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{title}</span>
        <div className="p-2 bg-white rounded-xl shadow-sm">
          {icon}
        </div>
      </div>
      <div>
        <div className="text-2xl font-black text-slate-900 font-mono tracking-tighter leading-none mb-1">
          {value.toLocaleString(undefined, { minimumFractionDigits: isAverage ? 2 : 0, maximumFractionDigits: isAverage ? 2 : 0 })}
        </div>
        <div className="text-[10px] font-bold text-slate-400">ريال سعودي</div>
      </div>
    </div>
  );
}

function StatusMetric({ label, count, icon, color }: { label: string, count: number, icon: React.ReactNode, color: 'blue' | 'amber' | 'green' }) {
  const colors = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    green: "bg-green-50 text-green-700 border-green-100",
  };

  return (
    <div className="flex-1 flex flex-col items-center gap-2">
      <div className={cn("w-full py-3 rounded-2xl flex flex-col items-center border", colors[color])}>
        <div className="mb-1">{icon}</div>
        <span className="text-xl font-black font-mono">{count}</span>
      </div>
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
    </div>
  );
}
