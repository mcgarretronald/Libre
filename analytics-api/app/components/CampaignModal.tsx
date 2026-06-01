'use client';

import { useState } from 'react';
import { X, Download, ChevronDown, Send, Trash2 } from 'lucide-react';

interface Recipient { email: string; name?: string; }

interface CampaignModalProps {
  report: { id: string | number; query: string } | null;
  csvRecipients: Recipient[];
  setCsvRecipients: (r: Recipient[]) => void;
  schedule: string;
  setSchedule: (s: string) => void;
  customCron: string;
  setCustomCron: (s: string) => void;
  isSending: boolean;
  handleDispatch: () => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClose: () => void;
}

export function CampaignModal({
  report, csvRecipients, setCsvRecipients,
  schedule, setSchedule, customCron, setCustomCron,
  isSending, handleDispatch, handleFileChange, onClose,
}: CampaignModalProps) {
  const [manualEmail, setManualEmail] = useState('');
  if (!report) return null;

  const addEmail = () => {
    const email = manualEmail.toLowerCase().trim();
    if (!email.includes('@')) return;
    if (!csvRecipients.find(r => r.email === email)) {
      setCsvRecipients([...csvRecipients, { email }]);
    }
    setManualEmail('');
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      style={{ background: 'rgba(15, 5, 16, 0.55)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal */}
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between">
          <div>
            <h2 className="text-base font-black text-slate-900">Send as Campaign</h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5 max-w-[340px] truncate">
              {report.query.length > 55 ? report.query.slice(0, 55) + '…' : report.query}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors shrink-0 ml-4"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">

          {/* Recipients */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2.5">
              Recipients
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="email"
                placeholder="Add email address…"
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmail(); } }}
                className="flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#3B143C] bg-white font-medium"
              />
              <label className="px-3 py-2.5 border border-slate-200 hover:border-[#E06A55] rounded-xl cursor-pointer flex items-center gap-2 text-slate-500 hover:text-[#E06A55] transition-colors group shrink-0">
                <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                <Download className="w-4 h-4 rotate-180 group-hover:-translate-y-0.5 transition-transform" />
                <span className="text-xs font-black uppercase tracking-wider">CSV</span>
              </label>
            </div>

            {csvRecipients.length > 0 && (
              <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                    {csvRecipients.length} recipient{csvRecipients.length !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={() => setCsvRecipients([])}
                    className="text-[10px] font-black text-red-400 hover:text-red-600 uppercase tracking-widest"
                  >
                    Clear all
                  </button>
                </div>
                <div className="max-h-36 overflow-y-auto">
                  {csvRecipients.map((r, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2 hover:bg-slate-100 group transition-colors">
                      <span className="text-xs font-medium text-slate-600 truncate">
                        {r.name ? <><span className="text-slate-800 font-semibold">{r.name}</span> — </> : null}{r.email}
                      </span>
                      <button
                        onClick={() => setCsvRecipients(csvRecipients.filter((_, idx) => idx !== i))}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 ml-2 shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Schedule */}
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2.5">
              Schedule
            </label>
            <div className="relative">
              <select
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                className="w-full bg-white border-2 border-slate-200 text-slate-700 rounded-xl pl-4 pr-10 py-3 text-sm font-semibold focus:outline-none focus:border-[#3B143C] appearance-none"
              >
                <option value="immediate">Send now</option>
                <option value="daily">Every day at 8:00 AM</option>
                <option value="weekly">Every Monday at 9:00 AM</option>
                <option value="custom">Custom schedule</option>
              </select>
              <ChevronDown className="absolute right-3.5 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            {schedule === 'custom' && (
              <input
                type="text"
                value={customCron}
                onChange={(e) => setCustomCron(e.target.value)}
                placeholder="Cron expression — e.g. 0 8 * * 1"
                className="mt-2 w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-[#3B143C]"
              />
            )}

            {(schedule === 'weekly' || schedule === 'daily') && (
              <p className="mt-2 text-[11px] text-[#1E6B65] font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1E6B65] inline-block animate-pulse" />
                Fresh data is generated at send time every {schedule === 'weekly' ? 'week' : 'day'}.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDispatch}
            disabled={isSending || csvRecipients.length === 0}
            className="flex-1 py-3 rounded-xl text-sm font-black text-white flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #1E6B65, #145a54)' }}
          >
            <Send className="w-4 h-4" />
            {isSending ? 'Sending…' : `Send to ${csvRecipients.length || '—'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
