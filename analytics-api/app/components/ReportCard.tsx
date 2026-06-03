'use client';

import { useState } from 'react';
import { Send, Terminal, Trash2, Eye, Download, ChevronDown, CheckCircle2, Database, X, BarChart2, FileText, Image, Maximize } from 'lucide-react';
import { Tip } from './ui/Tip';

interface Report {
  id: string | number;
  query: string;
  summary?: string;
  timestamp: string;
  htmlUrl?: string;
  sql?: string;
  details?: string;
  status?: string;
  rowCount?: number;
  fallbackSimulated?: boolean;
}

interface ReportCardProps {
  report: Report;
  onDelete: (id: string | number) => void;
  onDispatch: (report: Report) => void;
}

export function ReportCard({ report, onDelete, onDispatch }: ReportCardProps) {
  const [expanded,     setExpanded]     = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const [exporting,    setExporting]    = useState<'pdf' | 'png' | null>(null);
  const [showLightbox, setShowLightbox] = useState(false);

  const shortId = String(report.id).slice(-4).toUpperCase();
  const date    = new Date(report.timestamp);
  const dateStr = date.toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi', day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-KE', { timeZone: 'Africa/Nairobi', hour: '2-digit', minute: '2-digit' });

  const handleExport = async (format: 'pdf' | 'png') => {
    setExporting(format);
    setShowDownload(false);
    try {
      const res = await fetch(`/api/analytics/export/${report.id}?format=${format}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `jacaranda-report-${shortId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExporting(null);
    }
  };

  return (
    <>
    <div className={`bg-card rounded-xl border transition-all duration-200 group relative
      ${showDownload ? 'overflow-visible z-20' : 'overflow-hidden z-10'}
      ${expanded ? 'border-[#3B143C]/30 shadow-md dark:border-[#E06A55]/20' : 'border-border shadow-sm hover:shadow-md hover:border-border/80'}`}>

      {/* ── Collapsed row ── */}
      <div className="flex items-center min-w-0">

        {/* Expand toggle */}
        <button
          className="flex-1 flex items-center gap-4 px-5 py-3.5 text-left min-w-0"
          onClick={() => setExpanded(p => !p)}
        >
          <div className={`shrink-0 w-2 h-2 rounded-full ${report.fallbackSimulated ? 'bg-amber-400' : 'bg-[#1E6B65]'}`} />
          <div className="shrink-0 w-7 h-7 rounded-lg bg-[#3B143C]/8 dark:bg-[#3B143C]/20 flex items-center justify-center">
            <BarChart2 className="w-3.5 h-3.5 text-[#3B143C]/60 dark:text-[#E06A55]/60" />
          </div>
          <span className="flex-1 text-[13px] font-semibold text-foreground truncate pr-4 text-left">
            {report.query.length > 80 ? report.query.slice(0, 80) + '…' : report.query}
          </span>
          <div className="shrink-0 flex items-center gap-3">
            {report.rowCount !== undefined && (
              <span className="hidden md:flex items-center gap-1 text-[10px] font-bold text-muted-foreground bg-muted px-2 py-1 rounded-lg">
                <Database className="w-2.5 h-2.5" />
                {report.rowCount} rows
              </span>
            )}
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[11px] font-bold text-muted-foreground">{dateStr}</span>
              <span className="text-[10px] text-muted-foreground/60">{timeStr}</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {/* Quick actions */}
        <div className="shrink-0 flex items-center gap-1 pr-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <Tip label="Send as Campaign">
            <button
              onClick={() => onDispatch(report)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-[#E06A55] hover:bg-[#E06A55]/10 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </Tip>

          {/* Download with format picker */}
          <div className="relative">
            <Tip label="Download">
              <button
                onClick={() => setShowDownload(p => !p)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                {exporting ? (
                  <div className="w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
              </button>
            </Tip>
            {showDownload && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowDownload(false)} />
                <div className="absolute right-0 top-8 z-50 bg-popover border border-border rounded-xl shadow-xl overflow-hidden w-40 animate-in fade-in slide-in-from-top-1 duration-150">
                  <button
                    onClick={() => handleExport('pdf')}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-foreground hover:bg-accent transition-colors text-left border-b border-border"
                  >
                    <FileText className="w-4 h-4 text-[#E06A55]" />
                    Download PDF
                  </button>
                  <button
                    onClick={() => handleExport('png')}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-foreground hover:bg-accent transition-colors text-left"
                  >
                    <Image className="w-4 h-4 text-[#1E6B65]" />
                    Download PNG
                  </button>
                </div>
              </>
            )}
          </div>

          <Tip label="Delete report" side="top">
            <button
              onClick={() => onDelete(report.id)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </Tip>
        </div>
      </div>

      {/* ── Expanded content ── */}
      {expanded && (
        <div className="border-t border-border animate-in slide-in-from-top-1 fade-in duration-200">

          {/* AI Summary */}
          {report.summary && (
            <div className="px-5 py-4 bg-gradient-to-r from-muted/50 to-card border-b border-border">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-1 min-h-[2rem] rounded-full bg-[#E06A55] shrink-0" />
                <div>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">AI Summary</p>
                  <p className="text-[13px] text-foreground leading-relaxed">{report.summary}</p>
                  {report.fallbackSimulated && (
                    <p className="text-[11px] text-amber-600 font-semibold mt-2 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                      Estimated data — live ClickHouse query returned no results.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Chart preview */}
          <div className="bg-muted/40 p-4">
            <div className="rounded-xl overflow-hidden border border-border bg-card shadow-sm relative group/iframe">
              {report.htmlUrl ? (
                <>
                  <iframe
                    src={report.htmlUrl}
                    className="w-full bg-white"
                    style={{ height: '380px', border: 'none' }}
                    title={`Report ${shortId}`}
                  />
                  <Tip label="Expand preview" side="left">
                    <button
                      onClick={() => setShowLightbox(true)}
                      className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-black text-white rounded-lg opacity-0 group-hover/iframe:opacity-100 transition-all shadow-md"
                    >
                      <Maximize className="w-4 h-4" />
                    </button>
                  </Tip>
                </>
              ) : (
                <div className="h-40 flex flex-col items-center justify-center text-slate-300">
                  <Eye className="w-7 h-7 mb-2" />
                  <p className="text-xs font-bold uppercase tracking-widest">Preview unavailable</p>
                </div>
              )}
            </div>
          </div>

          {/* Action bar */}
          <div className="flex items-center justify-between px-5 py-3 bg-card border-t border-border">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onDispatch(report)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider text-white transition-all hover:opacity-90 shadow-sm"
                style={{ background: 'linear-gradient(135deg, #E06A55, #c95a46)' }}
              >
                <Send className="w-3.5 h-3.5" />
                Send as Campaign
              </button>

              {/* Download with format picker (expanded action bar) */}
              <div className="relative">
                <button
                  onClick={() => setShowDownload(p => !p)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider text-foreground bg-muted hover:bg-accent transition-colors"
                >
                  {exporting ? (
                    <div className="w-3 h-3 border-2 border-slate-400 border-t-slate-700 rounded-full animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  {exporting ? `Exporting ${exporting.toUpperCase()}…` : 'Download'}
                </button>
                {showDownload && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowDownload(false)} />
                    <div className="absolute left-0 top-10 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden w-44 animate-in fade-in slide-in-from-top-1 duration-150">
                      <button
                        onClick={() => handleExport('pdf')}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors text-left border-b border-slate-100"
                      >
                        <FileText className="w-4 h-4 text-[#E06A55]" />
                        Download PDF
                      </button>
                      <button
                        onClick={() => handleExport('png')}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors text-left"
                      >
                        <Image className="w-4 h-4 text-[#1E6B65]" />
                        Download PNG
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <button
              onClick={() => onDelete(report.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>

        </div>
      )}
    </div>

      {/* ── Lightbox Modal ── */}
      {showLightbox && report.htmlUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 sm:p-8 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full max-w-7xl max-h-full rounded-2xl overflow-hidden relative flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-100 border-b border-slate-200 shrink-0">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-[#E06A55]" />
                Interactive Report Preview
              </h3>
              <button
                onClick={() => setShowLightbox(false)}
                className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden bg-white w-full h-full relative">
              <iframe
                src={report.htmlUrl}
                className="absolute inset-0 w-full h-full border-none"
                title={`Report ${shortId} Fullscreen`}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
