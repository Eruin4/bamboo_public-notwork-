'use client';

import { useAuth } from '@/lib/auth-context';
import { posts, comments, reports, PostResponse, CommentResponse, ApiError } from '@/lib/api';
import { useState, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDate, formatAuthor, formatFileSize } from '@/lib/utils';
import { useSWRFetch } from '@/hooks/use-swr-fetch';
import BodyRenderer from '@/components/BodyRenderer';
import ConPicker from '@/components/ConPicker';

export default function PostPage({ params }: { params: Promise<{ boardId: string; postId: string }> }) {
  const resolvedParams = use(params);
  const { token, user } = useAuth();
  const router = useRouter();

  const [newComment, setNewComment] = useState('');
  const commentBodyRef = useRef<HTMLTextAreaElement>(null);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [useNickname, setUseNickname] = useState(false);
  const [error, setError] = useState('');

  const boardId = parseInt(resolvedParams.boardId);
  const postId = parseInt(resolvedParams.postId);

  // SWR: post data
  const { data: post, isLoading: postLoading, mutate: mutatePost } = useSWRFetch<PostResponse>(
    token && postId ? `post:${postId}` : null,
    () => posts.get(postId, token!),
    { dedupingInterval: 30_000 }, // 30s dedup for post detail (more dynamic)
  );

  // SWR: comments
  const { data: commentsData, isLoading: commentsLoading, mutate: mutateComments } = useSWRFetch<{ comments: CommentResponse[]; total: number }>(
    token && postId ? `comments:${postId}` : null,
    () => comments.list(postId, token!),
    { dedupingInterval: 30_000 },
  );

  const commentList = commentsData?.comments ?? [];
  const isLoading = postLoading || commentsLoading;

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newComment.trim()) return;

    setError('');
    setIsSubmitting(true);

    try {
      await comments.create(postId, newComment, replyTo, token, useNickname || undefined);
      setNewComment('');
      setReplyTo(null);
      setUseNickname(false);
      // Revalidate both post (for comment_count) and comments
      await Promise.all([mutatePost(), mutateComments()]);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('댓글 작성 중 오류가 발생했습니다');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReport = async (targetType: 'POST' | 'COMMENT', targetId: number) => {
    if (!token) return;
    const reason = prompt('신고 사유를 입력해주세요 (선택사항):');
    if (reason === null) return;

    try {
      await reports.create(targetType, targetId, reason || '', null, token);
      alert('신고가 접수되었습니다');
    } catch (err) {
      if (err instanceof ApiError) {
        alert(err.message);
      }
    }
  };

  const handlePostVote = async (voteType: 'LIKE' | 'DISLIKE') => {
    if (!token || !post) return;
    try {
      const result = await posts.vote(post.id, voteType, token);
      // Optimistic-ish update via mutate
      mutatePost((prev: PostResponse | undefined) => prev ? { ...prev, like_count: result.like_count, dislike_count: result.dislike_count, my_vote: result.my_vote } : prev, false);
    } catch (err) {
      if (err instanceof ApiError) {
        alert(err.message);
      }
    }
  };

  const handleCommentVote = async (commentId: number, voteType: 'LIKE' | 'DISLIKE') => {
    if (!token) return;
    try {
      const result = await comments.vote(commentId, voteType, token);
      // Update comment tree in place
      const updateVoteInTree = (items: CommentResponse[]): CommentResponse[] =>
        items.map(c => ({
          ...c,
          like_count: c.id === commentId ? result.like_count : c.like_count,
          dislike_count: c.id === commentId ? result.dislike_count : c.dislike_count,
          my_vote: c.id === commentId ? result.my_vote : c.my_vote,
          replies: updateVoteInTree(c.replies),
        }));
      mutateComments((prev: { comments: CommentResponse[]; total: number } | undefined) => prev ? { ...prev, comments: updateVoteInTree(prev.comments) } : prev, false);
    } catch (err) {
      if (err instanceof ApiError) {
        alert(err.message);
      }
    }
  };

  const handleCommentDelete = async (commentId: number) => {
    if (!token) return;
    if (!confirm('이 댓글을 삭제하시겠습니까?')) return;
    try {
      await comments.delete(commentId, token);
      await Promise.all([mutatePost(), mutateComments()]);
    } catch (err) {
      if (err instanceof ApiError) {
        alert(err.message);
      }
    }
  };

  const handleDelete = async () => {
    if (!token || !post) return;
    if (!confirm('정말 이 게시글을 삭제하시겠습니까?')) return;

    try {
      await posts.delete(post.id, token);
      alert('게시글이 삭제되었습니다.');
      router.push(`/boards/${boardId}`);
    } catch (err) {
      if (err instanceof ApiError) {
        alert(err.message);
      } else {
        alert('게시글 삭제 중 오류가 발생했습니다.');
      }
    }
  };

  const handleScrap = async () => {
    if (!token || !post) return;
    try {
      await posts.scrap(post.id, token);
      mutatePost((prev: PostResponse | undefined) => prev ? { ...prev, my_scrap: !prev.my_scrap } : prev, false);
    } catch (err) {
      if (err instanceof ApiError) {
        alert(err.message);
      }
    }
  };

  if (isLoading && !post) {
    return (
      <div className="py-2 max-w-4xl mx-auto">
        <div className="skeleton h-4 w-20 mb-6" />
        <div className="card p-6">
          <div className="skeleton h-6 w-64 mb-4" />
          <div className="skeleton h-3 w-40 mb-8" />
          <div className="space-y-3">
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-4/5" />
            <div className="skeleton h-3 w-3/5" />
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="py-8 text-center max-w-4xl mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-surface-secondary border border-border flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-gray-500 text-sm">게시글을 찾을 수 없습니다</p>
        <Link href={`/boards/${boardId}`} className="btn btn-secondary btn-sm mt-4 inline-flex">
          목록으로
        </Link>
      </div>
    );
  }

  return (
    <div className="py-2 max-w-4xl mx-auto">
      {/* Back Link */}
      <Link
        href={`/boards/${boardId}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-bamboo-400 transition-colors mb-5"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        목록으로
      </Link>

      {/* Post */}
      <article className="card">
        <div className="p-6">
          {/* Header */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {(post.is_notice || post.is_pinned) && (
                <span className="badge badge-green text-[10px]">
                  {post.is_notice ? '📌 공지' : '📌 고정'}
                </span>
              )}
              {post.heading_name && (
                <span
                  className="text-[11px] font-medium px-2 py-0.5 rounded-md"
                  style={{ backgroundColor: `${post.heading_color}15`, color: post.heading_color ?? undefined }}
                >
                  {post.heading_name}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-gray-100 leading-snug">{post.title}</h1>
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${post.author.is_author
                    ? 'bg-bamboo-500/15 text-bamboo-400'
                    : 'bg-surface-tertiary text-gray-500'
                    }`}>
                    {post.author.nickname ? post.author.nickname.charAt(0) : (post.author.anon_number ?? '?')}
                  </div>
                  <span className={post.author.is_author ? 'text-bamboo-400 font-medium text-sm' : 'text-gray-400 text-sm'}>
                    {formatAuthor(post.author.anon_number, post.author.school_name, post.author.is_author, post.author.nickname)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>{formatDate(post.created_at)}</span>
                <span className="inline-flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {post.view_count}
                </span>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="divider" />
          <div className="post-body py-6">
            <BodyRenderer text={post.body} />
          </div>

          {/* Attached Files */}
          {post.files.length > 0 && (() => {
            const imageFiles = post.files.filter(f => f.mime_type.startsWith('image/'));
            const otherFiles = post.files.filter(f => !f.mime_type.startsWith('image/'));
            return (
              <>
                {/* Images - displayed inline */}
                {imageFiles.length > 0 && (
                  <>
                    <div className="divider" />
                    <div className="space-y-3 py-5">
                      {imageFiles.map(file => (
                        <img
                          key={file.id}
                          src={`/uploads/${file.storage_key}`}
                          alt={file.original_name}
                          className="max-w-full rounded-xl border border-border"
                          loading="lazy"
                        />
                      ))}
                    </div>
                  </>
                )}

                {/* Non-image files - displayed as download links */}
                {otherFiles.length > 0 && (
                  <>
                    <div className="divider" />
                    <div className="py-4">
                      <h3 className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                        </svg>
                        첨부파일 {otherFiles.length}개
                      </h3>
                      <div className="space-y-2">
                        {otherFiles.map(file => (
                          <a
                            key={file.id}
                            href={`/uploads/${file.storage_key}`}
                            download={file.original_name}
                            className="flex items-center gap-3 bg-surface-secondary hover:bg-surface-tertiary rounded-lg px-4 py-3 border border-border hover:border-border-light transition-colors group"
                          >
                            <div className="w-9 h-9 rounded-lg bg-surface-tertiary border border-border flex items-center justify-center text-gray-400 group-hover:text-bamboo-400 transition-colors shrink-0">
                              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-200 truncate group-hover:text-bamboo-400 transition-colors">
                                {file.original_name}
                              </p>
                              <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                            </div>
                            <svg className="w-4 h-4 text-gray-500 group-hover:text-bamboo-400 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                          </a>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            );
          })()}

          {/* Vote + Actions */}
          <div className="pt-4 pb-2">
            <div className="flex items-center justify-center gap-4 sm:gap-6 mb-5">
              {/* Like Count */}
              <div className="flex flex-col items-center justify-center min-w-[2.5rem]">
                <span className={`text-2xl font-bold ${post.like_count > 0 ? 'text-bamboo-400' : 'text-gray-400'}`}>
                  {post.like_count}
                </span>
              </div>

              {/* Like Button */}
              <button
                onClick={() => handlePostVote('LIKE')}
                className={`w-[56px] h-[56px] sm:w-[64px] sm:h-[64px] rounded-full flex flex-col items-center justify-center gap-0.5 transition-all shadow-sm ${post.my_vote === 'LIKE'
                  ? 'bg-bamboo-500/15 border border-bamboo-500/30 text-bamboo-400'
                  : 'bg-surface-secondary border border-border text-gray-400 hover:text-bamboo-400 hover:border-bamboo-500/30 hover:bg-surface-tertiary'
                  }`}
              >
                <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                </svg>
                <span className="text-[10px] sm:text-[11px] font-medium tracking-wide">추천</span>
              </button>

              {/* Dislike Button */}
              <button
                onClick={() => handlePostVote('DISLIKE')}
                className={`w-[56px] h-[56px] sm:w-[64px] sm:h-[64px] rounded-full flex flex-col items-center justify-center gap-0.5 transition-all shadow-sm ${post.my_vote === 'DISLIKE'
                  ? 'bg-red-500/15 border border-red-500/30 text-red-400'
                  : 'bg-surface-secondary border border-border text-gray-400 hover:text-red-400 hover:border-red-500/30 hover:bg-surface-tertiary'
                  }`}
              >
                <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
                </svg>
                <span className="text-[10px] sm:text-[11px] font-medium tracking-wide">비추</span>
              </button>

              {/* Dislike Count */}
              <div className="flex flex-col items-center justify-center min-w-[2.5rem]">
                <span className="text-2xl font-bold text-gray-400">{post.dislike_count}</span>
              </div>
            </div>

            {/* Other Actions Bottom Bar */}
            <div className="flex items-center border border-border rounded-lg bg-surface-secondary py-1 w-full mt-2">
              <button onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                alert('게시글 주소가 복사되었습니다.');
              }} className="flex-1 flex justify-center items-center gap-2 text-sm text-gray-500 hover:text-gray-300 py-2 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                </svg>
                공유
              </button>

              <div className="w-px h-4 bg-border" />

              <button onClick={handleScrap} className={`flex-1 flex justify-center items-center gap-2 text-sm py-2 transition-colors ${post.my_scrap ? 'text-bamboo-400' : 'text-gray-500 hover:text-gray-300'}`}>
                <svg className="w-4 h-4" fill={post.my_scrap ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                </svg>
                스크랩
              </button>

              <div className="w-px h-4 bg-border" />

              <button onClick={() => handleReport('POST', post.id)} className="flex-1 flex justify-center items-center gap-2 text-sm text-gray-500 hover:text-red-400 py-2 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
                </svg>
                신고
              </button>

              {(post.author.is_author || user?.role === 'ADMIN' || post.is_manager) && (
                <>
                  <div className="w-px h-4 bg-border" />
                  <button onClick={handleDelete} className="flex-1 flex justify-center items-center gap-2 text-sm text-gray-500 hover:text-red-400 py-2 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                    삭제
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </article>

      {/* Comments Section */}
      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-4">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
          </svg>
          댓글 {post.comment_count}개
        </h2>

        {/* Comment Form */}
        <form onSubmit={handleSubmitComment} className="card p-4 mb-5 overflow-visible">
          {error && (
            <div className="alert alert-error mb-3 text-sm">{error}</div>
          )}
          {replyTo && (
            <div className="mb-3 flex items-center gap-2 text-xs text-gray-400 bg-surface-secondary rounded-lg px-3 py-2">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
              </svg>
              <span>답글 작성 중</span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="ml-auto text-bamboo-400 hover:text-bamboo-300 font-medium"
              >
                취소
              </button>
            </div>
          )}
          <textarea
            ref={commentBodyRef}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="input min-h-[80px] resize-none text-sm"
            placeholder="댓글을 입력하세요..."
            maxLength={2000}
          />
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              {/* 콘 피커 */}
              <ConPicker
                onSelect={(tag) => {
                  const el = commentBodyRef.current;
                  if (!el) { setNewComment(prev => prev + tag); return; }
                  const start = el.selectionStart ?? newComment.length;
                  const end = el.selectionEnd ?? newComment.length;
                  setNewComment(newComment.slice(0, start) + tag + newComment.slice(end));
                  setTimeout(() => { el.focus(); el.setSelectionRange(start + tag.length, start + tag.length); }, 0);
                }}
              />
              <span className="text-xs text-gray-600">{newComment.length}/2000</span>
              {user?.nickname && (
                <label className="inline-flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={useNickname}
                    onChange={(e) => setUseNickname(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-7 h-4 bg-surface-tertiary border border-border rounded-full peer peer-checked:bg-bamboo-500 peer-checked:border-bamboo-500 transition-colors relative after:content-[''] after:absolute after:top-[1px] after:start-[1px] after:bg-gray-300 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-3 peer-checked:after:bg-white" />
                  <span className="text-gray-400">
                    {useNickname ? `${user.nickname} (닉네임)` : '익명'}
                  </span>
                </label>
              )}
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !newComment.trim()}
              className="btn btn-primary btn-sm"
            >
              {isSubmitting ? <div className="spinner spinner-sm" /> : '작성'}
            </button>
          </div>
        </form>

        {/* Comments List */}
        <div className="card divide-y divide-border overflow-hidden">
          {commentList.map(comment => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onReply={(id) => setReplyTo(id)}
              onReport={(id) => handleReport('COMMENT', id)}
              onDelete={handleCommentDelete}
              onVote={handleCommentVote}
              currentUserId={user?.id}
            />
          ))}
          {commentList.length === 0 && (
            <div className="text-center py-10 text-gray-600 text-sm">
              아직 댓글이 없습니다
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function CommentItem({
  comment,
  onReply,
  onReport,
  onDelete,
  onVote,
  depth = 0,
  currentUserId,
}: {
  comment: CommentResponse;
  onReply: (id: number) => void;
  onReport: (id: number) => void;
  onDelete: (id: number) => void;
  onVote: (commentId: number, voteType: 'LIKE' | 'DISLIKE') => void;
  depth?: number;
  currentUserId?: number;
}) {
  if (comment.is_deleted) {
    return (
      <>
        <div className={`px-4 py-3 opacity-50 ${depth > 0 ? 'pl-10 border-l-2 border-l-gray-700 bg-white/[0.02]' : ''}`}>
          <p className="text-gray-600 text-[13px] italic">삭제된 댓글입니다</p>
        </div>
        {comment.replies?.map(reply => (
          <CommentItem
            key={reply.id}
            comment={reply}
            onReply={onReply}
            onReport={onReport}
            onDelete={onDelete}
            onVote={onVote}
            depth={1}
            currentUserId={currentUserId}
          />
        ))}
      </>
    );
  }

  return (
    <>
      <div
        onClick={() => onReply(comment.id)}
        className={`relative px-4 py-3 pr-12 cursor-pointer hover:bg-surface-hover transition-colors ${depth > 0 ? 'pl-10 border-l-2 border-l-gray-700 bg-white/[0.02]' : ''}`}
      >
        {/* 신고/삭제 버튼 - absolute 분리 (레이아웃 영향 없음) */}
        <div className="absolute top-3 right-4 flex flex-col items-end">
          <button
            onClick={(e) => { e.stopPropagation(); onReport(comment.id); }}
            className="text-gray-500 text-[11px] font-medium hover:text-red-400 px-1"
            title="신고"
          >
            신고
          </button>
          {comment.can_delete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(comment.id); }}
              className="text-gray-500 text-[11px] font-medium hover:text-red-400 px-1 mt-2"
              title="삭제"
            >
              삭제
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
          {depth > 0 && (
            <svg className="w-3 h-3 text-gray-600 shrink-0 -ml-1 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
            </svg>
          )}
          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${comment.author.is_author
            ? 'bg-bamboo-500/15 text-bamboo-400'
            : 'bg-surface-tertiary text-gray-500'
            }`}>
            {comment.author.nickname ? comment.author.nickname.charAt(0) : (comment.author.anon_number ?? '?')}
          </div>
          <span className={`text-[12px] font-medium ${comment.author.is_author ? 'text-bamboo-400' : 'text-gray-400'}`}>
            {formatAuthor(comment.author.anon_number, comment.author.school_name, comment.author.is_author, comment.author.nickname)}
          </span>
          {comment.author.is_post_author && (
            <span className="text-[10px] text-bamboo-400 border border-bamboo-500/30 bg-bamboo-500/10 px-1 py-0.5 rounded leading-none">
              작성자
            </span>
          )}
          <span className="text-[11px] text-gray-500 ml-1">
            {formatDate(comment.created_at)}
          </span>
        </div>

        <div className="pl-[26px]">
          <BodyRenderer text={comment.body} className="text-[13px] text-gray-200 leading-relaxed" />
        </div>
      </div>
      {comment.replies && comment.replies.length > 0 &&
        comment.replies.map(reply => (
          <CommentItem
            key={reply.id}
            comment={reply}
            onReply={onReply}
            onReport={onReport}
            onDelete={onDelete}
            onVote={onVote}
            depth={1}
            currentUserId={currentUserId}
          />
        ))
      }
    </>
  );
}
