import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface LineChartDataItem {
  date: string;
  count: number;
}

interface CompletionLineChartProps {
  data: LineChartDataItem[];
}

export default function CompletionLineChart({ data }: CompletionLineChartProps) {
  return (
    <div className="w-full h-full" dir="rtl">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#10b98110" />
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} 
            dy={8}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
          />
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
            formatter={(value) => [`${value} معاملة مكتملة`, 'العدد']}
          />
          <Line 
            type="monotone" 
            dataKey="count" 
            stroke="#10b981" 
            strokeWidth={3} 
            dot={{ r: 4, stroke: '#10b981', strokeWidth: 2, fill: '#fff' }}
            activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2, fill: '#10b981' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
