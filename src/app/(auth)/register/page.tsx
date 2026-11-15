'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, UserPlus } from 'lucide-react';
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

export default function RegisterPage() {
  const router = useRouter();
  const { language, setLanguage } = useUIPreferences();
  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [preferredLanguage, setPreferredLanguage] = React.useState<'en' | 'bn'>(language);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Dhaka';

      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email,
          password,
          preferredLanguage,
          timezone,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        setError(payload?.error?.message ?? 'Unable to create account');
        return;
      }

      setLanguage(preferredLanguage);
      router.push('/onboarding');
      router.refresh();
    } catch {
      setError('Network error while creating your account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <Badge variant="accent">
            {language === 'bn' ? 'শিক্ষার্থী নিবন্ধন' : 'Student Registration'}
          </Badge>
        </div>
        <CardTitle className="text-xl">
          {language === 'bn' ? 'শিক্ষার্থী অ্যাকাউন্ট তৈরি করুন' : 'Create Your Student Account'}
        </CardTitle>
        <CardDescription>
          {language === 'bn'
            ? 'এসএসসি, এইচএসসি, ভর্তি বা বিসিএস প্রস্তুতির জন্য প্রোফাইল সেটআপ করুন।'
            : 'Start personalized AI preparation for SSC, HSC, University Admission, or BCS.'}
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
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

          <div className="space-y-1.5">
            <label htmlFor="fullName" className="text-xs font-medium">
              {language === 'bn' ? 'পূর্ণ নাম' : 'Full Name'}
            </label>
            <Input
              id="fullName"
              required
              minLength={2}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Tamjid Hossain"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reg-email" className="text-xs font-medium">
              {language === 'bn' ? 'ইমেইল ঠিকানা' : 'Email Address'}
            </label>
            <Input
              id="reg-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@learnmate.ai"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reg-password" className="text-xs font-medium">
              {language === 'bn' ? 'পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)' : 'Password (min 8 characters)'}
            </label>
            <Input
              id="reg-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">
              {language === 'bn' ? 'পছন্দের অধ্যয়নের ভাষা' : 'Preferred Learning Language'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={preferredLanguage === 'en' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPreferredLanguage('en')}
              >
                English
              </Button>
              <Button
                type="button"
                variant={preferredLanguage === 'bn' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPreferredLanguage('bn')}
              >
                বাংলা (Bangla)
              </Button>
            </div>
          </div>

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>{language === 'bn' ? 'তৈরি করা হচ্ছে...' : 'Creating account...'}</span>
              </>
            ) : (
              <>
                <UserPlus className="size-4" />
                <span>
                  {language === 'bn'
                    ? 'নিবন্ধন ও অনবোর্ডিং শুরু করুন'
                    : 'Register & Start Onboarding'}
                </span>
              </>
            )}
          </Button>
        </CardContent>
      </form>

      <CardFooter className="justify-between text-xs text-[var(--muted-foreground)]">
        <span>{language === 'bn' ? 'ইতিমধ্যে অ্যাকাউন্ট আছে?' : 'Already registered?'}</span>
        <Link href="/login" className="font-semibold text-[var(--primary)] hover:underline">
          {language === 'bn' ? 'সাইন ইন করুন' : 'Sign In'}
        </Link>
      </CardFooter>
    </Card>
  );
}
