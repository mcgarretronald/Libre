'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, UserPlus, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordTooShort = password.length > 0 && password.length < 8;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, confirm_password: confirmPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed. Please try again.');
        return;
      }

      if (data.autoLogin) {
        // Cookie already set — go straight to the portal
        router.replace('/');
      } else {
        setSuccess('Account created successfully. You can now sign in.');
      }
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
              <UserPlus className="h-6 w-6 text-white" />
            </div>
            <span className="text-white/60 text-sm font-medium tracking-wide uppercase">Join The Portal</span>
          </div>
          <h2 className="text-4xl font-black text-white leading-tight">
            Unlock insights<br />in seconds.
          </h2>
          <p className="text-white/50 text-sm leading-relaxed max-w-xs">
            Create an account to securely access ClickHouse data, configure reporting pipelines, and leverage AI analysis.
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
            <h1 className="text-2xl font-black text-foreground">Create Account</h1>
            <p className="text-sm text-muted-foreground mt-1">Register to access the analytics portal</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400 text-sm">
                <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                Full Name
              </label>
              <input
                id="register-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Jane Doe"
                required
                autoComplete="name"
                className="w-full text-sm px-4 py-3 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring transition"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                Email Address
              </label>
              <input
                id="register-email"
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
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  required
                  autoComplete="new-password"
                  className={`w-full text-sm px-4 py-3 pr-11 rounded-xl border bg-background text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring transition ${
                    passwordTooShort ? 'border-destructive' : 'border-input'
                  }`}
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
              {passwordTooShort && (
                <p className="text-[10px] text-destructive mt-1">Password must be at least 8 characters.</p>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="register-confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  required
                  autoComplete="new-password"
                  className={`w-full text-sm px-4 py-3 pr-11 rounded-xl border bg-background text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring transition ${
                    confirmPassword.length > 0 && !passwordsMatch ? 'border-destructive' : confirmPassword.length > 0 && passwordsMatch ? 'border-emerald-500' : 'border-input'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition z-10"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-[10px] text-destructive mt-1">Passwords do not match.</p>
              )}
            </div>

            <button
              id="register-submit"
              type="submit"
              disabled={isLoading || !name || !email || !password || !confirmPassword || !passwordsMatch || passwordTooShort}
              className="w-full flex items-center justify-center gap-2 font-bold text-sm px-4 py-3.5 rounded-xl text-white transition-all duration-200 hover:opacity-90 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #d94fdc)' }}
            >
              {isLoading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating account...</>
                : <><UserPlus className="h-4 w-4" /> Create Account</>
              }
            </button>

            <p className="text-center text-xs text-muted-foreground pt-1">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-foreground hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
