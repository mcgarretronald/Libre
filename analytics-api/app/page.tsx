'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, FileText, Search } from 'lucide-react';

import { Sidebar }        from './components/Sidebar';
import { PromptCard }     from './components/PromptCard';
import { ProgressCard }   from './components/ProgressCard';
import { ReportCard }     from './components/ReportCard';
import { CampaignModal }   from './components/CampaignModal';
import { CampaignList }   from './components/CampaignList';

type Stage = 'idle' | 'schema' | 'sql' | 'remote' | 'complete';

export default function Home() {
  const [activeView, setActiveView] = useState<'generator' | 'campaigner'>('generator');

  // Generation
  const [chatInput, setChatInput]                     = useState('');
  const [attachedImageBase64, setAttachedImageBase64] = useState<string | null>(null);
  const [attachedImageName, setAttachedImageName]     = useState<string | null>(null);
  const [generationStage, setGenerationStage]         = useState<Stage>('idle');
  const [generatedReports, setGeneratedReports]       = useState<any[]>([]);
  const [reportSearch, setReportSearch]               = useState('');

  // Campaigns
  const [activeCampaigns, setActiveCampaigns]             = useState<any[]>([]);
  const [selectedCampaignReport, setSelectedCampaignReport] = useState<any | null>(null);
  const [isCampaignDrawerOpen, setIsCampaignDrawerOpen]   = useState(false);
  const [csvRecipients, setCsvRecipients]                 = useState<{ email: string; name?: string }[]>([]);
  const [schedule, setSchedule]                           = useState('immediate');
  const [customCron, setCustomCron]                       = useState('');
  const [isSending, setIsSending]                         = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // ── API Base URL ───────────────────────────────────────────────────────────
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://libre-l4iz.onrender.com';

  // ── Fetch reports on mount ─────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/api/analytics/reports`)
      .then(r => r.json())
      .then(d => { if (d.success && d.data) setGeneratedReports(d.data); })
      .catch(console.error);
  }, []);

  // ── Fetch campaigns when campaigner view opens ─────────────────────────────
  useEffect(() => {
    if (activeView !== 'campaigner') return;
    fetch(`${API_BASE}/api/analytics/campaigns`)
      .then(r => r.json())
      .then(d => { if (d.success && d.data) setActiveCampaigns(d.data); })
      .catch(console.error);
  }, [activeView]);

  // ── Image attach ───────────────────────────────────────────────────────────
  const handleImageAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAttachedImageBase64(ev.target?.result as string);
      setAttachedImageName(file.name);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ── CSV parse ──────────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const lines = (reader.result as string).split(/\r?\n/);
      const seen  = new Set<string>();
      const parsed: { email: string; name?: string }[] = [];
      lines.forEach(line => {
        const match = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (match) {
          const email = match[0].toLowerCase();
          if (!seen.has(email)) {
            seen.add(email);
            const parts = line.split(',');
            parsed.push({ email, name: parts.length >= 2 && !parts[0].includes('@') ? parts[0].trim() : undefined });
          }
        }
      });
      if (parsed.length) { setCsvRecipients(parsed); showToast(`Loaded ${parsed.length} recipients.`, 'success'); }
      else showToast('No valid email addresses found.', 'error');
    };
    reader.readAsText(file);
  };

  // ── Generate report ────────────────────────────────────────────────────────
  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const query = chatInput;
    setChatInput('');
    setGenerationStage('schema');
    const t1 = setTimeout(() => setGenerationStage('sql'),    2500);
    const t2 = setTimeout(() => setGenerationStage('remote'), 5000);

    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 120_000);

    try {
      const res  = await fetch(`${API_BASE}/api/analytics/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, image: attachedImageBase64 }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      if (data.success) {
        setGeneratedReports(prev => [data.report, ...prev]);
        showToast('Report generated successfully.', 'success');
      } else {
        showToast(data.error || 'Generation failed.', 'error');
      }
    } catch (err: any) {
      clearTimeout(timeout);
      showToast(err.name === 'AbortError' ? 'Request timed out. Please try again.' : err.message || 'Network error.', 'error');
    } finally {
      clearTimeout(t1); clearTimeout(t2);
      setGenerationStage('complete');
      setTimeout(() => setGenerationStage('idle'), 2500);
      setAttachedImageBase64(null);
      setAttachedImageName(null);
    }
  };

  // ── Delete report ──────────────────────────────────────────────────────────
  const handleDeleteReport = async (id: string | number) => {
    try {
      const res  = await fetch(`${API_BASE}/api/analytics/reports/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setGeneratedReports(prev => prev.filter(r => r.id !== id));
        showToast('Report deleted.', 'success');
      } else {
        showToast(data.error || 'Failed to delete.', 'error');
      }
    } catch {
      showToast('Network error.', 'error');
    }
  };

  // ── Dispatch campaign ──────────────────────────────────────────────────────
  const handleDispatch = async () => {
    if (!selectedCampaignReport || csvRecipients.length === 0) return;
    setIsSending(true);
    try {
      const res  = await fetch(`${API_BASE}/api/analytics/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: selectedCampaignReport.id, recipients: csvRecipients, schedule, customCron }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
        setCsvRecipients([]);
        setIsCampaignDrawerOpen(false);
        setSelectedCampaignReport(null);
      } else {
        showToast(data.error || 'Failed to schedule campaign.', 'error');
      }
    } catch {
      showToast('Network error.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  // ── Delete campaign ────────────────────────────────────────────────────────
  const handleDeleteCampaign = async (campaignId: string) => {
    const res  = await fetch(`${API_BASE}/api/analytics/campaigns?id=${campaignId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      setActiveCampaigns(prev => prev.filter(c => c.campaignId !== campaignId));
      showToast('Campaign cancelled.', 'success');
    } else {
      showToast('Failed to delete campaign.', 'error');
    }
  };

  // ── Filtered reports ───────────────────────────────────────────────────────
  const filteredReports = generatedReports.filter(r =>
    r.query?.toLowerCase().includes(reportSearch.toLowerCase()) ||
    r.summary?.toLowerCase().includes(reportSearch.toLowerCase())
  );

  const isProcessing = generationStage !== 'idle' && generationStage !== 'complete';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen w-full font-sans text-slate-900 overflow-hidden" style={{ background: '#F0EDE9' }}>

      <Sidebar activeView={activeView} setActiveView={setActiveView} isProcessing={isProcessing} />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header className="h-14 flex items-center justify-between px-8 shrink-0 sticky top-0 z-10 border-b border-black/8 backdrop-blur-md" style={{ background: 'rgba(240, 237, 233, 0.92)' }}>
          <div className="flex items-center gap-3">
            <h1 className="text-[15px] font-black text-[#3B143C] tracking-tight">
              {activeView === 'generator' ? 'Analytics Portal' : 'Campaign Hub'}
            </h1>
            {isProcessing && (
              <span className="text-[9px] font-black uppercase tracking-[0.15em] text-[#E06A55] bg-[#E06A55]/10 px-2.5 py-1 rounded-full animate-pulse">
                Processing
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border" style={{ background: 'rgba(30,107,101,0.08)', borderColor: 'rgba(30,107,101,0.2)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#1E6B65] animate-pulse" />
            <span className="text-[10px] font-black text-[#1E6B65] tracking-wide">AI Connected</span>
          </div>
        </header>

        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border animate-in slide-in-from-right-4 duration-300 text-white ${toast.type === 'success' ? 'bg-[#1E6B65] border-[#1E6B65]' : 'bg-red-600 border-red-700'}`}>
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span className="text-sm font-semibold">{toast.message}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto w-full px-8 pt-6 pb-4">

            {/* ── GENERATOR VIEW ─────────────────────────────────────── */}
            {activeView === 'generator' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-400">

                <ProgressCard generationStage={generationStage} />

                {/* Reports list — shown first */}
                {generatedReports.length > 0 ? (
                  <div className="space-y-2">
                    {/* Section header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <h2 className="text-[13px] font-black text-slate-700 tracking-tight">Reports</h2>
                        <span className="text-[10px] font-black text-white bg-[#3B143C] px-2 py-0.5 rounded-full">{generatedReports.length}</span>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search..."
                          value={reportSearch}
                          onChange={e => setReportSearch(e.target.value)}
                          className="pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#3B143C] bg-white font-medium w-44 transition-all focus:w-56"
                        />
                      </div>
                    </div>

                    {filteredReports.map(report => (
                      <ReportCard
                        key={report.id}
                        report={report}
                        onDelete={handleDeleteReport}
                        onDispatch={(r) => { setSelectedCampaignReport(r); setIsCampaignDrawerOpen(true); }}
                      />
                    ))}
                  </div>
                ) : (
                  !isProcessing && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mb-4 shadow-sm">
                        <FileText className="w-6 h-6 text-slate-300" />
                      </div>
                      <p className="text-sm font-bold text-slate-400">No reports yet</p>
                      <p className="text-xs text-slate-300 font-medium mt-1">Type a question below to generate your first report</p>
                    </div>
                  )
                )}
              </div>
            )}

            {/* ── CAMPAIGNER VIEW ────────────────────────────────────── */}
            {activeView === 'campaigner' && (
              <div className="animate-in fade-in slide-in-from-bottom-3 duration-400">
                <div className="flex items-center gap-2.5 mb-5">
                  <h2 className="text-[13px] font-black text-slate-700 tracking-tight">Active Campaigns</h2>
                  {activeCampaigns.length > 0 && (
                    <span className="text-[10px] font-black text-white bg-[#1E6B65] px-2 py-0.5 rounded-full">{activeCampaigns.length}</span>
                  )}
                </div>
                <CampaignList campaigns={activeCampaigns} onDelete={handleDeleteCampaign} />
              </div>
            )}

          </div>
        </div>

        {/* ── STICKY BOTTOM PROMPT BAR (generator only) ─────────────── */}
        {activeView === 'generator' && (
          <div className="shrink-0 border-t border-black/6 px-8 py-4" style={{ background: 'rgba(240,237,233,0.97)', backdropFilter: 'blur(12px)' }}>
            <div className="max-w-4xl mx-auto">
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
        )}

      </main>

      {/* Campaign Modal */}
      {isCampaignDrawerOpen && selectedCampaignReport && (
        <CampaignModal
          report={selectedCampaignReport}
          csvRecipients={csvRecipients}
          setCsvRecipients={setCsvRecipients}
          schedule={schedule}
          setSchedule={setSchedule}
          customCron={customCron}
          setCustomCron={setCustomCron}
          isSending={isSending}
          handleDispatch={handleDispatch}
          handleFileChange={handleFileChange}
          onClose={() => { setIsCampaignDrawerOpen(false); setSelectedCampaignReport(null); }}
        />
      )}
    </div>
  );
}
