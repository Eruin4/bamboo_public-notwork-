'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ApiError, auth } from '@/lib/api';
import PasswordField from '@/components/PasswordField';

export default function ForgotPasswordPage() {
    const [step, setStep] = useState<'email' | 'reset'>('email');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleRequestReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            await auth.requestPasswordReset(email);
            setSuccess('인증 코드가 발송되었습니다');
            setStep('reset');
        } catch (err) {
            if (err instanceof ApiError) {
                setError(err.message);
            } else {
                setError('요청 처리 중 오류가 발생했습니다');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirmReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (newPassword !== confirmPassword) {
            setError('비밀번호가 일치하지 않습니다');
            return;
        }

        setIsLoading(true);

        try {
            await auth.confirmPasswordReset(email, otp, newPassword);
            setSuccess('비밀번호가 성공적으로 변경되었습니다');
            setTimeout(() => {
                router.push('/login');
            }, 2000);
        } catch (err) {
            if (err instanceof ApiError) {
                setError(err.message);
            } else {
                setError('비밀번호 재설정 중 오류가 발생했습니다');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center px-4 py-12 relative">
            {/* Background */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[10%] left-[20%] w-[40%] h-[40%] rounded-full bg-bamboo-500/[0.03] blur-[80px]" />
            </div>

            <div className="w-full max-w-[400px] relative z-10">
                {/* Header */}
                <div className="text-center mb-8 animate-fade-in-up">
                    <Link href="/" className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-bamboo-500/10 border border-bamboo-500/20 mb-5 hover:bg-bamboo-500/15 transition-colors">
                        <span className="text-3xl leading-none">🎋</span>
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-100">비밀번호 찾기</h1>
                    <p className="text-gray-500 mt-2 text-sm">
                        {step === 'email'
                            ? '가입 시 사용한 이메일을 입력하세요'
                            : '전송된 인증 코드와 새 비밀번호를 입력하세요'}
                    </p>
                </div>

                {/* Step 1: Email Request */}
                {step === 'email' && (
                    <form onSubmit={handleRequestReset} className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                        <div className="card p-6 sm:p-7">
                            {error && (
                                <div className="alert alert-error mb-5 text-sm">{error}</div>
                            )}
                            {success && (
                                <div className="alert alert-success mb-5 text-sm">{success}</div>
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
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading || !email}
                                className="btn btn-primary w-full mt-7"
                            >
                                {isLoading ? <div className="spinner spinner-sm" /> : '인증 코드 발송'}
                            </button>
                        </div>
                    </form>
                )}

                {/* Step 2: Confirm Reset */}
                {step === 'reset' && (
                    <form onSubmit={handleConfirmReset} className="animate-fade-in-up relative z-20">
                        <div className="card p-6 sm:p-7 overflow-visible">
                            {error && (
                                <div className="alert alert-error mb-5 text-sm">{error}</div>
                            )}
                            {success && (
                                <div className="alert alert-success mb-5 text-sm">{success}</div>
                            )}

                            <div className="space-y-4">
                                <div className="text-center mb-4">
                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-tertiary text-sm text-gray-400">
                                        {email}
                                        <button
                                            type="button"
                                            onClick={() => { setStep('email'); setOtp(''); setError(''); }}
                                            className="text-bamboo-400 hover:text-bamboo-300 ml-2"
                                        >
                                            변경
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="otp" className="label">인증 코드</label>
                                    <input
                                        id="otp"
                                        type="text"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        className="input text-center text-lg font-mono tracking-widest"
                                        placeholder="000000"
                                        required
                                        maxLength={6}
                                        autoFocus
                                        autoComplete="one-time-code"
                                    />
                                </div>

                                <PasswordField
                                    label="새 비밀번호"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="8자 이상 입력하세요"
                                    required
                                    minLength={8}
                                    autoComplete="new-password"
                                />

                                <PasswordField
                                    label="새 비밀번호 확인"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="비밀번호를 다시 입력하세요"
                                    required
                                    autoComplete="new-password"
                                    className={`${confirmPassword && confirmPassword !== newPassword ? 'border-red-500/50' : ''}`}
                                    description={confirmPassword && confirmPassword !== newPassword ? '비밀번호가 일치하지 않습니다' : undefined}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading || otp.length !== 6 || newPassword.length < 8 || newPassword !== confirmPassword}
                                className="btn btn-primary w-full mt-7"
                            >
                                {isLoading ? <div className="spinner spinner-sm" /> : '비밀번호 변경'}
                            </button>

                            <button
                                type="button"
                                onClick={handleRequestReset} // Resend logic reuse
                                disabled={isLoading}
                                className="btn btn-ghost w-full mt-2 text-sm"
                            >
                                인증 코드 재발송
                            </button>
                        </div>
                    </form>
                )}

                {/* Footer */}
                <p className="text-center text-sm text-gray-600 mt-7 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                    <Link href="/login" className="text-bamboo-400 hover:text-bamboo-300 font-medium transition-colors">
                        로그인으로 돌아가기
                    </Link>
                </p>
            </div>
        </main>
    );
}
