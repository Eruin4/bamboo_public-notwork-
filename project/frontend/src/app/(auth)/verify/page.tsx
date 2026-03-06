'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { auth, ApiError, DomainRequestResponse } from '@/lib/api';
import Link from 'next/link';

export default function VerifyPage() {
  const { user, token, refreshUser, logout, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<'email' | 'otp' | 'domain-request'>('email');
  const [schoolEmail, setSchoolEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Domain request
  const [schoolName, setSchoolName] = useState('');
  const [schoolShortName, setSchoolShortName] = useState('');
  const [emailDomain, setEmailDomain] = useState('');
  const [domainDescription, setDomainDescription] = useState('');
  const [myRequests, setMyRequests] = useState<DomainRequestResponse[]>([]);

  useEffect(() => {
    if (!isAuthLoading) {
      if (!user || !token) {
        router.push('/login');
      } else if (user.school_email_verified) {
        router.push('/boards');
      }
    }
  }, [user, token, isAuthLoading, router]);

  if (isAuthLoading || !user || !token || user.school_email_verified) {
    return null;
  }

  const loadMyRequests = async () => {
    try {
      const requests = await auth.getMyDomainRequests(token);
      setMyRequests(requests);
    } catch {
      // ignore
    }
  };

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      await auth.requestOTP(schoolEmail, token);
      setSuccess('인증 코드가 발송되었습니다');
      setStep('otp');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.message === '지원하지 않는 학교 이메일 도메인입니다') {
          const domain = schoolEmail.includes('@') ? schoolEmail.split('@')[1] : '';
          setEmailDomain(domain);
          setStep('domain-request');
          loadMyRequests();
          return;
        }
        setError(err.message);
      } else {
        setError('OTP 요청 중 오류가 발생했습니다');
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
      await auth.verifyOTP(schoolEmail, otp, token);
      await refreshUser();
      router.push('/boards');
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

  const handleDomainRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      await auth.requestDomain({
        school_name: schoolName,
        school_short_name: schoolShortName,
        email_domain: emailDomain,
        description: domainDescription || undefined,
      }, token);
      setSuccess('도메인 지원 요청이 접수되었습니다! 관리자 승인 후 인증이 가능합니다.');
      setSchoolName('');
      setSchoolShortName('');
      setDomainDescription('');
      loadMyRequests();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('요청 중 오류가 발생했습니다');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="badge badge-yellow">대기중</span>;
      case 'APPROVED':
        return <span className="badge badge-green">승인됨</span>;
      case 'REJECTED':
        return <span className="badge badge-red">거절됨</span>;
      default:
        return null;
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[20%] left-[10%] w-[40%] h-[40%] rounded-full bg-bamboo-500/[0.03] blur-[80px]" />
      </div>

      <div className="w-full max-w-[440px] relative z-10">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in-up">
          <Link href="/" className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-bamboo-500/10 border border-bamboo-500/20 mb-5 hover:bg-bamboo-500/15 transition-colors">
            <span className="text-3xl leading-none">🎋</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-100">학교 인증</h1>
          <p className="text-gray-500 mt-2 text-sm">
            {step === 'domain-request'
              ? '학교 도메인 지원을 요청해주세요'
              : step === 'otp'
                ? '이메일로 전송된 인증 코드를 입력하세요'
                : '학교 이메일로 소속을 인증해주세요'
            }
          </p>
        </div>

        {/* Step indicator */}
        {step !== 'domain-request' && (
          <div className="flex items-center justify-center gap-3 mb-8 animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${step === 'email'
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
              이메일 입력
            </div>
            <div className="w-6 h-px bg-border" />
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${step === 'otp'
                ? 'bg-bamboo-500/15 text-bamboo-400'
                : 'bg-surface-tertiary text-gray-500'
              }`}>
              <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center">2</span>
              코드 인증
            </div>
          </div>
        )}

        {/* Email Step */}
        {step === 'email' && (
          <form onSubmit={handleRequestOTP} className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <div className="card p-6 sm:p-7">
              {error && (
                <div className="alert alert-error mb-5 flex items-start gap-3">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label htmlFor="schoolEmail" className="label">학교 이메일</label>
                <input
                  id="schoolEmail"
                  type="email"
                  value={schoolEmail}
                  onChange={(e) => setSchoolEmail(e.target.value)}
                  className="input"
                  placeholder="yourname@school.hs.kr"
                  required
                  autoFocus
                />
                <p className="text-xs text-gray-600 mt-2 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                  학교에서 발급받은 이메일 주소를 입력하세요
                </p>
              </div>

              <button type="submit" disabled={isLoading} className="btn btn-primary w-full mt-6">
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
                  {schoolEmail}
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
                {isLoading ? <div className="spinner spinner-sm" /> : '인증하기'}
              </button>

              <button
                type="button"
                onClick={() => { setStep('email'); setOtp(''); setError(''); setSuccess(''); }}
                className="btn btn-ghost w-full mt-2 text-sm"
              >
                이메일 다시 입력
              </button>
            </form>
          </div>
        )}

        {/* Domain Request Step */}
        {step === 'domain-request' && (
          <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            {/* Notice */}
            <div className="alert alert-warning mb-5 flex items-start gap-3">
              <svg className="w-5 h-5 mt-0.5 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <div>
                <p className="font-medium text-amber-300 text-sm mb-1">지원하지 않는 도메인</p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  <span className="font-mono text-amber-400/80">{emailDomain}</span> 도메인은 아직 등록되지 않았습니다.
                  아래 양식을 작성하시면 관리자가 검토 후 추가해드립니다.
                </p>
              </div>
            </div>

            <form onSubmit={handleDomainRequest} className="card p-6 sm:p-7">
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

              <div className="space-y-5">
                <div>
                  <label htmlFor="schoolName" className="label">
                    학교 이름 <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="schoolName"
                    type="text"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className="input"
                    placeholder="예: 한국과학영재학교"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label htmlFor="schoolShortName" className="label">
                    학교 약칭 <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="schoolShortName"
                    type="text"
                    value={schoolShortName}
                    onChange={(e) => setSchoolShortName(e.target.value)}
                    className="input"
                    placeholder="예: 한과영"
                    required
                    maxLength={20}
                  />
                  <p className="text-xs text-gray-600 mt-2">게시판 이름에 사용됩니다</p>
                </div>

                <div>
                  <label htmlFor="emailDomain" className="label">
                    이메일 도메인 <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="emailDomain"
                    type="text"
                    value={emailDomain}
                    onChange={(e) => setEmailDomain(e.target.value)}
                    className="input font-mono text-sm"
                    placeholder="예: school.hs.kr"
                    required
                  />
                  <p className="text-xs text-gray-600 mt-2">@ 뒤에 오는 도메인 부분</p>
                </div>

                <div>
                  <label htmlFor="domainDescription" className="label">
                    학교 설명 <span className="text-gray-600 text-xs font-normal">(선택)</span>
                  </label>
                  <textarea
                    id="domainDescription"
                    value={domainDescription}
                    onChange={(e) => setDomainDescription(e.target.value)}
                    className="input min-h-[80px] resize-none"
                    placeholder="예: 서울 소재 과학고등학교"
                    maxLength={500}
                    rows={3}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !schoolName || !schoolShortName || !emailDomain}
                className="btn btn-primary w-full mt-6"
              >
                {isLoading ? <div className="spinner spinner-sm" /> : '도메인 지원 요청'}
              </button>

              <button
                type="button"
                onClick={() => { setStep('email'); setError(''); setSuccess(''); }}
                className="btn btn-ghost w-full mt-2 text-sm"
              >
                ← 이메일 입력으로 돌아가기
              </button>
            </form>

            {/* Previous requests */}
            {myRequests.length > 0 && (
              <div className="card p-5 mt-5">
                <h3 className="text-sm font-semibold text-gray-300 mb-4">내 요청 내역</h3>
                <div className="space-y-3">
                  {myRequests.map((req) => (
                    <div key={req.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-secondary text-sm">
                      <div className="min-w-0">
                        <span className="font-medium text-gray-200">{req.school_name}</span>
                        <span className="text-gray-600 ml-2 text-xs font-mono">{req.email_domain}</span>
                      </div>
                      {getStatusBadge(req.status)}
                    </div>
                  ))}
                </div>
                {myRequests.some(r => r.status === 'APPROVED') && (
                  <button
                    onClick={() => { setStep('email'); setError(''); setSuccess(''); }}
                    className="btn btn-primary w-full mt-4 text-sm"
                  >
                    승인된 도메인으로 인증하기
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                )}
                {myRequests.some(r => r.status === 'REJECTED' && r.admin_note) && (
                  <div className="alert alert-error mt-3 text-xs">
                    <span className="font-semibold">관리자 메모:</span>{' '}
                    {myRequests.find(r => r.status === 'REJECTED' && r.admin_note)?.admin_note}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-sm text-gray-600 mt-7 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <button onClick={logout} className="text-bamboo-400 hover:text-bamboo-300 font-medium transition-colors">
            다른 계정으로 로그인
          </button>
        </p>
      </div>
    </main>
  );
}
