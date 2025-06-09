// app/layout.tsx - Root Layout

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { MatcherProvider } from '@/context/matcher-context';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'TERES File Mapper',
  description: 'Fuzzy file matching application for document mapping',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <MatcherProvider>
          {children}
        </MatcherProvider>
      </body>
    </html>
  );
}