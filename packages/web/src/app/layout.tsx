import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'UseAI — Track Your AI Coding Sessions',
  description: 'See how you collaborate with AI. Track sessions, measure productivity, and share your coding journey.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-bg-base text-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
