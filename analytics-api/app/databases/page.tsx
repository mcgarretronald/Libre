'use client';

import React, { useState, useEffect } from 'react';
import {
  Database, Plus, Trash2, CheckCircle, AlertCircle,
  RefreshCw, Activity, Server, ChevronRight, Shield,
  ArrowLeft, Zap, Lock, Globe, Eye, EyeOff, Menu,
} from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { Badge } from '../components/ui/badge';

export default function DatabasesPortal() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [connections, setConnections] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('8443');
  const [username, setUsername] = useState('default');
  const [password, setPassword] = useState('');
  const [databaseName, setDatabaseName] = useState('default');
  const [showPassword, setShowPassword] = useState(false);

  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latency?: number;
    version?: string;
    debugCommand?: string;
  } | null>(null);

  useEffect(() => { fetchConnections(); }, []);

  const fetchConnections = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/analytics/connections');
      const data = await res.json();
      if (data.success) setConnections(data.data);
    } catch (err) { console.error(err); }
    finally { setIsLoading(false); }
  };

  const handleTestConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTesting(true);
    setTestResult(null);
    setSaveError('');
    try {
      const res = await fetch('/api/analytics/connections/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host, port, username, password, databaseName }),
      });
      const data = await res.json();
      setTestResult(data.success
        ? { success: true, message: 'Connection established successfully.', latency: data.latencyMs, version: data.version, debugCommand: data.debugCommand }
        : { success: false, message: data.error || 'Failed to connect.', debugCommand: data.debugCommand }
      );
    } catch {
      setTestResult({ success: false, message: 'Network error during test. Please try again.' });
    } finally { setIsTesting(false); }
  };

  const handleSaveConnection = async () => {
    setIsSaving(true);
    setSaveError('');
    try {
      const res = await fetch('/api/analytics/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, host, port, username, password, databaseName }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchConnections();
        setName(''); setHost(''); setPassword(''); setTestResult(null); setPort('8443');
        setUsername('default'); setDatabaseName('default');
      } else {
        setSaveError(data.error || 'Failed to save connection.');
      }
    } catch { setSaveError('Network error. Please try again.'); }
    finally { setIsSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/analytics/connections?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) setConnections(prev => prev.filter(c => c.id !== id));
    } catch (err) { console.error(err); }
  };

  const formReady = name && host && password;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar with mobile responsiveness */}
      <div className={`
        fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0
      `}>
        <Sidebar
          activeView="databases"
          setActiveView={() => { window.location.href = '/'; }}
          isProcessing={false}
        />
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header className="h-14 flex items-center gap-3 px-4 md:px-6 shrink-0 border-b border-border bg-card">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden md:flex items-center gap-1.5">
            <a href="/" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-[12px] font-semibold">
              <ArrowLeft className="w-3.5 h-3.5" /> Portal
            </a>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
          </div>
          <div className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[12px] font-bold tracking-widest uppercase text-muted-foreground">Data Sources</span>
          </div>
          <div className="ml-auto">
            <Badge variant="outline" className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30">
              <Shield className="w-3 h-3" /> Encrypted at rest · AES-256
            </Badge>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-8">
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* Left — connected list */}
            <div className="lg:col-span-7 space-y-4">
              <h2 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 mb-4">
                <Database className="h-3.5 w-3.5" /> Connected Warehouses
              </h2>

              {isLoading ? (
                <div className="bg-card border border-border rounded-2xl p-12 text-center">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Loading connections...</p>
                </div>
              ) : connections.length === 0 ? (
                <div className="border-2 border-dashed border-border rounded-2xl p-14 text-center bg-muted/10">
                  <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                    <Server className="h-6 w-6 text-muted-foreground/30" />
                  </div>
                  <p className="text-sm font-semibold text-muted-foreground">No databases connected yet</p>
                  <p className="text-xs text-muted-foreground/50 mt-1">Use the form to register your first ClickHouse source</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {connections.map(conn => (
                    <div key={conn.id} className="bg-card border border-border rounded-xl p-5 flex items-center justify-between group hover:border-border/60 hover:shadow-md transition-all">
                      <div className="flex items-start gap-4">
                        <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/40 flex items-center justify-center shrink-0">
                          <Database className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-foreground">{conn.name}</h3>
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border truncate max-w-60">
                              {conn.host}:{conn.port}
                            </span>
                            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                              {conn.databaseName}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(conn.id)}
                        className="text-muted-foreground/30 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-destructive/10"
                        title="Remove connection"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right — add connection form */}
            <div className="lg:col-span-5">
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm sticky top-6">

                {/* Form header */}
                <div className="px-6 py-5 border-b border-border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #3B143C, #5a2060)' }}>
                      <Plus className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-foreground">New ClickHouse Source</h2>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Credentials are encrypted before storage</p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleTestConnection} className="p-6 space-y-5">

                  {/* Connection name */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                      Connection Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. Production Metrics"
                      className="w-full text-sm px-3.5 py-3 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring transition"
                      required
                    />
                  </div>

                  {/* Host + Port */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Globe className="h-3 w-3" /> Endpoint
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={host}
                        onChange={e => setHost(e.target.value)}
                        placeholder="https://your-instance.clickhouse.cloud"
                        className="flex-1 text-sm px-3.5 py-3 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring transition min-w-0"
                        required
                      />
                      <input
                        type="text"
                        value={port}
                        onChange={e => setPort(e.target.value)}
                        placeholder="8443"
                        className="w-20 text-sm px-3 py-3 rounded-xl border border-input bg-background text-foreground text-center focus:outline-none focus:ring-2 focus:ring-ring transition"
                      />
                    </div>
                  </div>

                  {/* Database + Username */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                        Database
                      </label>
                      <input
                        type="text"
                        value={databaseName}
                        onChange={e => setDatabaseName(e.target.value)}
                        className="w-full text-sm px-3.5 py-3 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                        Username
                      </label>
                      <input
                        type="text"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        className="w-full text-sm px-3.5 py-3 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                        required
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Lock className="h-3 w-3" /> Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full text-sm px-3.5 py-3 pr-11 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-ring transition"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground/50 mt-1.5 flex items-center gap-1">
                      <Shield className="h-3 w-3" /> AES-256 encrypted before storage
                    </p>
                  </div>

                  {/* Test result */}
                  {testResult && (
                    <div className={`p-4 rounded-xl border text-sm ${testResult.success
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/40'
                      : 'bg-destructive/5 border-destructive/20'
                      }`}>
                      <div className="flex items-start gap-2.5">
                        {testResult.success
                          ? <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          : <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        }
                        <div>
                          <p className={`font-semibold text-[13px] ${testResult.success ? 'text-emerald-800 dark:text-emerald-300' : 'text-destructive'}`}>
                            {testResult.message}
                          </p>
                          {testResult.success && (
                            <div className="flex items-center gap-4 mt-1.5 text-xs font-mono text-emerald-600 dark:text-emerald-400">
                              <span className="flex items-center gap-1"><Activity className="h-3 w-3" />{testResult.latency}ms</span>
                              <span className="truncate max-w-40">v{testResult.version}</span>
                            </div>
                          )}
                          {!testResult.success && testResult.debugCommand && (
                            <pre className="mt-3 rounded-xl bg-slate-950/10 px-3 py-2 text-[12px] text-slate-900 dark:bg-slate-950/20 dark:text-slate-100 overflow-x-auto">
                              <span className="font-semibold">Debug curl:</span>
                              <div className="mt-1 text-xs font-mono text-slate-700 dark:text-slate-300">{testResult.debugCommand}</div>
                            </pre>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Save error */}
                  {saveError && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/5 border border-destructive/20 text-destructive text-sm">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{saveError}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2.5 pt-1">
                    <button
                      type="submit"
                      disabled={isTesting || !formReady}
                      className="flex-1 flex items-center justify-center gap-2 bg-muted text-muted-foreground font-bold text-xs uppercase tracking-wider px-4 py-3 rounded-xl hover:bg-accent hover:text-foreground transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isTesting
                        ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Testing...</>
                        : <><Zap className="h-3.5 w-3.5" /> Test</>
                      }
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveConnection}
                      disabled={!testResult?.success || isSaving}
                      className="flex-1 flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-wider px-4 py-3 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed text-white"
                      style={{ background: testResult?.success ? 'linear-gradient(135deg, #3B143C, #5a2060)' : undefined }}
                    >
                      {isSaving
                        ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Saving...</>
                        : <><Database className="h-3.5 w-3.5" /> Save</>
                      }
                    </button>
                  </div>
                </form>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
