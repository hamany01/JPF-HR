import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

interface ChartDataItem {
  name: string;
  value: number;
  color: string;
}

interface StatusPieChartProps {
  data: ChartDataItem[];
  totalCount: number;
}

export default function StatusPieChart({ data, totalCount }: StatusPieChartProps) {
  return (
    <div className="w-full h-full flex flex-col justify-between" dir="rtl">
      <div className="h-[200px] w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={85}
              paddingAngle={6}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: '16px',
                border: 'none',
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                color: '#fff',
                direction: 'rtl',
                textAlign: 'right',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                padding: '10px 14px',
              }}
              itemStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}
              labelStyle={{ display: 'none' }}
              formatter={(value, name) => [`${value} معاملة`, name]}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-black text-slate-800 dark:text-white leading-none">
            {totalCount}
          </span>
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
            إجمالي المعاملات
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4">
        {data.map((item, index) => (
          <div key={index} className="flex items-center justify-between text-xs p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100/50 dark:border-slate-800/40 hover:bg-slate-100/80 dark:hover:bg-slate-900 duration-200">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="font-bold text-slate-600 dark:text-slate-400">{item.name}</span>
            </div>
            <span className="font-black text-slate-800 dark:text-slate-200 font-mono">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
