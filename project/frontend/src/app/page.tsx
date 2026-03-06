'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      if (user.school_email_verified) {
        router.push('/boards');
      } else {
        router.push('/verify');
      }
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="spinner spinner-lg" />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-bamboo-500/[0.04] blur-[100px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-bamboo-600/[0.03] blur-[100px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-5">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">🎋</span>
          <span className="font-bold text-lg text-gray-100">Bamboo</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="btn btn-ghost btn-sm">
            로그인
          </Link>
          <Link href="/register" className="btn btn-primary btn-sm">
            시작하기
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-16 sm:py-24">
        <div className="text-center max-w-2xl mx-auto">
          {/* Icon */}
          <div className="mb-8 animate-fade-in-up" style={{ animationDelay: '0s' }}>
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-bamboo-500/10 border border-bamboo-500/20">
              <span className="text-5xl leading-none">🎋</span>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-5 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <span className="gradient-text">익명의 자유,</span>
            <br />
            <span className="text-gray-100">우리만의 공간</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-gray-400 mb-4 animate-fade-in-up leading-relaxed" style={{ animationDelay: '0.2s' }}>
            고교생들을 위한 익명 커뮤니티
          </p>
          <p className="text-sm text-gray-600 mb-10 animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
            학교 이메일로 인증하고, 안전하게 소통하세요
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center animate-fade-in-up" style={{ animationDelay: '0.35s' }}>
            <Link href="/register" className="btn btn-primary btn-lg shadow-glow">
              <span>무료로 시작하기</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link href="/login" className="btn btn-secondary btn-lg">
              이미 계정이 있어요
            </Link>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="relative z-10 pb-20 px-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {[
            {
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              ),
              title: '학교 인증',
              desc: '학교 이메일로 소속을 인증해요',
            },
            {
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              ),
              title: '익명 보장',
              desc: '게시판별 고유 익명 번호로 활동해요',
            },
            {
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
                </svg>
              ),
              title: '학교별 공간',
              desc: '우리 학교만의 게시판이 있어요',
            },
          ].map((feature, i) => (
            <div
              key={feature.title}
              className="group p-6 rounded-2xl border border-border bg-surface-card/50 hover:border-border-light hover:bg-surface-hover/50 transition-all duration-300 animate-fade-in-up"
              style={{ animationDelay: `${0.45 + i * 0.1}s` }}
            >
              <div className="w-10 h-10 rounded-xl bg-bamboo-500/10 flex items-center justify-center text-bamboo-400 mb-4 group-hover:bg-bamboo-500/15 transition-colors">
                {feature.icon}
              </div>
              <h3 className="font-semibold text-gray-100 mb-1.5">{feature.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 py-8 text-center text-gray-700 text-xs border-t border-border/50">
        <p>© 2024 Bamboo. 고교생들을 위한 커뮤니티</p>
      </footer>
    </main>
  );
}
