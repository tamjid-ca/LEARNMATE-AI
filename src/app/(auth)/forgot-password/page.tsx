'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, KeyRound, Loader2 } from 'lucide-react';
import { useUIPreferences } from '@/components/providers/app-providers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function ForgotPasswordPage() {
  const { language } = useUIPreferences();
  const [email, setEmail] = React.useState('');
  const [resetToken, setResetToken] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [step, setStep] = React.useState<'request' | 'reset' | 'done'>('request');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function handleRequestReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        setError(payload?.error?.message ?? 'Unable to process request');
        return;
      }
      if (payload.data?.resetToken) {
        setResetToken(payload.data.resetToken);
      }
      setStep('reset');
    } catch {
      setError('Network error while requesting password reset.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, newPassword }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        setError(payload?.error?.message ?? 'Invalid or expired reset token');
        return;
      }
      setStep('done');
    } catch {
      setError('Network error while resetting password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-2">
        <Badge variant="accent" className="w-fit">
          {language === 'bn' ? 'পাসওয়ার্ড পুনরুদ্ধার' : 'Password Recovery'}
        </Badge>
        <CardTitle className="text-xl">
          {language === 'bn' ? 'আপনার পাসওয়ার্ড রিসেট করুন' : 'Reset Your Password'}
        </CardTitle>
        <CardDescription>
          {language === 'bn'
            ? 'ইমেইল ঠিকানা দিয়ে রিসেট টোকেন তৈরি করুন এবং নতুন পাসওয়ার্ড সেট করুন।'
            : 'Request a signed recovery token and set a new password for your account.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {error ? (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400"
          >
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {step === 'request' ? (
          <form onSubmit={handleRequestReset} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="recovery-email" className="text-xs font-medium">
                {language === 'bn' ? 'ইমেইল ঠিকানা' : 'Account Email'}
              </label>
              <Input
                id="recovery-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@learnmate.ai"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
              <span>
                {language === 'bn' ? 'রিসেট টোকেন পাঠান' : 'Send Recovery Token'}
              </span>
            </Button>
          </form>
        ) : null}

        {step === 'reset' ? (
          <form onSubmit={handleConfirmReset} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="reset-token" className="text-xs font-medium">
                {language === 'bn' ? 'রিসেট টোকেন' : 'Recovery Token'}
              </label>
              <Input
                id="reset-token"
                required
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                placeholder="Paste recovery token"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="new-password" className="text-xs font-medium">
                {language === 'bn' ? 'নতুন পাসওয়ার্ড' : 'New Password (min 8 chars)'}
              </label>
              <Input
                id="new-password"
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              <span>{language === 'bn' ? 'পাসওয়ার্ড আপডেট করুন' : 'Update Password'}</span>
            </Button>
          </form>
        ) : null}

        {step === 'done' ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-6" />
            </div>
            <p className="text-sm font-medium">
              {language === 'bn'
                ? 'আপনার পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে!'
                : 'Your password has been updated!'}
            </p>
            <Link href="/login" className="block">
              <Button className="w-full">
                {language === 'bn' ? 'সাইন ইন পেজে যান' : 'Return to Sign In'}
              </Button>
            </Link>
          </div>
        ) : null}
      </CardContent>

      <CardFooter className="justify-between text-xs text-[var(--muted-foreground)]">
        <Link href="/login" className="font-semibold text-[var(--primary)] hover:underline">
          {language === 'bn' ? '← সাইন ইন পেজে ফিরে যান' : '← Back to Sign In'}
        </Link>
      </CardFooter>
    </Card>
  );
}
