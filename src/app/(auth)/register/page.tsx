'use client';

import Link from 'next/link';
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
  const { language } = useUIPreferences();

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <Badge variant="accent">State 03 Onboarding Shell</Badge>
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
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="fullName" className="text-xs font-medium">
            {language === 'bn' ? 'পূর্ণ নাম' : 'Full Name'}
          </label>
          <Input id="fullName" placeholder="Tamjid Hossain" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="reg-email" className="text-xs font-medium">
            {language === 'bn' ? 'ইমেইল ঠিকানা' : 'Email Address'}
          </label>
          <Input id="reg-email" type="email" placeholder="student@learnmate.ai" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="reg-password" className="text-xs font-medium">
            {language === 'bn' ? 'পাসওয়ার্ড' : 'Password'}
          </label>
          <Input id="reg-password" type="password" placeholder="••••••••" />
        </div>
        <Link href="/dashboard" className="block pt-2">
          <Button className="w-full">
            {language === 'bn' ? 'নিবন্ধন ও অনবোর্ডিং শুরু করুন' : 'Register & Start Onboarding'}
          </Button>
        </Link>
      </CardContent>
      <CardFooter className="justify-between text-xs text-[var(--muted-foreground)]">
        <span>{language === 'bn' ? 'ইতিমধ্যে অ্যাকাউন্ট আছে?' : 'Already registered?'}</span>
        <Link href="/login" className="font-semibold text-[var(--primary)] hover:underline">
          {language === 'bn' ? 'সাইন ইন করুন' : 'Sign In'}
        </Link>
      </CardFooter>
    </Card>
  );
}
