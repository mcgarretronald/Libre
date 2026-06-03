'use client';

import { Sparkles, Send, Database, Sun, Moon, LogOut, Settings, User, ExternalLink } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Separator } from './ui/separator';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface SidebarProps {
  activeView: string;
  setActiveView: (view: 'generator' | 'campaigner') => void;
  isProcessing: boolean;
}

export function Sidebar({ activeView, setActiveView, isProcessing }: SidebarProps) {
  const { theme, toggle } = useTheme();

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (_) {}
    // Clear any client-accessible cookie too
    document.cookie = 'access_token=; Max-Age=0; path=/';
    // Redirect to LibreChat login (or portal root which will bounce to login)
    window.location.href = process.env.NEXT_PUBLIC_LIBRECHAT_URL || '/';
  }

  return (
    <aside
      className="w-[220px] flex flex-col flex-shrink-0 z-20 relative border-r transition-colors duration-300"
      style={{
        background: theme === 'dark'
          ? 'linear-gradient(170deg, #3B143C 0%, #2a0e2e 100%)'
          : 'linear-gradient(170deg, #3B143C 0%, #4a1a50 100%)',
        borderColor: 'rgba(255,255,255,0.08)',
      }}
    >
      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b border-white/10">
        <img
          src="https://jacarandahealth.org/ypoagriw/2023/09/JH-LOGO-WHITE-1.svg"
          alt="Jacaranda Health"
          className="h-6 w-auto"
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 pt-4 overflow-y-auto">
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

        <Separator className="my-2 bg-white/8" />

        <a
          href="/databases"
          className={`w-full flex items-center gap-3 px-3 py-2.5 text-[13px] font-semibold rounded-xl transition-all duration-200 ${
            activeView === 'databases' ? 'bg-white/10 text-white' : 'text-white/45 hover:bg-white/5 hover:text-white/75'
          }`}
        >
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
            activeView === 'databases' ? 'bg-indigo-500' : 'bg-white/8'
          }`}>
            <Database className="w-3.5 h-3.5" />
          </div>
          Data Sources
        </a>
      </nav>

      {/* Bottom zone: theme toggle + user avatar */}
      <div className="p-3 space-y-2 border-t border-white/10">
        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[12px] font-semibold text-white/40 hover:bg-white/5 hover:text-white/70 transition-colors"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark'
            ? <Sun className="w-3.5 h-3.5 text-amber-300" />
            : <Moon className="w-3.5 h-3.5 text-indigo-300" />
          }
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>

        {/* User avatar dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/8 transition-colors cursor-pointer text-left">
              <Avatar className="w-8 h-8 shrink-0">
                <AvatarFallback
                  className="text-white text-xs font-black"
                  style={{ background: 'linear-gradient(135deg, #1E6B65, #145a54)' }}
                >
                  AD
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white leading-none truncate">System Admin</p>
                <p className="text-[10px] text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                  Online
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            side="top"
            align="start"
            sideOffset={6}
            className="w-52"
          >
            <DropdownMenuLabel className="text-xs">My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem asChild className="gap-2.5">
              <a href="/databases">
                <Database className="w-4 h-4 text-muted-foreground" />
                Manage Data Sources
                <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground" />
              </a>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="gap-2.5 text-destructive focus:text-destructive focus:bg-destructive/10"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" />
              Log Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
