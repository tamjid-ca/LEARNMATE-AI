import type { Metadata } from 'next';
import './globals.css';
import { AppProviders } from '@/components/providers/app-providers';

export const metadata: Metadata = {
  title: {
    default: 'LearnMate AI — Personalized AI Learning & Exam Preparation Platform',
    template: '%s | LearnMate AI',
  },
  description:
    'Context-aware AI subject tutoring, structured study materials, adaptive quizzes, SM-2 flashcards, RAG document learning, and personalized exam roadmaps for SSC, HSC, University Admission, BCS, and global curricula.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
