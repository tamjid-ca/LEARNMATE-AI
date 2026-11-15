'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, LogIn } from 'lucide-react';
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

export default function LoginPage() {
  const router = useRouter();
  const { language, setLanguage } = useUIPreferences();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        setError(payload?.error?.message ?? 'Invalid email or password');
        return;
      }

      const user = payload.data?.user;
      if (user?.preferredLanguage === 'en' || user?.preferredLanguage === 'bn') {
        setLanguage(user.preferredLanguage);
      }

      if (user && !user.onboardingCompleted && user.role === 'student') {
        router.push('/onboarding');
      } else {
        router.push('/dashboard');
      }
      router.refresh();
    } catch {
      setError('Network error while signing in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <Badge variant="accent">
            {language === 'bn' ? 'নিরাপদ সাইন ইন' : 'Student & Admin Sign In'}
          </Badge>
        </div>
        <CardTitle className="text-xl">
          {language === 'bn' ? 'আপনার অ্যাকাউন্টে সাইন ইন করুন' : 'Sign in to LearnMate AI'}
        </CardTitle>
        <CardDescription>
          {language === 'bn'
            ? 'আপনার শিক্ষা প্রোফাইল, এআই টিউটর এবং প্রস্তুতির রোডম্যাপে প্রবেশ করুন।'
            : 'Access your personalized study roadmap, AI subject tutor, and flashcards.'}
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
            <label htmlFor="email" className="text-xs font-medium">
              {language === 'bn' ? 'ইমেইল ঠিকানা' : 'Email Address'}
            </label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@learnmate.ai"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-xs font-medium">
                {language === 'bn' ? 'পাসওয়ার্ড' : 'Password'}
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-[var(--primary)] hover:underline"
              >
                {language === 'bn' ? 'পাসওয়ার্ড ভুলে গেছেন?' : 'Forgot password?'}
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>{language === 'bn' ? 'যাচাই করা হচ্ছে...' : 'Signing in...'}</span>
              </>
            ) : (
              <>
                <LogIn className="size-4" />
                <span>{language === 'bn' ? 'সাইন ইন করুন' : 'Sign In'}</span>
              </>
            )}
          </Button>
        </CardContent>
      </form>

      <CardFooter className="justify-between text-xs text-[var(--muted-foreground)]">
        <span>{language === 'bn' ? 'নতুন শিক্ষার্থী?' : 'New to LearnMate AI?'}</span>
        <Link href="/register" className="font-semibold text-[var(--primary)] hover:underline">
          {language === 'bn' ? 'অ্যাকাউন্ট তৈরি করুন' : 'Create Student Account'}
        </Link>
      </CardFooter>
    </Card>
  );
}
