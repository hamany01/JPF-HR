import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Settings as SettingsIcon, Globe, Activity as ActivityIcon, Sliders, Users } from 'lucide-react';
import { cn } from '../lib/utils';
import ExecutionPlatformsSettings from '../components/settings/ExecutionPlatformsSettings';
import ExecutionStatusSettings from '../components/settings/ExecutionStatusSettings';
import RequestorsSettings from '../components/settings/RequestorsSettings';
import GeneralExecutionSettings from '../components/settings/GeneralExecutionSettings';

type TabType = 'platforms' | 'statuses' | 'requestors' | 'general';

export default function ExecutionSettingsHomePage() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('platforms');

  if (!isAdmin) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400 gap-2">
      <div className="p-4 bg-slate-50 rounded-full">
        <SettingsIcon size={48} className="opacity-20" />
      </div>
      <p className="font-bold">غير مسموح لك بالوصول لهذه الصفحة</p>
    </div>
  );

  const tabs = [
    { id: 'platforms', label: 'منصات التنفيذ', icon: Globe },
    { id: 'statuses', label: 'حالات القضايا', icon: ActivityIcon },
    { id: 'requestors', label: 'مقدمو الطلبات', icon: Users },
    { id: 'general', label: 'إعدادات متقدمة', icon: Sliders },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
          <SettingsIcon size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">الإعدادات التنفيذية</h1>
          <p className="text-slate-500 text-sm">إدارة المنصات، الحالات، وخيارات النظام المتقدمة</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-[1.5rem] w-fit overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all whitespace-nowrap",
                isActive 
                  ? "bg-white text-indigo-600 shadow-sm shadow-slate-200" 
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50/50"
              )}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm min-h-[500px]">
        {activeTab === 'platforms' && <ExecutionPlatformsSettings />}
        {activeTab === 'statuses' && <ExecutionStatusSettings />}
        {activeTab === 'requestors' && <RequestorsSettings />}
        {activeTab === 'general' && <GeneralExecutionSettings />}
      </div>
    </div>
  );
}
