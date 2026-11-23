'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  LogOut,
  Save,
  Trash2,
  UserCog,
} from 'lucide-react';
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

export default function StudentSettingsPage() {
  const router = useRouter();
  const { language, setLanguage } = useUIPreferences();

  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [institution, setInstitution] = React.useState('');
  const [country, setCountry] = React.useState('BD');
  const [timezone, setTimezone] = React.useState('Asia/Dhaka');
  const [dailyStudyMinutes, setDailyStudyMinutes] = React.useState(120);
  const [preferredLanguage, setPreferredLanguage] = React.useState<'en' | 'bn'>(language);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    fetch('/api/v1/users/profile')
      .then((res) => res.json())
      .then((payload) => {
        if (!active || !payload?.success || !payload.data?.user) return;
        const u = payload.data.user;
        setFullName(u.fullName ?? '');
        setEmail(u.email ?? '');
        setInstitution(u.institution ?? '');
        setCountry(u.country ?? 'BD');
        setTimezone(u.timezone ?? 'Asia/Dhaka');
        setDailyStudyMinutes(u.dailyStudyMinutes ?? 120);
        if (u.preferredLanguage === 'en' || u.preferredLanguage === 'bn') {
          setPreferredLanguage(u.preferredLanguage);
        }
      })
      .catch(() => {
        // Ignore initial fetch error if viewing in preview
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSaveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setStatusMessage(null);
    setSaving(true);

    try {
      const res = await fetch('/api/v1/users/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          institution,
          country,
          timezone,
          dailyStudyMinutes: Number(dailyStudyMinutes),
          preferredLanguage,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        setError(payload?.error?.message ?? 'Unable to update profile');
        return;
      }
      setLanguage(preferredLanguage);
      setStatusMessage(
        preferredLanguage === 'bn'
          ? 'প্রোফাইল এবং সেটিংস সফলভাবে সংরক্ষিত হয়েছে।'
          : 'Profile and study settings saved.',
      );
    } catch {
      setError('Network error while updating settings.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await fetch('/api/v1/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/users/profile', { method: 'DELETE' });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        setError(payload?.error?.message ?? 'Unable to delete account');
        return;
      }
      router.push('/register');
      router.refresh();
    } catch {
      setError('Network error while deleting account.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <Badge variant="accent">FR-AUTH-004 · FR-AUTH-006 · FR-AUTH-007</Badge>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            {language === 'bn' ? 'অ্যাকাউন্ট ও অধ্যয়ন সেটিংস' : 'Profile & Learning Preferences'}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {language === 'bn'
              ? 'আপনার ব্যক্তিগত তথ্য, ভাষা, টাইমজোন এবং গোপনীয়তা পরিচালনা করুন।'
              : 'Manage your profile details, preferred language, timezone, daily study targets, and account data.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/settings/education">
            <Button variant="default" size="sm">
              <span>
                {language === 'bn'
                  ? 'কাস্টম শিক্ষা ব্যবস্থা ও লেবেল'
                  : 'Custom Education & Labels'}
              </span>
            </Button>
          </Link>
          <Link href="/onboarding">
            <Button variant="outline" size="sm">
              <UserCog className="size-4" />
              <span>
                {language === 'bn' ? 'অনবোর্ডিং পুনরায় সেট করুন' : 'Update Onboarding Track'}
              </span>
            </Button>
          </Link>
          <Button variant="secondary" size="sm" onClick={handleSignOut}>
            <LogOut className="size-4" />
            <span>{language === 'bn' ? 'সাইন আউট' : 'Sign Out'}</span>
          </Button>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {statusMessage ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300"
        >
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      ) : null}

      <form onSubmit={handleSaveProfile}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {language === 'bn' ? 'ব্যক্তিগত ও শিক্ষাগত তথ্য' : 'Personal & Study Preferences'}
            </CardTitle>
            <CardDescription>
              {email ? `Signed in as ${email}` : 'Update your profile information below.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="settings-name" className="text-xs font-medium">
                {language === 'bn' ? 'পূর্ণ নাম' : 'Full Name'}
              </label>
              <Input
                id="settings-name"
                required
                minLength={2}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="settings-inst" className="text-xs font-medium">
                {language === 'bn' ? 'শিক্ষা প্রতিষ্ঠান' : 'Academic Institution'}
              </label>
              <Input
                id="settings-inst"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="settings-tz" className="text-xs font-medium">
                {language === 'bn' ? 'টাইমজোন' : 'Timezone'}
              </label>
              <Input
                id="settings-tz"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="settings-minutes" className="text-xs font-medium">
                {language === 'bn' ? 'দৈনিক পড়ার লক্ষ্য (মিনিট)' : 'Daily Study Goal (Minutes)'}
              </label>
              <Input
                id="settings-minutes"
                type="number"
                min={15}
                max={720}
                value={dailyStudyMinutes}
                onChange={(e) => setDailyStudyMinutes(Number(e.target.value))}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="settings-country" className="text-xs font-medium">
                {language === 'bn' ? 'দেশ' : 'Country Code'}
              </label>
              <Input
                id="settings-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">
                {language === 'bn' ? 'পছন্দের ভাষা' : 'Preferred Language'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={preferredLanguage === 'en' ? 'default' : 'outline'}
                  onClick={() => setPreferredLanguage('en')}
                >
                  English
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={preferredLanguage === 'bn' ? 'default' : 'outline'}
                  onClick={() => setPreferredLanguage('bn')}
                >
                  বাংলা
                </Button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-end border-t border-[var(--border)] pt-4">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              <span>{language === 'bn' ? 'পরিবর্তন সংরক্ষণ করুন' : 'Save Preferences'}</span>
            </Button>
          </CardFooter>
        </Card>
      </form>

      {/* Danger Zone: Account & Personal Data Deletion (FR-AUTH-007) */}
      <Card className="border-red-500/30">
        <CardHeader>
          <CardTitle className="text-base text-red-600 dark:text-red-400">
            {language === 'bn'
              ? 'অ্যাকাউন্ট ও ব্যক্তিগত তথ্য মুছে ফেলুন'
              : 'Delete Account & Personal Study Data'}
          </CardTitle>
          <CardDescription>
            {language === 'bn'
              ? 'এই কাজটি আপনার অ্যাকাউন্ট এবং সংরক্ষিত নোট, কুইজ, ফ্ল্যাশকার্ড ও ডকুমেন্ট স্থায়ীভাবে মুছে ফেলবে।'
              : 'Permanently delete your account along with all personal conversations, saved materials, quiz attempts, flashcards, study plans, and uploaded documents.'}
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button
            variant="destructive"
            size="sm"
            disabled={deleting}
            onClick={handleDeleteAccount}
          >
            {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            <span>
              {language === 'bn'
                ? 'আমার অ্যাকাউন্ট স্থায়ীভাবে মুছে ফেলুন'
                : 'Delete My Account & Data'}
            </span>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
