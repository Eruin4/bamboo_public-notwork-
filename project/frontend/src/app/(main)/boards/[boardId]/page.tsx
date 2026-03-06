'use client';

import { useAuth } from '@/lib/auth-context';
import { boards, posts, BoardResponse, PostListItem, PostListResponse } from '@/lib/api';
import React, { useState, use } from 'react';
import Link from 'next/link';
import { formatDate, formatAuthor } from '@/lib/utils';
import { useSWRFetch } from '@/hooks/use-swr-fetch';
import AdBanner from '@/components/AdBanner';

export default function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const resolvedParams = use(params);
  const { token } = useAuth();
  const [selectedHeading, setSelectedHeading] = useState<number | null>(null);
  const [isHotOnly, setIsHotOnly] = useState(false);
  const [isNoticeOnly, setIsNoticeOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');   // 입력 중인 텍스트
  const [searchQuery, setSearchQuery] = useState('');   // 실제 프리쫐 텐 검색어

  const boardId = parseInt(resolvedParams.boardId);

  // SWR: board info (rarely changes, long cache)
  const { data: board, isLoading: boardLoading } = useSWRFetch<BoardResponse>(
    token && boardId ? `board:${boardId}` : null,
    () => boards.get(boardId, token!),
  );

  // SWR: post list (keyed by heading + hot + notice + page for automatic refetch)
  const postsKey = token && boardId
    ? `posts:${boardId}:${selectedHeading ?? 'all'}:${isHotOnly ? 'hot' : 'all'}:${isNoticeOnly ? 'notice' : 'normal'}:${searchQuery ? encodeURIComponent(searchQuery) : ''}:${page}`
    : null;

  const { data: postsData, isLoading: postsLoading } = useSWRFetch<PostListResponse>(
    postsKey,
    () => {
      const listParams: { page: number; heading_id?: number; hot?: boolean; notice?: boolean; q?: string } = { page };
      if (selectedHeading !== null) listParams.heading_id = selectedHeading;
      if (isHotOnly) listParams.hot = true;
      if (isNoticeOnly) listParams.notice = true;
      if (searchQuery) listParams.q = searchQuery;
      return posts.list(boardId, token!, listParams);
    },
  );

  const postList = postsData?.posts ?? [];
  const totalPages = postsData?.total_pages ?? 1;
  const isLoading = boardLoading || postsLoading;

  if (boardLoading && !board) {
    return (
      <div className="py-2">
        <div className="skeleton h-8 w-48 mb-3" />
        <div className="skeleton h-4 w-72 mb-8" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card p-4">
              <div className="skeleton h-4 w-48 mb-3" />
              <div className="skeleton h-3 w-32" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="py-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-surface-secondary border border-border flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-gray-500 text-sm">게시판을 찾을 수 없습니다</p>
        <Link href="/boards" className="btn btn-secondary btn-sm mt-4 inline-flex">
          목록으로
        </Link>
      </div>
    );
  }

  return (
    <div className="py-2">
      <div className="min-w-0">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/boards"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-bamboo-400 transition-colors mb-4"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            게시판 목록
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-100">{board.name}</h1>
              {board.description && (
                <p className="text-sm text-gray-500 mt-1">{board.description}</p>
              )}
            </div>
            <Link href={`/boards/${boardId}/write`} className="btn btn-primary btn-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              글쓰기
            </Link>
          </div>
        </div>

        {/* Control Bar: View Type & Headings Filter */}
        <div className="flex flex-col gap-3 mb-3 pb-3 border-b border-border">
          {/* 탭 행 */}
          <div className="flex items-center gap-3">
            <div className="flex bg-surface-secondary border border-border rounded-lg p-1 w-fit shrink-0">
              <button
                onClick={() => { setSelectedHeading(null); setIsHotOnly(false); setIsNoticeOnly(false); setPage(1); }}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${selectedHeading === null && !isHotOnly && !isNoticeOnly
                  ? 'bg-surface-elevated text-gray-200 shadow-sm border border-border'
                  : 'text-gray-400 hover:text-gray-200 border border-transparent'
                  }`}
              >
                전체글
              </button>
              <button
                onClick={() => { setSelectedHeading(null); setIsHotOnly(true); setIsNoticeOnly(false); setPage(1); }}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${isHotOnly
                  ? 'bg-surface-elevated text-red-400 shadow-sm border border-border'
                  : 'text-gray-400 hover:text-gray-200 border border-transparent'
                  }`}
              >
                인기글
              </button>
              <button
                onClick={() => { setSelectedHeading(null); setIsHotOnly(false); setIsNoticeOnly(true); setPage(1); }}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${isNoticeOnly
                  ? 'bg-surface-elevated text-purple-400 shadow-sm border border-border'
                  : 'text-gray-400 hover:text-gray-200 border border-transparent'
                  }`}
              >
                공지
              </button>
            </div>

            {/* PC 전용: 탭 옆 검색창 */}
            <form
              onSubmit={(e) => { e.preventDefault(); setSearchQuery(searchInput.trim()); setPage(1); }}
              className="hidden sm:flex items-center gap-1.5 ml-auto"
            >
              <div className="relative">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') { setSearchInput(''); setSearchQuery(''); setPage(1); } }}
                  placeholder="제목·내용 검색"
                  className="w-48 h-8 pl-8 pr-3 text-xs bg-surface-secondary border border-border rounded-lg text-gray-300 placeholder-gray-600 focus:outline-none focus:border-bamboo-500/60 focus:ring-1 focus:ring-bamboo-500/30 transition-all"
                />
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                {searchQuery && (
                  <button type="button" onClick={() => { setSearchInput(''); setSearchQuery(''); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
              <button type="submit" className="btn btn-secondary btn-sm text-xs px-2.5 h-8">검색</button>
            </form>
          </div>

          {/* 모바일 전용: 검색창 전체 너비 한 줄 */}
          <form
            onSubmit={(e) => { e.preventDefault(); setSearchQuery(searchInput.trim()); setPage(1); }}
            className="flex sm:hidden items-center gap-2"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { setSearchInput(''); setSearchQuery(''); setPage(1); } }}
                placeholder="제목·내용 검색"
                className="w-full h-9 pl-9 pr-8 text-sm bg-surface-secondary border border-border rounded-lg text-gray-300 placeholder-gray-600 focus:outline-none focus:border-bamboo-500/60 focus:ring-1 focus:ring-bamboo-500/30 transition-all"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              {searchQuery && (
                <button type="button" onClick={() => { setSearchInput(''); setSearchQuery(''); setPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
            <button type="submit" className="btn btn-secondary btn-sm text-sm px-3 h-9 shrink-0">검색</button>
          </form>

          {/* 검색 중일 때 결과 표시 */}
          {searchQuery && (
            <p className="text-xs text-gray-500">
              <span className="text-bamboo-400 font-medium">"{searchQuery}"</span> 검색 결과
              {!isLoading && <span className="ml-1">— {postsData?.total ?? 0}건</span>}
            </p>
          )}

          {/* 글머리 필터 (검색 중 아닐 때만) */}
          {!searchQuery && (!isHotOnly && !isNoticeOnly) && board.headings.length > 0 && (
            <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-hide whitespace-nowrap sm:flex-wrap">
              <button
                onClick={() => { setSelectedHeading(null); setPage(1); }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${selectedHeading === null
                  ? 'bg-bamboo-500 text-white shadow-glow'
                  : 'bg-surface-secondary text-gray-400 border border-border hover:border-border-light hover:text-gray-300'
                  }`}
              >
                전체
              </button>
              {board.headings.map(heading => (
                <button
                  key={heading.id}
                  onClick={() => { setSelectedHeading(heading.id); setPage(1); }}
                  className="px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200"
                  style={{
                    backgroundColor: selectedHeading === heading.id ? heading.color : `${heading.color}15`,
                    color: selectedHeading === heading.id ? 'white' : heading.color,
                    border: selectedHeading === heading.id ? `1px solid ${heading.color}` : `1px solid ${heading.color}30`,
                    boxShadow: selectedHeading === heading.id ? `0 0 12px ${heading.color}30` : 'none',
                  }}
                >
                  {heading.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Posts List */}
        <div className="rounded-xl overflow-hidden border border-border bg-surface-card divide-y divide-border">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="spinner" />
            </div>
          ) : postList.length === 0 ? (
            <div className="text-center py-16 bg-surface">
              <div className="w-14 h-14 rounded-2xl bg-surface-secondary border border-border flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm">아직 게시글이 없습니다</p>
              <Link href={`/boards/${boardId}/write`} className="btn btn-primary btn-sm mt-4 inline-flex">
                첫 글을 작성해보세요
              </Link>
            </div>
          ) : (
            <>
              {/* PC 버전 리스트 헤더 */}
              <div className="hidden sm:flex items-center text-xs font-medium text-gray-500 bg-surface px-4 py-2 border-b border-border">
                <div className="w-20 shrink-0 text-center">말머리</div>
                <div className="flex-1 text-center">제목</div>
                <div className="w-28 shrink-0 text-center">글쓴이</div>
                <div className="w-20 shrink-0 text-center">작성일</div>
                <div className="w-16 shrink-0 text-center">조회</div>
                <div className="w-16 shrink-0 text-center">추천</div>
              </div>

              {postList.map((post, i) => (
                <React.Fragment key={post.id}>
                  <PostItem
                    key={post.id}
                    post={post}
                    boardId={boardId}
                    threshold={board.hot_post_threshold}
                    delay={0.05 + i * 0.02}
                  />
                  {/* 5개마다 피드 광고 삽입 */}
                  {(i + 1) % 5 === 0 && i < postList.length - 1 && (
                    <div key={`ad-${i}`} className="px-4 py-2 bg-surface">
                      <AdBanner variant="feed" />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn btn-secondary btn-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="px-4 py-1.5 text-sm text-gray-400 tabular-nums">
              <span className="text-gray-200 font-medium">{page}</span>
              <span className="mx-1.5 text-gray-600">/</span>
              {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn btn-secondary btn-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div >
  );
}
function PostItem({ post, boardId, threshold, delay }: { post: PostListItem; boardId: number; threshold: number; delay: number }) {
  return (
    <Link
      href={`/boards/${boardId}/posts/${post.id}`}
      className="block px-4 py-2.5 sm:py-2.5 hover:bg-surface-hover transition-colors duration-200"
    >
      {/* 모바일 레이아웃 (PC에서 숨김) */}
      <div className="flex sm:hidden flex-col gap-1.5">
        {/* Row 1: Badges & Title */}
        <div className="flex items-center gap-2 min-w-0">
          {(post.is_notice || post.is_pinned) && (
            <span className="shrink-0 text-[11px] font-bold text-bamboo-400 bg-bamboo-500/10 px-1.5 py-0.5 rounded">
              {post.is_notice ? '공지' : '고정'}
            </span>
          )}
          {post.heading_name && (
            <span
              className="shrink-0 text-[11px] px-1.5 py-0.5 rounded bg-surface-tertiary"
              style={{ color: post.heading_color || '#9CA3AF' }}
            >
              {post.heading_name}
            </span>
          )}
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <h3 className="font-medium text-[14px] text-gray-200 truncate leading-snug">
              {post.title}
            </h3>
            {post.comment_count > 0 && (
              <span className="text-[11px] font-medium text-gray-500 tabular-nums shrink-0">
                [{post.comment_count}]
              </span>
            )}
          </div>
          {post.has_attachment && (
            <svg className="w-3.5 h-3.5 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
            </svg>
          )}
          {post.like_count >= threshold && (
            <span className="shrink-0 text-base leading-none" title="인기글">⭐</span>
          )}
        </div>

        {/* Row 2: Meta */}
        <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
          <span className="truncate max-w-[120px] text-gray-400 font-medium">
            {formatAuthor(post.author.anon_number, post.author.school_name, false, post.author.nickname)}
          </span>
          <span className="w-0.5 h-0.5 bg-gray-700 rounded-full" />
          <span className="tabular-nums">{formatDate(post.created_at)}</span>
          <span className="w-0.5 h-0.5 bg-gray-700 rounded-full" />
          <span className="tabular-nums">조회 {post.view_count}</span>
          {post.like_count > 0 && (
            <>
              <span className="w-0.5 h-0.5 bg-gray-700 rounded-full" />
              <span className="text-bamboo-400 font-bold tabular-nums text-[11px]">추천 {post.like_count}</span>
            </>
          )}
        </div>
      </div>

      {/* PC 레이아웃 한줄 (모바일에서 숨김) */}
      <div className="hidden sm:flex items-center text-sm">
        {/* 첨부파일 아이콘 */}
        <div className="w-8 shrink-0 flex justify-center items-center">
          {post.has_attachment && (
            <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
            </svg>
          )}
        </div>

        {/* 말머리 */}
        <div className="w-20 shrink-0 flex justify-center items-center px-1">
          {(post.is_notice || post.is_pinned) ? (
            <span className="text-[11px] font-bold text-bamboo-400 bg-bamboo-500/10 px-1.5 py-0.5 rounded">
              {post.is_notice ? '공지' : '고정'}
            </span>
          ) : post.heading_name ? (
            <span
              className="text-[11px] px-1.5 py-0.5 rounded bg-surface-tertiary truncate max-w-[4.5rem]"
              style={{ color: post.heading_color || '#9CA3AF' }}
              title={post.heading_name}
            >
              {post.heading_name}
            </span>
          ) : (
            <span className="text-gray-600 text-[11px]">-</span>
          )}
        </div>

        {/* 제목 */}
        <div className="flex-1 min-w-0 flex items-center gap-2 px-2">
          <span className={`font-medium text-[14px] truncate ${post.is_notice ? 'text-bamboo-300' : 'text-gray-200'}`}>
            {post.title}
          </span>
          {post.comment_count > 0 && (
            <span className="text-[11px] font-medium text-gray-500 tabular-nums shrink-0">
              [{post.comment_count}]
            </span>
          )}
          {post.like_count >= threshold && (
            <span className="shrink-0 text-[13px] leading-none text-[#ffd500]" title="인기글">⭐</span>
          )}
        </div>

        {/* 글쓴이 */}
        <div className="w-28 shrink-0 text-center text-gray-400 text-xs truncate px-2 font-medium">
          {formatAuthor(post.author.anon_number, post.author.school_name, false, post.author.nickname)}
        </div>

        {/* 작성일 */}
        <div className="w-20 shrink-0 text-center text-gray-500 text-xs tabular-nums truncate">
          {formatDate(post.created_at, { hideYear: true })}
        </div>

        {/* 조회 */}
        <div className="w-16 shrink-0 text-center text-gray-500 text-xs tabular-nums truncate">
          {post.view_count > 0 ? post.view_count : '-'}
        </div>

        {/* 추천 */}
        <div className="w-16 shrink-0 text-center text-xs tabular-nums truncate">
          {post.like_count > 0 ? <span className="text-bamboo-400 font-bold">{post.like_count}</span> : <span className="text-gray-600">-</span>}
        </div>
      </div>
    </Link>
  );
}
