'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Shield, Database, Settings2, ChevronDown, X, Menu, BarChart2, RefreshCw } from 'lucide-react';
import { DashboardLayout } from './components/DashboardLayout';
import { PromptCard } from './components/PromptCard';
import { ProgressCard } from './components/ProgressCard';
import { ReportCard } from './components/ReportCard';
import { CampaignDrawer } from './components/CampaignDrawer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Badge } from './components/ui/badge';
import { useTheme } from './components/ThemeProvider';

type Stage = 'idle' | 'schema' | 'sql' | 'remote' | 'complete';

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

interface Recipient { email: string; name?: string; isActive?: boolean; }

export default function CorporatePortal() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Chat and Generation State
  const [chatInput, setChatInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [generationStage, setGenerationStage] = useState<Stage>('idle');
  const [reports, setReports] = useState<Report[]>([]);
  const [activeReport, setActiveReport] = useState<Report | null>(null);
  const reportListRef = useRef<HTMLDivElement>(null);
  const [attachedImageBase64, setAttachedImageBase64] = useState<string | null>(null);
  const [attachedImageName, setAttachedImageName] = useState<string | null>(null);

  // Settings and Connections State
  const [showSettings, setShowSettings] = useState(false);
  const [connections, setConnections] = useState<any[]>([]);
  const [databaseId, setDatabaseId] = useState('');
  const [brandColors, setBrandColors] = useState({
    primary: '#4A154B',
    secondary: '#E06A55',
    accent: '#1E6B65',
  });

  // Campaign Drawer State
  const [drawerReport, setDrawerReport] = useState<Report | null>(null);
  const [csvRecipients, setCsvRecipients] = useState<Recipient[]>([]);
  const [schedule, setSchedule] = useState('immediate');
  const [customCron, setCustomCron] = useState('');
  const [isSending, setIsSending] = useState(false);

  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/analytics/connections').then(r => r.json()).then(d => {
        if (d.success) {
          setConnections(d.data);
          if (d.data.length > 0) setDatabaseId(d.data[0].id);
        }
      }).catch(console.error),
      fetch('/api/analytics/reports').then(r => r.json()).then(d => {
        if (d.success && Array.isArray(d.data)) setReports(d.data);
      }).catch(console.error)
    ]).finally(() => setIsLoadingData(false));
  }, []);

  const handleImageAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachedImageName(file.name);
    const reader = new FileReader();
    reader.onload = ev => setAttachedImageBase64(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isProcessing) return;
    setIsProcessing(true);
    setGenerationStage('schema');
    const t1 = setTimeout(() => setGenerationStage('sql'), 3500);
    const t2 = setTimeout(() => setGenerationStage('remote'), 7000);
    try {
      const res = await fetch('/api/analytics/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: chatInput,
          databaseId,
          brandColors,
          ...(attachedImageBase64 ? { imageBase64: attachedImageBase64 } : {}),
        }),
      });
      const data = await res.json();
      clearTimeout(t1); clearTimeout(t2);
      if (data.success) {
        setGenerationStage('complete');
        const newReport = {
          id: data.id, query: chatInput, summary: data.summary,
          timestamp: new Date().toISOString(),
          htmlUrl: data.htmlUrl ?? `/api/analytics/html/${data.id}`,
          sql: data.sql, details: data.details, rowCount: data.rowCount,
          fallbackSimulated: data.fallbackSimulated,
        };
        setReports(prev => [newReport, ...prev]);
        setActiveReport(newReport);
        setChatInput('');
        setAttachedImageBase64(null); setAttachedImageName(null);
        setTimeout(() => setGenerationStage('idle'), 600);
        setTimeout(() => reportListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 700);
      } else {
        alert(`Generation failed: ${data.error || 'Unknown error'}`);
        setGenerationStage('idle');
      }
    } catch (err: any) {
      clearTimeout(t1); clearTimeout(t2);
      setGenerationStage('idle');
      alert(`Network or timeout error: ${err.message}`);
    } finally { setIsProcessing(false); }
  };

  const handleFollowUpReport = async (reportId: string | number, query: string) => {
    if (!query.trim() || isProcessing) return;
    setIsProcessing(true);
    setGenerationStage('schema');
    const t1 = setTimeout(() => setGenerationStage('sql'), 3500);
    const t2 = setTimeout(() => setGenerationStage('remote'), 7000);
    try {
      const res = await fetch('/api/analytics/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          databaseId,
          brandColors,
          parentReportId: reportId
        }),
      });
      const data = await res.json();
      clearTimeout(t1); clearTimeout(t2);
      if (data.success) {
        setGenerationStage('complete');
        const newReport = {
          id: data.id, query, summary: data.summary,
          timestamp: new Date().toISOString(),
          htmlUrl: data.htmlUrl ?? `/api/analytics/html/${data.id}`,
          sql: data.sql, details: data.details, rowCount: data.rowCount,
          fallbackSimulated: data.fallbackSimulated,
        };
        setReports(prev => [newReport, ...prev]);
        setActiveReport(newReport);
        setTimeout(() => setGenerationStage('idle'), 600);
        setTimeout(() => reportListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 700);
      } else {
        alert(`Follow-up failed: ${data.error || 'Unknown error'}`);
        setGenerationStage('idle');
      }
    } catch (err: any) {
      clearTimeout(t1); clearTimeout(t2);
      setGenerationStage('idle');
      alert(`Network or timeout error: ${err.message}`);
    } finally { setIsProcessing(false); }
  };

  const handleDelete = async (id: string | number) => {
    setReports(p => p.filter(r => r.id !== id));
    try { await fetch(`/api/analytics/reports/${id}`, { method: 'DELETE' }); } catch (_) {}
  };

  const handleDispatch = async (subject: string, body: string): Promise<boolean> => {
    const activeRecipients = csvRecipients.filter(r => r.isActive !== false);
    if (!drawerReport || activeRecipients.length === 0) return false;
    setIsSending(true);
    try {
      const res = await fetch('/api/analytics/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: drawerReport.id, recipients: activeRecipients, schedule, customCron, subject, body }),
      });
      if (!res.ok) return false;
      return true;
    } catch (e) { 
      console.error(e); 
      return false;
    } finally { 
      setIsSending(false); 
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = (ev.target?.result as string) || '';
      const emails = text.match(/[\w.-]+@[\w.-]+\.\w+/g) || [];
      const newRecipients = emails.map(email => ({ email: email.toLowerCase() }));
      
      setCsvRecipients(prev => {
        const map = new Map(prev.map(p => [p.email, p]));
        newRecipients.forEach(r => { if (!map.has(r.email)) map.set(r.email, r); });
        return Array.from(map.values());
      });
      e.target.value = ''; // Allow re-uploading the same file
    };
    reader.readAsText(file);
  };



  const activeConnection = connections.find(c => c.id === databaseId);

  return (
    <DashboardLayout title="Analytics Portal" isProcessing={isProcessing}>
          <div className="flex-1 flex min-h-0 relative bg-background">
            
            {/* Left side: Chat and Report List */}
            <div className={`flex flex-col min-h-0 transition-all duration-300 ease-in-out z-0 ${activeReport ? 'w-full lg:w-[45%]' : 'w-full'}`}>

            {/* Report list */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {isLoadingData ? (
                <div className="flex flex-col items-center justify-center h-full text-center select-none" style={{ minHeight: '220px' }}>
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground/40 mb-4" />
                  <p className="text-[13px] font-semibold text-muted-foreground">Loading...</p>
                </div>
              ) : reports.length === 0 && generationStage === 'idle' ? (
                <div className="flex flex-col items-center justify-center h-full text-center select-none" style={{ minHeight: '220px' }}>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-muted border border-border">
                    <svg className="w-6 h-6 text-muted-foreground/40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                    </svg>
                  </div>
                  <p className="text-[13px] font-semibold text-muted-foreground">No reports yet</p>
                  <p className="text-[12px] mt-1 text-muted-foreground/60">Type a question below to generate your first report</p>
                </div>
              ) : (
                <div ref={reportListRef} className="max-w-3xl mx-auto">
                  {(() => {
                    const groups: Record<string, typeof reports> = {};
                    reports.forEach(report => {
                      const date = new Date(report.timestamp);
                      const today = new Date();
                      const yesterday = new Date(today);
                      yesterday.setDate(yesterday.getDate() - 1);

                      const isSameDay = (d1: Date, d2: Date) => 
                        d1.getDate() === d2.getDate() &&
                        d1.getMonth() === d2.getMonth() &&
                        d1.getFullYear() === d2.getFullYear();

                      let groupName = '';
                      if (isSameDay(date, today)) groupName = 'Today';
                      else if (isSameDay(date, yesterday)) groupName = 'Yesterday';
                      else {
                        groupName = date.toLocaleDateString('en-GB', { 
                          weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' 
                        }).replace(',', '');
                      }
                      
                      if (!groups[groupName]) groups[groupName] = [];
                      groups[groupName].push(report);
                    });

                    return Object.entries(groups).map(([group, groupReports]) => (
                      <div key={group} className="mb-6 last:mb-0">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-muted-foreground mb-3 ml-2">
                          {group}
                        </h3>
                        <div className="space-y-3">
                          {groupReports.map(report => (
                            <ReportCard
                              key={report.id}
                              report={report}
                              onDelete={handleDelete}
                              onDispatch={r => { setDrawerReport(r); setCsvRecipients([]); setSchedule('immediate'); }}
                              onSelectReport={setActiveReport}
                              onFollowUp={handleFollowUpReport}
                              isSelected={activeReport?.id === report.id}
                            />
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>

            {/* ── Bottom input zone ── */}
            <div className="shrink-0 px-6 pb-5 pt-3 border-t border-border bg-background/80 backdrop-blur-sm transition-colors duration-300">
              <div className="max-w-3xl mx-auto space-y-2">

                {/* Collapsible settings tray */}
                {showSettings && (
                  <div className="rounded-2xl px-4 py-3 space-y-3 border border-border bg-card transition-all duration-200">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        Report Settings
                      </span>
                      <button
                        onClick={() => setShowSettings(false)}
                        className="w-5 h-5 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                      {/* ClickHouse DB selector — uses shadcn Select */}
                      <div>
                        <label className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest mb-1.5 text-muted-foreground">
                          <Database className="w-2.5 h-2.5" />
                          ClickHouse Data Warehouse
                        </label>
                        {connections.length > 0 ? (
                          <Select value={databaseId} onValueChange={setDatabaseId}>
                            <SelectTrigger className="w-full text-[12px] h-9">
                              <SelectValue placeholder="Select a database…" />
                            </SelectTrigger>
                            <SelectContent>
                              {connections.map(conn => (
                                <SelectItem key={conn.id} value={conn.id}>
                                  {conn.name} — {conn.host}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="text-[11px] font-semibold px-3 py-2 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive">
                            No connections.{' '}
                            <a href="/databases" className="underline font-bold hover:opacity-80">
                              Add ClickHouse →
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Theme color swatches */}
                      <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest mb-1.5 text-muted-foreground">
                          Report Colors
                        </label>
                        <div className="flex items-center gap-3 h-9 px-3 rounded-lg border border-border bg-background">
                          <span className="text-[10px] font-medium text-muted-foreground mr-auto">Override:</span>
                          {Object.entries(brandColors).map(([key, value]) => (
                            <div key={key} className="relative group cursor-pointer">
                              <input
                                type="color"
                                value={value}
                                onChange={e => setBrandColors({ ...brandColors, [key]: e.target.value })}
                                className="absolute inset-0 w-6 h-6 opacity-0 cursor-pointer z-10"
                              />
                              <div
                                className="w-6 h-6 rounded-full border-2 border-border group-hover:scale-110 transition-transform shadow-sm"
                                style={{ backgroundColor: value }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Settings toggle row */}
                <div className="flex items-center justify-between px-1">
                  <button
                    type="button"
                    onClick={() => setShowSettings(p => !p)}
                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest py-0.5 transition-colors"
                    style={{ color: showSettings ? '#E06A55' : undefined }}
                    data-active={showSettings}
                  >
                    <Settings2 className="w-3 h-3" />
                    <span className={showSettings ? 'text-[#E06A55]' : 'text-muted-foreground'}>Settings</span>
                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 text-muted-foreground ${showSettings ? 'rotate-180' : ''}`} />
                  </button>
                  {activeConnection && (
                    <span className="text-[10px] font-semibold flex items-center gap-1 text-[#1E6B65]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1E6B65] inline-block" />
                      {activeConnection.name}
                    </span>
                  )}
                </div>

                {generationStage !== 'idle' && generationStage !== 'complete' && (
                  <ProgressCard generationStage={generationStage} />
                )}

                <PromptCard
                  chatInput={chatInput}
                  setChatInput={setChatInput}
                  attachedImageBase64={attachedImageBase64}
                  setAttachedImageBase64={setAttachedImageBase64}
                  setAttachedImageName={setAttachedImageName}
                  handleImageAttach={handleImageAttach}
                  handleGenerateReport={handleGenerateReport}
                  isProcessing={isProcessing}
                />
              </div>
            </div>
          </div>

          {/* Right side: Artifact side panel */}
          {activeReport && (
            <div className="hidden lg:flex w-[55%] border-l border-border bg-card/50 flex-col absolute top-0 bottom-0 right-0 shadow-2xl z-10 animate-in slide-in-from-right-10 duration-300">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card shrink-0">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-[#E06A55]" />
                  Interactive Dashboard
                </h3>
                <button
                  onClick={() => setActiveReport(null)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden relative bg-white m-4 rounded-xl border border-slate-200 shadow-inner">
                {activeReport.htmlUrl ? (
                  <iframe
                    src={activeReport.htmlUrl}
                    className="absolute inset-0 w-full h-full border-none"
                    title={`Dashboard ${activeReport.id}`}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground font-semibold">Preview unavailable</div>
                )}
              </div>
            </div>
          )}
        </div>
      {drawerReport && (
        <CampaignDrawer
          report={drawerReport}
          csvRecipients={csvRecipients}
          setCsvRecipients={setCsvRecipients}
          schedule={schedule}
          setSchedule={setSchedule}
          customCron={customCron}
          setCustomCron={setCustomCron}
          isSending={isSending}
          handleDispatch={handleDispatch}
          handleFileChange={handleFileChange}
          onClose={() => setDrawerReport(null)}
        />
      )}
    </DashboardLayout>
  );
}
