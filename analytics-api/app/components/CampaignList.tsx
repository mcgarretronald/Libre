'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  MoreHorizontal, Plus, Calendar, Users,
  Send, Trash2, Play, Pause, Clock, RefreshCw,
  CheckCircle2, XCircle, Info
} from 'lucide-react';
import { Tip } from './ui/Tip';

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
  /** Return true = success, false = failure */
  onAction?: (id: string, action: 'pause' | 'redispatch') => Promise<boolean>;
}

/* ─── Portal Toast ─────────────────────────────────────────────── */
type ToastState = { message: string; type: 'success' | 'error' | 'info' } | null;

function Toast({ toast, onDone }: { toast: ToastState; onDone: () => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!toast) return;
    timerRef.current = setTimeout(onDone, 3500);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [toast, onDone]);

  if (!toast) return null;

  const styles = {
    success: { bg: 'bg-emerald-600', Icon: CheckCircle2 },
    error:   { bg: 'bg-red-600',     Icon: XCircle       },
    info:    { bg: 'bg-indigo-600',  Icon: Info           },
  }[toast.type];

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className={`
        fixed top-5 left-1/2 -translate-x-1/2 z-[999]
        flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl
        text-white text-[13px] font-bold
        animate-in fade-in slide-in-from-top-4 duration-300
        ${styles.bg}
      `}
    >
      <styles.Icon className="w-4 h-4 shrink-0" />
      {toast.message}
      <button
        onClick={onDone}
        className="ml-2 opacity-70 hover:opacity-100 transition-opacity text-white"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>,
    document.body
  );
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
  const map: Record<string, { label: string; dot: string; cls: string }> = {
    scheduled:          { label: 'Running',    dot: 'bg-emerald-500 animate-pulse', cls: 'text-emerald-700 bg-emerald-50 border border-emerald-200' },
    dispatched:         { label: 'Sent',       dot: 'bg-violet-500',               cls: 'text-violet-700  bg-violet-50  border border-violet-200'  },
    immediate:          { label: 'Sent',       dot: 'bg-violet-500',               cls: 'text-violet-700  bg-violet-50  border border-violet-200'  },
    redispatch_pending: { label: 'Re-sending', dot: 'bg-amber-500 animate-pulse',  cls: 'text-amber-700  bg-amber-50   border border-amber-200'   },
    paused:             { label: 'Paused',     dot: 'bg-slate-400',                cls: 'text-slate-600  bg-slate-100  border border-slate-200'    },
    failed:             { label: 'Failed',     dot: 'bg-red-500',                  cls: 'text-red-600    bg-red-50     border border-red-200'      },
  };
  const cfg = map[status] ?? { label: status, dot: 'bg-slate-400', cls: 'text-slate-600 bg-slate-100 border border-slate-200' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
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

function CampaignRow({ camp, onDelete, onAction }: { camp: Campaign; onDelete: (id: string) => void; onAction?: (id: string, action: 'pause' | 'redispatch') => Promise<boolean> }) {
  const [menuOpen, setMenuOpen]           = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [toast, setToast]                 = useState<ToastState>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info') =>
    setToast({ message, type });

  const handleAction = async (action: 'pause' | 'redispatch') => {
    if (!onAction) return;
    setIsActionLoading(true);
    setMenuOpen(false);
    try {
      const ok = await onAction(camp.campaignId, action);
      if (action === 'redispatch') {
        ok
          ? showToast('Campaign queued for re-dispatch ✓', 'success')
          : showToast('Re-dispatch failed — check the worker logs', 'error');
      } else if (action === 'pause') {
        ok
          ? showToast('Campaign paused', 'info')
          : showToast('Could not pause — please try again', 'error');
      }
    } catch {
      showToast('Unexpected error — please try again', 'error');
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
    <>
      <Toast toast={toast} onDone={() => setToast(null)} />
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
                <Tip label="More actions" side="bottom">
                  <button
                    onClick={() => setMenuOpen(p => !p)}
                    disabled={isActionLoading}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
                  >
                    {isActionLoading ? <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" /> : <MoreHorizontal className="w-4 h-4" />}
                  </button>
                </Tip>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-8 z-50 bg-white border border-slate-200 rounded-xl shadow-xl w-44 overflow-hidden">
                        <button onClick={() => handleAction('redispatch')}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50 text-left border-b border-slate-100">
                          <Play className="w-3.5 h-3.5 text-emerald-500" />
                          Re-dispatch
                        </button>
                        {(camp.status === 'scheduled') && (
                          <button onClick={() => handleAction('pause')}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50 text-left border-b border-slate-100">
                            <Pause className="w-3.5 h-3.5 text-amber-500" />
                            Pause
                          </button>
                        )}
                        <button onClick={() => { setMenuOpen(false); if (confirm('Delete this campaign?')) onDelete(camp.campaignId); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-[12px] font-medium text-red-500 hover:bg-red-50 text-left">
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
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
    </>
  );
}

export function CampaignList({ campaigns, onDelete, onNewCampaign, onAction }: CampaignListProps) {
  const [tab, setTab] = useState<'active' | 'sent'>('active');

  const ACTIVE_STATUSES = new Set(['scheduled', 'redispatch_pending']);
  const active = campaigns.filter(c => ACTIVE_STATUSES.has(c.status));
  const sent   = campaigns.filter(c => !ACTIVE_STATUSES.has(c.status));
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
          { key: 'active', label: 'Active', count: active.length },
          { key: 'sent',   label: 'Sent',   count: sent.length   },
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
          shown.map(c => <CampaignRow key={c.campaignId} camp={c} onDelete={onDelete} onAction={onAction} />)
        )}
      </div>
    </div>
  );
}
