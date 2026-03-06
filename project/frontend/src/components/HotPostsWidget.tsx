'use client';

import { useAuth } from '@/lib/auth-context';
import { posts, PostListResponse } from '@/lib/api';
import Link from 'next/link';
import { useSWRFetch } from '@/hooks/use-swr-fetch';

export default function HotPostsWidget() {
    const { token } = useAuth();

    const { data, isLoading } = useSWRFetch<PostListResponse>(
        token ? 'posts:hot:global' : null,
        () => posts.hot(token!, 5),
    );

    const hotPosts = data?.posts ?? [];

    if (isLoading) {
        return (
            <div className="card p-4">
                <h2 className="text-sm font-bold text-gray-100 flex items-center gap-1.5 mb-3">
                    🔥
                    인기 게시글
                </h2>
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="animate-pulse flex flex-col gap-2">
                            <div className="h-4 bg-surface-secondary rounded w-3/4"></div>
                            <div className="h-3 bg-surface-secondary rounded w-1/2"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (hotPosts.length === 0) {
        return null; // hide widget if no hot posts
    }

    return (
        <div className="card p-4">
            <h2 className="text-sm font-bold text-gray-100 flex items-center gap-1.5 mb-3">
                <span className="text-red-500">🔥</span>
                인기 게시글
            </h2>
            <div className="space-y-3">
                {hotPosts.map(post => (
                    <Link
                        key={post.id}
                        href={`/boards/${post.board_id}/posts/${post.id}`}
                        className="block group"
                    >
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-gray-500 bg-surface-tertiary px-1 rounded truncate max-w-[80px]">
                                    {post.board_name}
                                </span>
                                <p className="text-[13px] font-medium text-gray-200 group-hover:text-bamboo-400 transition-colors truncate">
                                    {post.title}
                                </p>
                                {post.comment_count > 0 && (
                                    <span className="text-[10px] text-bamboo-400 font-medium tabular-nums ml-auto shrink-0">
                                        [{post.comment_count}]
                                    </span>
                                )}
                            </div>
                            <div className="flex justify-between items-center text-[11px] text-gray-500">
                                <span className="truncate">
                                    {post.author.nickname || post.author.school_name || `익명`}
                                </span>
                                <span className="text-pink-400 flex items-center gap-0.5">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                                    </svg>
                                    {post.like_count}
                                </span>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
