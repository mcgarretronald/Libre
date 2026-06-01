'use client';

import { Sparkles, Send } from 'lucide-react';

interface SidebarProps {
  activeView: string;
  setActiveView: (view: 'generator' | 'campaigner') => void;
  isProcessing: boolean;
}

export function Sidebar({ activeView, setActiveView, isProcessing }: SidebarProps) {
  return (
    <aside className="w-[220px] flex flex-col flex-shrink-0 z-20 relative" style={{ background: 'linear-gradient(170deg, #3B143C 0%, #2a0e2e 100%)' }}>
      
      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b border-white/10">
        <img
          src="https://jacarandahealth.org/ypoagriw/2023/09/JH-LOGO-WHITE-1.svg"
          alt="Jacaranda Health"
          className="h-6 w-auto"
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 pt-4">
        <p className="px-2 pb-2 text-[9px] font-black text-white/25 uppercase tracking-[0.18em]">Portal</p>

        <NavButton
          icon={<Sparkles className="w-3.5 h-3.5" />}
          label="Generate Report"
          active={activeView === 'generator'}
          activeColor="bg-[#E06A55]"
          onClick={() => setActiveView('generator')}
          badge={isProcessing}
        />

        <NavButton
          icon={<Send className="w-3.5 h-3.5" />}
          label="Campaigns"
          active={activeView === 'campaigner'}
          activeColor="bg-[#1E6B65]"
          onClick={() => setActiveView('campaigner')}
        />
      </nav>

      {/* User block */}
      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0"
            style={{ background: 'linear-gradient(135deg, #1E6B65, #145a54)' }}>
            AD
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-white leading-none truncate">System Admin</p>
            <p className="text-[10px] text-emerald-400 font-semibold mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
              Online
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function NavButton({
  icon, label, active, activeColor, onClick, badge,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  activeColor: string;
  onClick: () => void;
  badge?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2.5 text-[13px] font-semibold rounded-xl transition-all duration-200 ${
        active ? 'bg-white/10 text-white' : 'text-white/45 hover:bg-white/5 hover:text-white/75'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${active ? activeColor : 'bg-white/8'}`}>
          {icon}
        </div>
        {label}
      </div>
      {badge && <span className="w-1.5 h-1.5 rounded-full bg-[#E06A55] animate-pulse" />}
    </button>
  );
}
