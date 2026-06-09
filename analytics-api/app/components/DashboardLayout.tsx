'use client';

import React, { useState } from 'react';
import { Shield, Database, Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Badge } from './ui/badge';

interface DashboardLayoutProps {
  children: React.ReactNode;
  isProcessing?: boolean;
  title: string;
}

export function DashboardLayout({ children, isProcessing = false, title }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar with mobile responsiveness */}
      <div className={`
        fixed inset-y-0 left-0 z-40 w-[220px] shrink-0 transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0
      `}>
        <Sidebar isProcessing={isProcessing} />
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* ── Header ── */}
        <header className="h-14 flex items-center px-4 md:px-6 shrink-0 border-b border-border bg-card transition-colors duration-300">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 -ml-2 mr-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <h1 className="text-[13px] font-bold tracking-wide text-muted-foreground flex-1 truncate pr-2">
            {title}
          </h1>
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <a
              href="/databases"
              className="flex items-center gap-1.5 text-[11px] font-semibold px-2 md:px-3 py-1.5 rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-accent border border-border shrink-0"
            >
              <Database className="w-4 h-4 md:w-3 md:h-3 shrink-0" />
              <span className="hidden sm:inline">Manage Data Sources</span>
            </a>
            <Badge
              variant="outline"
              className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 text-[11px] font-semibold border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 shrink-0"
            >
              <Shield className="w-4 h-4 md:w-3 md:h-3 shrink-0" />
              <span className="hidden sm:inline">AI Connected</span>
            </Badge>
          </div>
        </header>

        {/* ── Main Content Area ── */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {children}
        </div>
      </main>
    </div>
  );
}
