'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { posts, PostListItem } from '@/lib/api';
import { useState, useEffect } from 'react';
import { formatDate } from '@/lib/utils';
import AdBanner from '@/components/AdBanner';

function LeftSidebar() {
    const pathname = usePathname();
    const { user } = useAuth();

    const links = [
        {
            href: '/me?tab=posts',
            label: '내가 쓴 글',
            icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
            ),
        },
        {
            href: '/me?tab=comments',
            label: '내가 쓴 댓글',
            icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
                </svg>
            ),
        },
        {
            href: '/me?tab=scraps',
            label: '스크랩',
            icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                </svg>
            ),
        },
        {
            href: '/me',
            label: '마이페이지',
            icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
            ),
        },
        {
            href: '/board-manage',
            label: '게시판 관리',
            icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            ),
        },
        {
            href: '/cons',
            label: '밤부콘 스토어',
            icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
                </svg>
            ),
        },
    ];

    return (
        <aside className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-20">
                <div className="card p-3">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mb-2">바로가기</h3>
                    <nav className="flex flex-col gap-0.5">
                        {links.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${pathname === link.href
                                    ? 'bg-bamboo-500/10 text-bamboo-400 font-medium'
                                    : 'text-gray-400 hover:text-gray-200 hover:bg-surface-hover'
                                    }`}
                            >
                                {link.icon}
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                </div>

                {/* User info card */}
                {user && (
                    <div className="card p-4 mt-3">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-bamboo-500/15 border border-bamboo-500/25 flex items-center justify-center">
                                <span className="text-sm font-semibold text-bamboo-400">
                                    {(user.school_name || user.personal_email || '?')[0].toUpperCase()}
                                </span>
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-200 truncate">
                                    {user.nickname || user.personal_email}
                                </p>
                                {user.school_name && (
                                    <p className="text-xs text-gray-500 truncate">{user.school_name}</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* PC 왼쪽 사이드바 광고 */}
                <AdBanner variant="sidebar" className="mt-4" />
            </div>
        </aside>
    );
}

function RightSidebar() {
    const { token } = useAuth();
    const [hotPosts, setHotPosts] = useState<PostListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (token) {
            posts.hot(token, 8).then(data => {
                setHotPosts(data.posts);
                setIsLoading(false);
            }).catch(() => setIsLoading(false));
        }
    }, [token]);

    return (
        <aside className="hidden xl:block w-72 shrink-0">
            <div className="sticky top-20">
                <div className="card overflow-hidden">
                    <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                        <svg className="w-4 h-4 text-orange-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12.01 2C6.49 2 2 6.49 2 12.01c0 5.51 4.49 10.01 10.01 10.01S22.02 17.52 22.02 12.01C22.02 6.49 17.52 2 12.01 2zm3.53 14.25l-4.04-2.43-4.04 2.43 1.08-4.58-3.57-3.09 4.68-.41L12.01 4l1.86 4.17 4.68.41-3.57 3.09 1.06 4.58z" />
                        </svg>
                        <h3 className="text-sm font-semibold text-gray-200">인기 게시글</h3>
                        <span className="text-[10px] text-gray-500 ml-auto">최근 7일</span>
                    </div>
                    {isLoading ? (
                        <div className="p-4 space-y-3">
                            {[1, 2, 3].map(i => (
                                <div key={i}>
                                    <div className="skeleton h-3 w-full mb-1.5" />
                                    <div className="skeleton h-2.5 w-20" />
                                </div>
                            ))}
                        </div>
                    ) : hotPosts.length === 0 ? (
                        <div className="p-6 text-center">
                            <p className="text-xs text-gray-600">아직 인기 게시글이 없습니다</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {hotPosts.map((post, i) => (
                                <Link
                                    key={post.id}
                                    href={`/boards/${post.board_id}/posts/${post.id}`}
                                    className="block px-4 py-2.5 hover:bg-surface-hover transition-colors"
                                >
                                    <div className="flex items-start gap-2.5">
                                        <span className="text-xs font-bold text-gray-600 tabular-nums mt-0.5 shrink-0 w-4 text-center">
                                            {i + 1}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[13px] text-gray-200 truncate leading-snug">{post.title}</p>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                {post.board_name && (
                                                    <span className="text-[10px] text-gray-500 truncate">{post.board_name}</span>
                                                )}
                                                <span className="text-[10px] text-gray-600">·</span>
                                                <span className="text-[10px] text-pink-400/80 flex items-center gap-0.5 shrink-0">
                                                    <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                                                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                                                    </svg>
                                                    {post.like_count}
                                                </span>
                                                {post.comment_count > 0 && (
                                                    <>
                                                        <span className="text-[10px] text-gray-600">·</span>
                                                        <span className="text-[10px] text-bamboo-400/80 shrink-0">
                                                            💬 {post.comment_count}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* PC 오른쪽 사이드바 광고 */}
                <AdBanner variant="sidebar" className="mt-4" />
            </div>
        </aside>
    );
}

export default function BoardsLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="w-full max-w-[1600px] mx-auto px-4 py-6 flex gap-6">
            <LeftSidebar />
            <div className="flex-1 min-w-0">
                {children}
            </div>
            <RightSidebar />
        </div>
    );
}
