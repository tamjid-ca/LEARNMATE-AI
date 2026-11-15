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

export default function LoginPage() {
  const { language } = useUIPreferences();

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <Badge variant="accent">State 03 Auth Shell</Badge>
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
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-xs font-medium">
            {language === 'bn' ? 'ইমেইল ঠিকানা' : 'Email Address'}
          </label>
          <Input id="email" type="email" placeholder="student@learnmate.ai" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-xs font-medium">
            {language === 'bn' ? 'পাসওয়ার্ড' : 'Password'}
          </label>
          <Input id="password" type="password" placeholder="••••••••" />
        </div>
        <Link href="/dashboard" className="block pt-2">
          <Button className="w-full">
            {language === 'bn' ? 'ড্যাশবোর্ডে প্রবেশ করুন' : 'Continue to Workspace'}
          </Button>
        </Link>
      </CardContent>
      <CardFooter className="justify-between text-xs text-[var(--muted-foreground)]">
        <span>{language === 'bn' ? 'নতুন শিক্ষার্থী?' : 'New to LearnMate AI?'}</span>
        <Link href="/register" className="font-semibold text-[var(--primary)] hover:underline">
          {language === 'bn' ? 'অ্যাকাউন্ট তৈরি করুন' : 'Create Student Account'}
        </Link>
      </CardFooter>
    </Card>
  );
}
