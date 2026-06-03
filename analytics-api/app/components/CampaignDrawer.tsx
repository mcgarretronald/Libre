'use client';

import { useState, useEffect } from 'react';
import { X, Download, ChevronDown, Send, Trash2, FileText } from 'lucide-react';

interface Recipient { email: string; name?: string; isActive?: boolean; }

interface CampaignDrawerProps {
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

export function CampaignDrawer({
  report, csvRecipients, setCsvRecipients,
  schedule, setSchedule, customCron, setCustomCron,
  isSending, handleDispatch, handleFileChange, onClose,
}: CampaignDrawerProps) {
  const [manualEmail, setManualEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (report) {
      setSubject(report.query || 'Analytics Report');
      setBody(`Hi Team,\n\nPlease find the latest analytics report attached.\n\nHere is the AI summary of the data:\n\n${report.summary || 'No summary available.'}\n\nBest,\nJacaranda Analytics`);
    }
  }, [report]);

  if (!report) return null;

  const addEmail = () => {
    const email = manualEmail.toLowerCase().trim();
    if (!email.includes('@')) return;
    if (!csvRecipients.find(r => r.email === email)) {
      setCsvRecipients([...csvRecipients, { email }]);
    }
    setManualEmail('');
  };

  const filteredRecipients = csvRecipients
    .map((r, originalIndex) => ({ ...r, originalIndex }))
    .filter(r => 
      r.email.toLowerCase().includes(searchQuery.toLowerCase()) || 
      r.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Centered Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none">
        <aside className="w-full max-w-5xl bg-background rounded-xl shadow-xl flex flex-col md:flex-row animate-in zoom-in-95 fade-in duration-200 overflow-hidden pointer-events-auto border border-border max-h-full h-[85vh]">

          {/* Left Column - Settings */}
          <div className="w-full md:w-80 lg:w-96 bg-muted/30 flex flex-col border-r border-border shrink-0">
            <div className="px-6 py-5 border-b border-border shrink-0 bg-background">
              <h2 className="text-base font-black text-foreground">Campaign Setup</h2>
              <p className="text-[11px] text-muted-foreground mt-1 font-semibold uppercase tracking-widest truncate">
                Recipients & Schedule
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Recipients */}
              <div>
                <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3">Recipients</label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="email"
                    placeholder="Add email address..."
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmail(); } }}
                    className="flex-1 px-3 py-2.5 text-sm border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-ring bg-background text-foreground font-medium shadow-sm"
                  />
                  <label className="px-3 py-2.5 border border-input hover:border-ring rounded-lg cursor-pointer flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group bg-background shadow-sm">
                    <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                    <Download className="w-4 h-4 rotate-180 group-hover:-translate-y-0.5 transition-transform" />
                    <span className="text-xs font-black uppercase tracking-wider">CSV</span>
                  </label>
                </div>

                {csvRecipients.length > 0 && (
                  <div className="bg-background rounded-lg border border-border overflow-hidden shadow-sm">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/50">
                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                        {csvRecipients.filter(r => r.isActive !== false).length} / {csvRecipients.length} selected
                      </span>
                      <button onClick={() => setCsvRecipients([])} className="text-[10px] font-black text-destructive hover:text-destructive/80 uppercase tracking-widest">Clear</button>
                    </div>
                    
                    {csvRecipients.length > 5 && (
                      <div className="border-b border-border bg-background">
                        <input
                          type="text"
                          placeholder="Search..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full px-4 py-2.5 text-sm border-none focus:outline-none focus:ring-0 bg-transparent text-foreground placeholder:text-muted-foreground"
                        />
                      </div>
                    )}
                    
                    <div className="max-h-48 overflow-y-auto">
                      {filteredRecipients.map((r) => (
                        <label key={r.originalIndex} className="flex items-center gap-3 px-4 py-2 hover:bg-muted/50 group transition-colors border-b border-border last:border-0 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={r.isActive !== false}
                            onChange={(e) => {
                              const newRecs = [...csvRecipients];
                              newRecs[r.originalIndex] = { ...newRecs[r.originalIndex], isActive: e.target.checked };
                              setCsvRecipients(newRecs);
                            }}
                            className="w-4 h-4 rounded border-input text-primary focus:ring-primary accent-primary cursor-pointer shrink-0"
                          />
                          <span className="text-xs font-medium text-foreground truncate flex-1">
                            <span className="text-muted-foreground mr-1.5">{r.originalIndex + 1}.</span>
                            {r.name ? `${r.name} — ` : ''}{r.email}
                          </span>
                        </label>
                      ))}
                      {filteredRecipients.length === 0 && (
                        <div className="px-4 py-4 text-center text-xs text-muted-foreground">
                          No recipients match "{searchQuery}"
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Schedule */}
              <div>
                <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3">Schedule</label>
                <div className="relative">
                  <select
                    value={schedule}
                    onChange={(e) => setSchedule(e.target.value)}
                    className="w-full bg-background border border-input text-foreground rounded-lg pl-4 pr-10 py-3 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-ring appearance-none shadow-sm"
                  >
                    <option value="immediate">Send now</option>
                    <option value="daily">Every day at 8:00 AM</option>
                    <option value="weekly">Every Monday at 9:00 AM</option>
                    <option value="custom">Custom schedule</option>
                  </select>
                  <ChevronDown className="absolute right-3.5 top-3.5 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
                {schedule === 'custom' && (
                  <input
                    type="text"
                    value={customCron}
                    onChange={(e) => setCustomCron(e.target.value)}
                    placeholder="Cron expression  e.g.  0 8 * * 1"
                    className="mt-2 w-full bg-background border border-input rounded-lg px-4 py-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring shadow-sm"
                  />
                )}
                {schedule === 'weekly' && (
                  <p className="mt-2 text-[11px] text-primary font-semibold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
                    Fresh data generated at send time each week.
                  </p>
                )}
                {schedule === 'daily' && (
                  <p className="mt-2 text-[11px] text-primary font-semibold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
                    Fresh data generated at send time each day.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Email Composer */}
          <div className="flex-1 bg-background flex flex-col relative overflow-hidden">
            <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0 z-10">
              <X className="w-5 h-5" />
            </button>
            
            {/* Composer Header */}
            <div className="px-8 py-5 border-b border-border flex items-center gap-4 shrink-0 pr-16">
              <span className="text-sm font-semibold text-muted-foreground w-16 shrink-0">To:</span>
              <div className="flex-1 flex flex-wrap gap-2 items-center">
                {csvRecipients.filter(r => r.isActive !== false).length > 0 ? (
                  <span className="px-3 py-1.5 bg-primary/10 text-primary rounded-full text-[11px] font-black uppercase tracking-wider border border-primary/20">
                    {csvRecipients.filter(r => r.isActive !== false).length} recipients selected
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground italic">No recipients yet</span>
                )}
              </div>
            </div>

            <div className="px-8 py-4 border-b border-border flex items-center gap-4 shrink-0 pr-16">
              <span className="text-sm font-semibold text-muted-foreground w-16 shrink-0">Subject:</span>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="flex-1 text-[15px] font-bold text-foreground focus:outline-none placeholder:font-normal placeholder:text-muted-foreground bg-transparent"
                placeholder="Enter subject line..."
              />
            </div>

            <div className="flex-1 p-8 overflow-y-auto bg-background">
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                className="w-full h-full min-h-[300px] resize-none text-[15px] text-foreground leading-relaxed focus:outline-none bg-transparent"
                placeholder="Write your message here..."
              />
            </div>

            {/* Attachments & Footer */}
            <div className="px-8 py-5 border-t border-border flex flex-col gap-5 bg-background shrink-0">
              {/* Attachment Pill */}
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/50 hover:bg-muted transition-colors cursor-default w-max pr-6">
                <div className="w-10 h-10 rounded-md bg-destructive/10 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Analytics_Report.pdf</p>
                  <p className="text-[11px] font-semibold text-muted-foreground mt-0.5">Attached • PDF Document</p>
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex items-center justify-between pt-2">
                <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors">
                  Discard
                </button>
                <button
                  onClick={handleDispatch}
                  disabled={isSending || csvRecipients.filter(r => r.isActive !== false).length === 0}
                  className="px-8 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm hover:shadow-md bg-primary hover:bg-primary/90"
                >
                  <Send className="w-4 h-4" />
                  {isSending ? 'Sending…' : 'Send message'}
                </button>
              </div>
            </div>

          </div>

        </aside>
      </div>
    </>
  );
}
