'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiError, auth, posts, comments, PostListItem, MyCommentItem } from '@/lib/api';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import PasswordField from '@/components/PasswordField';

type Tab = 'profile' | 'posts' | 'comments' | 'scraps';

export default function MyPage() {
    const { user, token, refreshUser, logout } = useAuth();
    const searchParams = useSearchParams();
    const tabParam = searchParams.get('tab');
    const [activeTab, setActiveTab] = useState<Tab>(
        (tabParam === 'posts' || tabParam === 'comments' || tabParam === 'scraps') ? tabParam : 'profile'
    );

    // Profile State
    const [nickname, setNickname] = useState(user?.nickname || '');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Password Change State
    const [pwStep, setPwStep] = useState<'request' | 'verify'>('request');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [pwError, setPwError] = useState('');
    const [pwSuccess, setPwSuccess] = useState('');
    const [isPwLoading, setIsPwLoading] = useState(false);

    // Activity State
    const [myPosts, setMyPosts] = useState<PostListItem[]>([]);
    const [myComments, setMyComments] = useState<MyCommentItem[]>([]);
    const [myScraps, setMyScraps] = useState<PostListItem[]>([]);
    const [activityLoading, setActivityLoading] = useState(false);

    useEffect(() => {
        if (!token) return;
        if (activeTab === 'posts') {
            setActivityLoading(true);
            posts.my(token).then(data => setMyPosts(data.posts)).catch(() => { }).finally(() => setActivityLoading(false));
        } else if (activeTab === 'comments') {
            setActivityLoading(true);
            comments.my(token).then(data => setMyComments(data.comments)).catch(() => { }).finally(() => setActivityLoading(false));
        } else if (activeTab === 'scraps') {
            setActivityLoading(true);
            posts.scrapped(token).then(data => setMyScraps(data.posts)).catch(() => { }).finally(() => setActivityLoading(false));
        }
    }, [token, activeTab]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) return;
        setError('');
        setSuccess('');
        setIsLoading(true);
        try {
            await auth.updateMe({ nickname: nickname || undefined }, token);
            await refreshUser();
            setSuccess('프로필이 업데이트되었습니다');
        } catch (err) {
            if (err instanceof ApiError) setError(err.message);
            else setError('프로필 수정 중 오류가 발생했습니다');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRequestOTP = async () => {
        if (!token || !user) return;
        setPwError('');
        setPwSuccess('');
        setIsPwLoading(true);
        try {
            await auth.requestPasswordReset(user.personal_email);
            setPwStep('verify');
            alert(`인증번호가 ${user.personal_email}로 발송되었습니다.`);
        } catch (err) {
            if (err instanceof ApiError) setPwError(err.message);
            else setPwError('인증번호 발송 중 오류가 발생했습니다');
        } finally {
            setIsPwLoading(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token || !user) return;
        setPwError('');
        setPwSuccess('');
        if (newPassword !== confirmNewPassword) {
            setPwError('새 비밀번호가 일치하지 않습니다');
            return;
        }
        setIsPwLoading(true);
        try {
            await auth.confirmPasswordReset(user.personal_email, otp, newPassword);
            setPwSuccess('비밀번호가 성공적으로 변경되었습니다');
            setPwStep('request');
            setOtp('');
            setNewPassword('');
            setConfirmNewPassword('');
        } catch (err) {
            if (err instanceof ApiError) setPwError(err.message);
            else setPwError('비밀번호 변경 중 오류가 발생했습니다');
        } finally {
            setIsPwLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!token) return;
        if (!window.confirm('정말로 탈퇴하시겠습니까?\n\n탈퇴 시 계정 정보는 영구적으로 삭제되며 복구할 수 없습니다.\n(작성한 게시글은 보존되지만 작성자 정보는 알 수 없게 됩니다)')) {
            return;
        }
        setIsLoading(true);
        try {
            await auth.deleteAccount(token);
            logout();
            window.location.href = '/';
        } catch (err) {
            if (err instanceof ApiError) setError(err.message);
            else setError('탈퇴 처리 중 오류가 발생했습니다');
            setIsLoading(false);
        }
    };

    if (!user) return null;

    const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
        {
            key: 'profile', label: '프로필',
            icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>,
        },
        {
            key: 'posts', label: '내 글',
            icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>,
        },
        {
            key: 'comments', label: '내 댓글',
            icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" /></svg>,
        },
        {
            key: 'scraps', label: '스크랩',
            icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" /></svg>,
        },
    ];

    return (
        <div className="container-app py-6 max-w-2xl mx-auto">
            <h1 className="text-xl font-bold text-gray-100 mb-5 animate-fade-in-up">마이페이지</h1>

            {/* Tabs */}
            <div className="flex gap-1 bg-surface-secondary rounded-xl p-1 mb-6 animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-all ${activeTab === tab.key
                            ? 'bg-surface-card text-bamboo-400 shadow-sm'
                            : 'text-gray-500 hover:text-gray-300'
                            }`}
                    >
                        {tab.icon}
                        <span className="hidden sm:inline">{tab.label}</span>
                        <span className="sm:hidden">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Profile Tab */}
            {activeTab === 'profile' && (
                <div className="animate-fade-in-up space-y-6">
                    <div className="card p-6">
                        <h2 className="text-lg font-semibold text-gray-200 mb-4">내 정보 수정</h2>
                        {error && <div className="alert alert-error mb-5 text-sm">{error}</div>}
                        {success && <div className="alert bg-green-500/10 text-green-400 border-green-500/20 mb-5 text-sm">{success}</div>}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="label">개인 이메일</label>
                                <input type="text" value={user.personal_email} disabled className="input bg-surface-tertiary text-gray-500 cursor-not-allowed" />
                            </div>
                            <div>
                                <label className="label">학교 인증 정보</label>
                                <div className="space-y-2">
                                    <input type="text" value={user.school_name || '미인증'} disabled className="input bg-surface-tertiary text-gray-500 cursor-not-allowed" />
                                    {user.school_email && <p className="text-xs text-gray-500">인증된 이메일: {user.school_email}</p>}
                                </div>
                            </div>
                            <div>
                                <label htmlFor="nickname" className="label">닉네임</label>
                                <input id="nickname" type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} className="input" placeholder="닉네임을 입력하세요" maxLength={50} required />
                                <p className="text-xs text-gray-600 mt-2">게시글 작성 시 닉네임을 선택하면 이 이름이 표시됩니다</p>
                            </div>
                            <div className="pt-4 flex justify-end">
                                <button type="submit" disabled={isLoading || nickname === user.nickname} className="btn btn-primary">
                                    {isLoading ? <div className="spinner spinner-sm" /> : '저장하기'}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Password Change */}
                    <div className="card p-6 overflow-visible relative z-10">
                        <h2 className="text-lg font-semibold text-gray-200 mb-2">비밀번호 변경</h2>
                        <p className="text-sm text-gray-500 mb-6">
                            보안을 위해 <strong>개인 이메일({user.personal_email})</strong>로 인증번호를 발송하여 비밀번호를 변경합니다.
                        </p>
                        {pwError && <div className="alert alert-error mb-5 text-sm">{pwError}</div>}
                        {pwSuccess && <div className="alert bg-green-500/10 text-green-400 border-green-500/20 mb-5 text-sm">{pwSuccess}</div>}
                        {pwStep === 'request' ? (
                            <div className="flex justify-end">
                                <button type="button" onClick={handleRequestOTP} disabled={isPwLoading} className="btn btn-primary">
                                    {isPwLoading ? <div className="spinner spinner-sm" /> : '인증번호 발송'}
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleChangePassword} className="space-y-4">
                                <div>
                                    <label className="label">인증번호</label>
                                    <div className="flex gap-2">
                                        <input type="text" value={otp} onChange={(e) => setOtp(e.target.value)} className="input flex-1 tracking-widest font-mono text-center" placeholder="인증번호 6자리" maxLength={6} required />
                                        <button type="button" onClick={handleRequestOTP} disabled={isPwLoading} className="btn btn-secondary whitespace-nowrap">재전송</button>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">이메일로 발송된 6자리 인증번호를 입력하세요</p>
                                </div>
                                <PasswordField label="새 비밀번호" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="8자 이상 입력하세요" required minLength={8} autoComplete="new-password" />
                                <PasswordField label="새 비밀번호 확인" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder="새 비밀번호를 다시 입력하세요" required autoComplete="new-password" error={Boolean(confirmNewPassword && confirmNewPassword !== newPassword)} description={confirmNewPassword && confirmNewPassword !== newPassword ? '비밀번호가 일치하지 않습니다' : undefined} />
                                <div className="pt-4 flex justify-end gap-2">
                                    <button type="button" onClick={() => { setPwStep('request'); setOtp(''); setPwError(''); }} className="btn btn-ghost">취소</button>
                                    <button type="submit" disabled={isPwLoading || !otp || !newPassword || newPassword !== confirmNewPassword} className="btn btn-primary">
                                        {isPwLoading ? <div className="spinner spinner-sm" /> : '변경하기'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>

                    {/* Account Management */}
                    <div className="card p-6 border-red-500/10">
                        <h2 className="text-lg font-semibold text-red-400 mb-2">계정 관리</h2>
                        <p className="text-sm text-gray-500 mb-4">회원 탈퇴 시 계정 정보가 삭제되며 복구할 수 없습니다.</p>
                        <div className="flex justify-end">
                            <button type="button" onClick={handleDeleteAccount} disabled={isLoading} className="btn bg-red-500/10 text-red-400 hover:bg-red-500/20 border-transparent">
                                회원 탈퇴
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* My Posts Tab */}
            {activeTab === 'posts' && (
                <div className="animate-fade-in-up">
                    {activityLoading ? (
                        <div className="flex justify-center py-12"><div className="spinner" /></div>
                    ) : myPosts.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="w-14 h-14 rounded-2xl bg-surface-secondary border border-border flex items-center justify-center mx-auto mb-4">
                                <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                            </div>
                            <p className="text-gray-500 text-sm">작성한 게시글이 없습니다</p>
                        </div>
                    ) : (
                        <div className="rounded-xl overflow-hidden border border-border bg-surface-card divide-y divide-border">
                            {myPosts.map((post) => (
                                <Link
                                    key={post.id}
                                    href={`/boards/${post.board_id}/posts/${post.id}`}
                                    className="block px-4 py-3 hover:bg-surface-hover transition-colors"
                                >
                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex items-center gap-2 min-w-0">
                                            {post.board_name && (
                                                <span className="shrink-0 text-[11px] px-1.5 py-0.5 rounded bg-surface-tertiary text-bamboo-400">
                                                    {post.board_name}
                                                </span>
                                            )}
                                            <h3 className="font-medium text-[15px] text-gray-200 truncate">{post.title}</h3>
                                            {post.comment_count > 0 && (
                                                <span className="text-[11px] font-medium text-bamboo-400 tabular-nums shrink-0">[{post.comment_count}]</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <span className="tabular-nums">{formatDate(post.created_at)}</span>
                                            <span className="w-0.5 h-0.5 bg-gray-700 rounded-full" />
                                            <span className="tabular-nums">조회 {post.view_count}</span>
                                            {post.like_count > 0 && (
                                                <>
                                                    <span className="w-0.5 h-0.5 bg-gray-700 rounded-full" />
                                                    <span className="text-pink-400 tabular-nums">좋아요 {post.like_count}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* My Comments Tab */}
            {activeTab === 'comments' && (
                <div className="animate-fade-in-up">
                    {activityLoading ? (
                        <div className="flex justify-center py-12"><div className="spinner" /></div>
                    ) : myComments.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="w-14 h-14 rounded-2xl bg-surface-secondary border border-border flex items-center justify-center mx-auto mb-4">
                                <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" /></svg>
                            </div>
                            <p className="text-gray-500 text-sm">작성한 댓글이 없습니다</p>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {myComments.map((comment) => (
                                <Link
                                    key={comment.id}
                                    href={`/boards/${comment.board_id}/posts/${comment.post_id}`}
                                    className="card block p-4 hover:bg-surface-hover transition-colors"
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        {comment.board_name && (
                                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-surface-tertiary text-bamboo-400">
                                                {comment.board_name}
                                            </span>
                                        )}
                                        <span className="text-xs text-gray-500 truncate">{comment.post_title}</span>
                                    </div>
                                    <p className="text-sm text-gray-200 line-clamp-2">{comment.body}</p>
                                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                                        <span className="tabular-nums">{formatDate(comment.created_at)}</span>
                                        {comment.like_count > 0 && (
                                            <>
                                                <span className="w-0.5 h-0.5 bg-gray-700 rounded-full" />
                                                <span className="text-pink-400 tabular-nums">좋아요 {comment.like_count}</span>
                                            </>
                                        )}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Scraps Tab */}
            {activeTab === 'scraps' && (
                <div className="animate-fade-in-up">
                    {activityLoading ? (
                        <div className="flex justify-center py-12"><div className="spinner" /></div>
                    ) : myScraps.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="w-14 h-14 rounded-2xl bg-surface-secondary border border-border flex items-center justify-center mx-auto mb-4">
                                <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" /></svg>
                            </div>
                            <p className="text-gray-500 text-sm">스크랩한 게시글이 없습니다</p>
                        </div>
                    ) : (
                        <div className="rounded-xl overflow-hidden border border-border bg-surface-card divide-y divide-border">
                            {myScraps.map((post) => (
                                <Link
                                    key={post.id}
                                    href={`/boards/${post.board_id}/posts/${post.id}`}
                                    className="block px-4 py-3 hover:bg-surface-hover transition-colors"
                                >
                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex items-center gap-2 min-w-0">
                                            {post.board_name && (
                                                <span className="shrink-0 text-[11px] px-1.5 py-0.5 rounded bg-surface-tertiary text-yellow-400">
                                                    {post.board_name}
                                                </span>
                                            )}
                                            <h3 className="font-medium text-[15px] text-gray-200 truncate">{post.title}</h3>
                                            {post.comment_count > 0 && (
                                                <span className="text-[11px] font-medium text-bamboo-400 tabular-nums shrink-0">[{post.comment_count}]</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <span className="tabular-nums">{formatDate(post.created_at)}</span>
                                            <span className="w-0.5 h-0.5 bg-gray-700 rounded-full" />
                                            <span className="tabular-nums">조회 {post.view_count}</span>
                                            {post.like_count > 0 && (
                                                <>
                                                    <span className="w-0.5 h-0.5 bg-gray-700 rounded-full" />
                                                    <span className="text-pink-400 tabular-nums">좋아요 {post.like_count}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
