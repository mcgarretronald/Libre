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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img
            src="https://jacarandahealth.org/ypoagriw/2023/09/JH-LOGO-WHITE-1.svg"
            alt="Jacaranda Health"
            className="h-10 w-auto mb-4 dark:invert-0 invert"
          />
          <h1 className="text-lg font-bold text-foreground tracking-tight">Create Account</h1>
          <p className="text-xs text-muted-foreground mt-1">Register to access the analytics portal</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">

          {/* Error banner */}
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Success banner */}
          {success && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400 text-sm">
              <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {/* Full name */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">
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
              className="w-full text-sm px-3 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring transition"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">
              Email
            </label>
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@jacarandahealth.org"
              required
              autoComplete="email"
              className="w-full text-sm px-3 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring transition"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">
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
                className={`w-full text-sm px-3 py-2.5 pr-10 rounded-lg border bg-background text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring transition ${
                  passwordTooShort ? 'border-destructive' : 'border-input'
                }`}
              />
              <button type="button" onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition" tabIndex={-1}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {passwordTooShort && (
              <p className="text-[10px] text-destructive mt-1">Password must be at least 8 characters.</p>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">
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
                className={`w-full text-sm px-3 py-2.5 pr-10 rounded-lg border bg-background text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring transition ${
                  confirmPassword.length > 0 && !passwordsMatch ? 'border-destructive' : confirmPassword.length > 0 && passwordsMatch ? 'border-emerald-500' : 'border-input'
                }`}
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition" tabIndex={-1}>
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-[10px] text-destructive mt-1">Passwords do not match.</p>
            )}
          </div>

          {/* Submit */}
          <button
            id="register-submit"
            type="submit"
            disabled={isLoading || !name || !email || !password || !confirmPassword || !passwordsMatch || passwordTooShort}
            className="w-full flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-wider px-4 py-3 rounded-xl text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #3B143C, #5a2060)' }}
          >
            {isLoading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating account...</>
              : <><UserPlus className="h-4 w-4" /> Create Account</>
            }
          </button>

          {/* Link to login */}
          <p className="text-center text-xs text-muted-foreground pt-1">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-foreground hover:underline">
              Sign in
            </Link>
          </p>
        </form>

        <p className="text-center text-[10px] text-muted-foreground/50 mt-6">
          Jacaranda Health Operations Portal · Secure Access
        </p>
      </div>
    </div>
  );
}
