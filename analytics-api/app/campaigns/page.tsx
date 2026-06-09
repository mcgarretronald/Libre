'use client';

import React, { useState, useEffect } from 'react';
import { CampaignList } from '../components/CampaignList';
import { DashboardLayout } from '../components/DashboardLayout';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);

  const fetchCampaigns = async () => {
    try {
      const r = await fetch('/api/analytics/campaigns');
      const d = await r.json();
      if (d.success && Array.isArray(d.data)) setCampaigns(d.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;
    setCampaigns(p => p.filter(c => c.campaignId !== id));
    try { await fetch(`/api/analytics/campaigns/${id}`, { method: 'DELETE' }); } catch (_) {}
  };

  const handleCampaignAction = async (id: string, action: 'pause' | 'redispatch') => {
    try {
      const res = await fetch('/api/analytics/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) return false;
      fetchCampaigns();
      return true;
    } catch (e) {
      console.error('Action failed', e);
      return false;
    }
  };

  return (
    <DashboardLayout title="Campaign Manager">
      <div className="flex-1 overflow-y-auto px-6 py-6 bg-background transition-colors duration-300">
        <div className="max-w-4xl mx-auto">
          <CampaignList
            campaigns={campaigns}
            onDelete={handleDeleteCampaign}
            onAction={handleCampaignAction}
            onNewCampaign={() => {
              window.location.href = '/';
            }}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
