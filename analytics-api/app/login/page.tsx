'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, LogIn, AlertCircle, Loader2, BarChart3 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login failed. Please check your credentials.'); return; }
      router.replace('/');
    } catch {
      setError('Could not connect to the server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">

      {/* Left panel — branding */}
      <div
        className="hidden lg:flex flex-col justify-between w-[45%] p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #1a0520 0%, #3B143C 50%, #5a1a5e 100%)' }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #e06a55, transparent)' }} />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #7c3aed, transparent)' }} />

        {/* Logo */}
        <div>
          <img
            src="https://jacarandahealth.org/ypoagriw/2023/09/JH-LOGO-WHITE-1.svg"
            alt="Jacaranda Health"
            className="h-9 w-auto"
          />
        </div>

        {/* Middle copy */}
        <div className="space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-white/10">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <span className="text-white/60 text-sm font-medium tracking-wide uppercase">Analytics Portal</span>
          </div>
          <h2 className="text-4xl font-black text-white leading-tight">
            Data-driven<br />decisions, faster.
          </h2>
          <p className="text-white/50 text-sm leading-relaxed max-w-xs">
            Query your ClickHouse data warehouses, generate AI-powered reports, and dispatch insights directly to your team.
          </p>
        </div>

        {/* Bottom tagline */}
        <p className="text-white/25 text-xs">
          Jacaranda Health · Secure Operations Platform
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <img
              src="https://jacarandahealth.org/ypoagriw/2023/09/JH-LOGO-WHITE-1.svg"
              alt="Jacaranda Health"
              className="h-9 w-auto mb-3 dark:invert-0 invert"
            />
            <p className="text-xs text-muted-foreground">Analytics Portal</p>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-black text-foreground">Welcome back</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to your portal account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {error && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@jacarandahealth.org"
                required
                autoComplete="email"
                className="w-full text-sm px-4 py-3 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring transition"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full text-sm px-4 py-3 pr-11 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition z-10"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full flex items-center justify-center gap-2 font-bold text-sm px-4 py-3.5 rounded-xl text-white transition-all duration-200 hover:opacity-90 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #d94fdc)' }}
            >
              {isLoading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in...</>
                : <><LogIn className="h-4 w-4" /> Sign In</>
              }
            </button>

            <p className="text-center text-xs text-muted-foreground pt-1">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="font-semibold text-foreground hover:underline">
                Create one
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
