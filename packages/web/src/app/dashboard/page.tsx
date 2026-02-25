'use client';

import { useEffect } from 'react';
import { useDashboardStore } from '@/store/dashboard-store';
import { DashboardBody } from '@useai/ui';

export default function DashboardPage() {
  const { sessions, milestones, loading, loadAll, activeTab, setActiveTab } = useDashboardStore();

  useEffect(() => { loadAll(); }, [loadAll]);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-text-muted text-sm">Loading sessions...</div>;
  }

  return (
    <DashboardBody
      sessions={sessions}
      milestones={milestones}
      defaultTimeScale="week"
      activeTab={activeTab}
      onActiveTabChange={setActiveTab}
    />
  );
}
