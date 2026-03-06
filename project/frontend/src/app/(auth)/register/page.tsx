'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ApiError } from '@/lib/api';
import PasswordField from '@/components/PasswordField';

export default function RegisterPage() {
  // Force rebuild for PasswordField update
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register, registerVerify } = useAuth();
  const router = useRouter();

  const passwordStrength = (() => {
    if (!password) return { level: 0, text: '', color: '' };
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 1) return { level: 1, text: '약함', color: 'bg-red-400' };
    if (score <= 2) return { level: 2, text: '보통', color: 'bg-amber-400' };
    if (score <= 3) return { level: 3, text: '좋음', color: 'bg-bamboo-400' };
    return { level: 4, text: '강함', color: 'bg-bamboo-300' };
  })();

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다');
      return;
    }

    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다');
      return;
    }

    setIsLoading(true);

    try {
      await register(email, password, nickname);
      setSuccess('인증 코드가 발송되었습니다');
      setStep('otp');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('회원가입 중 오류가 발생했습니다');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      await registerVerify(email, otp);
      router.push('/verify');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('인증 중 오류가 발생했습니다');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      await register(email, password, nickname);
      setSuccess('인증 코드가 재발송되었습니다');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('재발송 중 오류가 발생했습니다');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 relative">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-[10%] left-[15%] w-[40%] h-[40%] rounded-full bg-bamboo-500/[0.03] blur-[80px]" />
      </div>

      <div className="w-full max-w-[400px] relative z-10">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in-up">
          <Link href="/" className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-bamboo-500/10 border border-bamboo-500/20 mb-5 hover:bg-bamboo-500/15 transition-colors">
            <span className="text-3xl leading-none">🎋</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-100">회원가입</h1>
          <p className="text-gray-500 mt-2 text-sm">
            {step === 'otp'
              ? '이메일로 전송된 인증 코드를 입력하세요'
              : 'Bamboo에서 자유롭게 소통하세요'}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-3 mb-8 animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${step === 'form'
            ? 'bg-bamboo-500/15 text-bamboo-400'
            : 'bg-surface-tertiary text-gray-500'
            }`}>
            <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center">
              {step === 'otp' ? (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : '1'}
            </span>
            정보 입력
          </div>
          <div className="w-6 h-px bg-border" />
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${step === 'otp'
            ? 'bg-bamboo-500/15 text-bamboo-400'
            : 'bg-surface-tertiary text-gray-500'
            }`}>
            <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center">2</span>
            이메일 인증
          </div>
        </div>

        {/* Form Step */}
        {step === 'form' && (
          <form onSubmit={handleSubmitForm} className="animate-fade-in-up relative z-20" style={{ animationDelay: '0.1s' }}>
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
                  <label htmlFor="email" className="label">개인 이메일</label>
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
                  <div className="mt-2.5 p-3 rounded-xl bg-amber-500/8 border border-amber-500/20 flex items-start gap-2.5">
                    <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <div className="text-xs text-amber-300/90 leading-relaxed">
                      <span className="font-semibold">개인 이메일</span>을 입력해주세요.
                      학교 이메일은 졸업 후 <span className="font-medium">중단될 수 있고, 그 경우 로그인이 불가해집니다.</span>
                      <br />
                      <span className="text-amber-400/70">학교 인증은 가입 후 별도 메뉴에서 진행할 수 있습니다.</span>
                    </div>
                  </div>
                </div>

                <div>
                  <PasswordField
                    label="비밀번호"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="8자 이상 입력하세요"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                  {/* Password strength */}
                  {password && (
                    <div className="mt-3">
                      <div className="flex gap-1.5 mb-1.5">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= passwordStrength.level ? passwordStrength.color : 'bg-border'
                              }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-gray-500">
                        비밀번호 강도: <span className={passwordStrength.level >= 3 ? 'text-bamboo-400' : passwordStrength.level >= 2 ? 'text-amber-400' : 'text-red-400'}>{passwordStrength.text}</span>
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <PasswordField
                    label="비밀번호 확인"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="비밀번호를 다시 입력하세요"
                    required
                    autoComplete="new-password"
                    error={Boolean(confirmPassword && confirmPassword !== password)}
                    description={confirmPassword && confirmPassword !== password ? '비밀번호가 일치하지 않습니다' : undefined}
                  />
                  {confirmPassword && confirmPassword !== password && (
                    /* Description handles this, but I'll remove the explicit p tag since I passed description */
                    <></>
                  )}
                </div>

                <div>
                  <label htmlFor="nickname" className="label">닉네임</label>
                  <input
                    id="nickname"
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="input"
                    placeholder="닉네임을 입력하세요"
                    maxLength={50}
                    required
                    autoComplete="nickname"
                  />
                  <p className="text-xs text-gray-600 mt-2 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                    </svg>
                    글 작성 시 익명 대신 닉네임을 표시할 수 있습니다
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !email || password.length < 8 || password !== confirmPassword || !nickname}
                className="btn btn-primary w-full mt-7"
              >
                {isLoading ? <div className="spinner spinner-sm" /> : '인증 코드 받기'}
              </button>
            </div>
          </form>
        )}

        {/* OTP Step */}
        {step === 'otp' && (
          <div className="animate-fade-in-up">
            <form onSubmit={handleVerifyOTP} className="card p-6 sm:p-7">
              {error && (
                <div className="alert alert-error mb-5 flex items-start gap-3">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="alert alert-success mb-5 flex items-start gap-3">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{success}</span>
                </div>
              )}

              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-tertiary text-sm text-gray-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  {email}
                </div>
              </div>

              <div>
                <label htmlFor="otp" className="label text-center">인증 코드 6자리</label>
                <input
                  id="otp"
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input text-center text-2xl tracking-[0.4em] font-mono"
                  placeholder="000000"
                  required
                  maxLength={6}
                  autoFocus
                  autoComplete="one-time-code"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || otp.length !== 6}
                className="btn btn-primary w-full mt-6"
              >
                {isLoading ? <div className="spinner spinner-sm" /> : '인증 완료'}
              </button>

              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={isLoading}
                  className="btn btn-ghost flex-1 text-sm"
                >
                  코드 재발송
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('form'); setOtp(''); setError(''); setSuccess(''); }}
                  className="btn btn-ghost flex-1 text-sm"
                >
                  정보 다시 입력
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-sm text-gray-600 mt-7 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="text-bamboo-400 hover:text-bamboo-300 font-medium transition-colors">
            로그인
          </Link>
        </p>
      </div>
    </main>
  );
}
