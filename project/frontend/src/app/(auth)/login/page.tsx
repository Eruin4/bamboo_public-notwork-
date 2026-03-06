'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ApiError } from '@/lib/api';
import PasswordField from '@/components/PasswordField';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // 디버깅용 로그 삭제 완료
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      router.push('/boards');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('로그인 중 오류가 발생했습니다');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 relative">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[10%] right-[20%] w-[40%] h-[40%] rounded-full bg-bamboo-500/[0.03] blur-[80px]" />
      </div>

      <div className="w-full max-w-[400px] relative z-10">
        {/* Header */}
        <div className="text-center mb-10 animate-fade-in-up">
          <Link href="/" className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-bamboo-500/10 border border-bamboo-500/20 mb-5 hover:bg-bamboo-500/15 transition-colors">
            <span className="text-3xl leading-none">🎋</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-100">다시 오셨군요</h1>
          <p className="text-gray-500 mt-2 text-sm">
            계정에 로그인하세요
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="animate-fade-in-up relative z-20" style={{ animationDelay: '0.1s' }}>
          <div className="card p-6 sm:p-7 overflow-visible">
            {error && (
              <div className="alert alert-error mb-5 flex items-start gap-3">
                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label htmlFor="email" className="label">이메일</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder="your@email.com"
                  required
                  autoFocus
                  autoComplete="email"
                />
              </div>

              <div>
                <PasswordField
                  label="비밀번호"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <div className="flex justify-end mt-2 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                  <Link href="/forgot-password" className="text-xs text-bamboo-400 hover:text-bamboo-300 transition-colors">
                    비밀번호를 잊으셨나요?
                  </Link>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full mt-7"
            >
              {isLoading ? <div className="spinner spinner-sm" /> : '로그인'}
            </button>
          </div>
        </form>

        {/* Footer */}
        <p className="text-center text-sm text-gray-600 mt-7 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          아직 계정이 없으신가요?{' '}
          <Link href="/register" className="text-bamboo-400 hover:text-bamboo-300 font-medium transition-colors">
            회원가입
          </Link>
        </p>
      </div>
    </main>
  );
}
