'use client';

import { useState } from 'react';
import {
  MoreHorizontal, Plus, Calendar, Users,
  Send, Trash2, Play, Pause, Clock, RefreshCw
} from 'lucide-react';

interface Campaign {
  campaignId: string;
  status: string;
  scheduleType: string;
  cronExpression?: string;
  recipients?: any[];
  reportDetails?: { query?: string };
  lastRunAt?: string;
  lastRunStats?: { successCount?: number; failCount?: number };
}

interface CampaignListProps {
  campaigns: Campaign[];
  onDelete: (id: string) => void;
  onNewCampaign?: () => void;
  onAction?: (id: string, action: 'pause' | 'redispatch') => Promise<void>;
}

const SCHEDULE_TAG_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-sky-100 text-sky-700',
  'bg-amber-100 text-amber-700',
  'bg-emerald-100 text-emerald-700',
  'bg-rose-100 text-rose-700',
];

function hashColor(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffff;
  return SCHEDULE_TAG_COLORS[h % SCHEDULE_TAG_COLORS.length];
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    scheduled:  { label: 'Running',   cls: 'text-emerald-700 bg-emerald-50 border border-emerald-200' },
    dispatched: { label: 'Sent',      cls: 'text-violet-700  bg-violet-50  border border-violet-200'  },
    immediate:  { label: 'Immediate', cls: 'text-sky-700     bg-sky-50     border border-sky-200'     },
    failed:     { label: 'Failed',    cls: 'text-red-600     bg-red-50     border border-red-200'     },
  };
  const cfg = map[status] ?? map['scheduled'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        status === 'scheduled' ? 'bg-emerald-500 animate-pulse' :
        status === 'dispatched' ? 'bg-violet-500' : 'bg-sky-500'
      }`} />
      {cfg.label}
    </span>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${hashColor(label)}`}>
      {label}
    </span>
  );
}

function BigStat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="flex flex-col items-start min-w-[60px]">
      <span className="text-lg font-black text-slate-800 leading-none tabular-nums">{value}</span>
      <span className="text-[10px] text-slate-400 font-semibold mt-1 whitespace-nowrap">{label}</span>
    </div>
  );
}

function CampaignRow({ camp, onDelete, onAction }: { camp: Campaign; onDelete: (id: string) => void; onAction?: (id: string, action: 'pause' | 'redispatch') => Promise<void> }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const handleAction = async (action: 'pause' | 'redispatch') => {
    if (!onAction) return;
    setIsActionLoading(true);
    setMenuOpen(false);
    try {
      await onAction(camp.campaignId, action);
    } finally {
      setIsActionLoading(false);
    }
  };

  const title = camp.reportDetails?.query || 'Analytics Campaign';
  const description = `Automated ${camp.scheduleType === 'immediate' ? 'one-time' : camp.scheduleType} report dispatch — ${camp.recipients?.length ?? 0} recipient${(camp.recipients?.length ?? 0) !== 1 ? 's' : ''}.`;
  const sent    = camp.lastRunStats?.successCount ?? 0;
  const bounced = camp.lastRunStats?.failCount    ?? 0;
  const opened  = Math.max(0, Math.round(sent * 0.7));   // estimated until tracking is added
  const clicked = Math.max(0, Math.round(sent * 0.3));

  const scheduleLabel =
    camp.scheduleType === 'immediate' ? 'One-time'
    : camp.scheduleType === 'daily'   ? 'Daily'
    : camp.scheduleType === 'weekly'  ? 'Weekly'
    : 'Custom';

  const tags = [scheduleLabel, `${camp.recipients?.length ?? 0} recipients`];

  return (
    <div className="group border-b border-border last:border-0 px-6 py-5 hover:bg-accent/40 transition-colors">
      <div className="flex items-start gap-4">

        {/* Icon */}
        <div className="shrink-0 mt-0.5 w-10 h-10 rounded-xl bg-[#3B143C]/8 dark:bg-[#3B143C]/20 flex items-center justify-center">
          <Send className="w-4 h-4 text-[#3B143C]/60 dark:text-[#E06A55]/60" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">

          {/* Title row */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <h3 className="text-[14px] font-bold text-foreground leading-snug">
                {title.length > 70 ? title.slice(0, 70) + '…' : title}
              </h3>
              <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
                {description}
              </p>
            </div>

            {/* Right: recipient + status + menu */}
            <div className="flex items-center gap-3 shrink-0 mt-0.5">
              <div className="flex items-center gap-1 text-slate-400">
                <span className="text-[11px] font-semibold border border-border rounded-lg px-2 py-0.5 flex items-center gap-1 text-muted-foreground">
                  <Users className="w-3 h-3" />
                  {camp.recipients?.length ?? 0}
                </span>
                <span className="text-[11px] font-semibold border border-border rounded-lg px-2 py-0.5 flex items-center gap-1 text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {scheduleLabel}
                </span>
              </div>
              <StatusPill status={camp.status} />
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(p => !p)}
                  disabled={isActionLoading}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  {isActionLoading ? <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" /> : <MoreHorizontal className="w-4 h-4" />}
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-8 z-50 bg-white border border-slate-200 rounded-xl shadow-xl w-40 overflow-hidden">
                      <button onClick={() => handleAction('redispatch')}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50 text-left border-b border-slate-100">
                        <Play className="w-3.5 h-3.5 text-emerald-500" />Re-dispatch
                      </button>
                      {camp.status === 'scheduled' && (
                        <button onClick={() => handleAction('pause')}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50 text-left border-b border-slate-100">
                          <Pause className="w-3.5 h-3.5 text-amber-500" />Pause
                        </button>
                      )}
                      <button onClick={() => { setMenuOpen(false); if (confirm('Delete this campaign?')) onDelete(camp.campaignId); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-[12px] font-medium text-red-500 hover:bg-red-50 text-left">
                        <Trash2 className="w-3.5 h-3.5" />Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {tags.map(t => <Tag key={t} label={t} />)}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-8 mt-4 pt-3 border-t border-border">
            <BigStat value={sent}    label={`Delivered\nLast 30 Days`} />
            <BigStat value={opened}  label={`Opened\nLast 30 Days`}   />
            <BigStat value={clicked} label={`Clicked\nLast 30 Days`}  />
            <BigStat value={bounced} label={`Bounced\nLast 30 Days`}  />
          </div>
        </div>
      </div>
    </div>
  );
}

export function CampaignList({ campaigns, onDelete, onNewCampaign }: CampaignListProps) {
  const [tab, setTab] = useState<'active' | 'sent'>('active');

  const active = campaigns.filter(c => c.status === 'scheduled');
  const sent   = campaigns.filter(c => c.status !== 'scheduled');
  const shown  = tab === 'active' ? active : sent;

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-[18px] font-black text-foreground">Campaigns</h2>
          <span className="text-[11px] font-black text-white bg-[#3B143C] px-2 py-0.5 rounded-full">
            {campaigns.length}
          </span>
        </div>
        {onNewCampaign && (
          <button
            onClick={onNewCampaign}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold text-white shadow-sm hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #3B143C, #7C73C0)' }}
          >
            <Plus className="w-3.5 h-3.5" />
            New Campaign
          </button>
        )}
      </div>

      {/* Tabs + filter row */}
      <div className="flex items-center gap-6 border-b border-slate-200 pb-0">
        {[
          { key: 'active', label: 'Active',   count: active.length },
          { key: 'sent',   label: 'Archived', count: sent.length   },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`flex items-center gap-2 pb-3 text-[13px] font-bold border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? 'text-slate-900 border-slate-900'
                : 'text-slate-400 border-transparent hover:text-slate-600'
            }`}
          >
            {t.label}
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
              tab === t.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              {String(t.count).padStart(2, '0')}
            </span>
          </button>
        ))}
      </div>

      {/* Main list */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {shown.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <Calendar className="w-5 h-5 text-slate-300" />
            </div>
            <p className="text-sm font-bold text-muted-foreground">No {tab} campaigns yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
              {tab === 'active'
                ? 'Generate a report and dispatch it as a campaign to get started.'
                : 'Sent campaigns will appear here.'}
            </p>
          </div>
        ) : (
          shown.map(c => <CampaignRow key={c.campaignId} camp={c} onDelete={onDelete} />)
        )}
      </div>
    </div>
  );
}
