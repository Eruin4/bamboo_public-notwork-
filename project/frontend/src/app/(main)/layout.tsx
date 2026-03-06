'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Header from '@/components/Header';
import BottomNavigation from '@/components/BottomNavigation';
import AdBanner from '@/components/AdBanner';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login');
      } else if (!user.school_email_verified) {
        router.push('/verify');
      }
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  if (!user || !user.school_email_verified) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      {/* 모바일 전용 상단 광고 배너 (헤더 바로 아래) */}
      <div className="lg:hidden px-4 pt-2 pb-0">
        <AdBanner variant="banner" />
      </div>
      <main className="flex-1 pb-16 md:pb-0">
        {children}
      </main>
      <BottomNavigation />
    </div>
  );
}

