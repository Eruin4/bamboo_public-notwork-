'use client';

import { useAuth } from '@/lib/auth-context';
import { boards, posts, uploads, BoardResponse, UploadResponse, ApiError } from '@/lib/api';
import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatFileSize } from '@/lib/utils';
import ConPicker from '@/components/ConPicker';

export default function WritePage({ params }: { params: Promise<{ boardId: string }> }) {
  const resolvedParams = use(params);
  const { token, user } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  // Single selection state — either a heading ID, 'notice', or null (nothing selected)
  const [selection, setSelection] = useState<number | 'notice' | null>(null);

  const isNotice = selection === 'notice';
  const headingId = typeof selection === 'number' ? selection : null;

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [useNickname, setUseNickname] = useState(false);

  // File upload state
  const [uploadedFiles, setUploadedFiles] = useState<UploadResponse[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const boardId = parseInt(resolvedParams.boardId);

  useEffect(() => {
    if (token && boardId) {
      boards.get(boardId, token).then(setBoard);
    }
  }, [token, boardId]);

  // Auto-select "일반" heading on initial board load (runs once when board data arrives)
  useEffect(() => {
    if (board?.headings.length && selection === null) {
      const general = board.headings.find(h => h.name === '일반');
      setSelection(general ? general.id : board.headings[0].id);
    }
  }, [board]); // eslint-disable-line react-hooks/exhaustive-deps
  // Note: intentionally only depends on [board] — runs once on load, NOT when selection→null

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !token) return;

    setUploadError('');

    if (uploadedFiles.length + files.length > 10) {
      setUploadError('파일은 최대 10개까지 첨부할 수 있습니다');
      return;
    }

    setIsUploading(true);
    try {
      const newFiles: UploadResponse[] = [];
      for (const file of Array.from(files)) {
        const result = await uploads.upload(file, token);
        newFiles.push(result);
      }
      setUploadedFiles(prev => [...prev, ...newFiles]);
    } catch (err) {
      if (err instanceof ApiError) {
        setUploadError(err.message);
      } else {
        setUploadError('파일 업로드 중 오류가 발생했습니다');
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeFile = (fileId: number) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const isImageFile = (mimeType: string) => mimeType.startsWith('image/');

  const getFileIcon = (mimeType: string) => {
    if (mimeType === 'application/pdf') return '📄';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📎';
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return '🗜️';
    if (mimeType === 'text/plain') return '📃';
    if (mimeType.includes('hwp')) return '📄';
    return '📁';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setError('');
    setIsLoading(true);

    try {
      const post = await posts.create(boardId, {
        title,
        body,
        heading_id: headingId || undefined,
        attached_file_ids: uploadedFiles.map(f => f.id),
        use_nickname: useNickname || undefined,
        is_notice: isNotice || undefined,
      }, token);
      router.push(`/boards/${boardId}/posts/${post.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('게시글 작성 중 오류가 발생했습니다');
      }
      setIsLoading(false);
    }
  };

  if (!board) {
    return (
      <div className="py-2 max-w-4xl mx-auto">
        <div className="skeleton h-4 w-20 mb-6" />
        <div className="card p-6">
          <div className="skeleton h-6 w-48 mb-6" />
          <div className="skeleton h-10 w-full mb-4" />
          <div className="skeleton h-40 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="py-2 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/boards/${boardId}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-bamboo-400 transition-colors mb-4"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {board.name}
        </Link>
        <h1 className="text-xl font-bold text-gray-100">글쓰기</h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="card">
        <div className="p-6">
          {error && (
            <div className="alert alert-error mb-5 flex items-start gap-3">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-5">
            {/* Notice + Heading Select */}
            {(board.headings.length > 0 || board.is_manager) && (
              <div>
                <label className="label">글머리</label>
                <div className="flex flex-wrap gap-2">
                  {board.is_manager && (
                    <button
                      type="button"
                      onClick={() => setSelection('notice')}
                      className="px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200"
                      style={{
                        backgroundColor: isNotice ? '#8B5CF6' : '#8B5CF612',
                        color: isNotice ? 'white' : '#8B5CF6',
                        border: isNotice ? '1px solid #8B5CF6' : '1px solid #8B5CF630',
                        boxShadow: isNotice ? '0 0 12px #8B5CF630' : 'none',
                      }}
                    >
                      공지
                    </button>
                  )}
                  {board.headings.map(heading => (
                    <button
                      key={heading.id}
                      type="button"
                      onClick={() => setSelection(selection === heading.id ? null : heading.id)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200"
                      style={{
                        backgroundColor: headingId === heading.id ? heading.color : 'transparent',
                        color: headingId === heading.id ? 'white' : heading.color,
                        border: `1px solid ${heading.color}`,
                        boxShadow: headingId === heading.id ? `0 0 12px ${heading.color}30` : 'none',
                      }}
                    >
                      {heading.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Title */}
            <div>
              <label htmlFor="title" className="label">제목</label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input"
                placeholder="제목을 입력하세요"
                required
                maxLength={200}
                autoFocus
              />
            </div>

            {/* Body */}
            <div>
              <label htmlFor="body" className="label">내용</label>
              <textarea
                id="body"
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="input min-h-[280px]"
                placeholder="내용을 입력하세요..."
                required
                maxLength={10000}
              />
              <div className="flex items-center justify-between mt-2">
                {/* 콘 피커 */}
                <ConPicker
                  onSelect={(tag) => {
                    const el = bodyRef.current;
                    if (!el) { setBody(prev => prev + tag); return; }
                    const start = el.selectionStart ?? body.length;
                    const end = el.selectionEnd ?? body.length;
                    const next = body.slice(0, start) + tag + body.slice(end);
                    setBody(next);
                    // 커서 위치 설정
                    setTimeout(() => {
                      el.focus();
                      el.setSelectionRange(start + tag.length, start + tag.length);
                    }, 0);
                  }}
                />
                <span className="text-xs text-gray-600 tabular-nums">{body.length.toLocaleString()} / 10,000</span>
              </div>
            </div>

            {/* Nickname Toggle */}
            {user?.nickname && (
              <div className="flex items-center gap-3 bg-surface-secondary rounded-xl px-4 py-3 border border-border">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useNickname}
                    onChange={(e) => setUseNickname(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-surface-tertiary border border-border rounded-full peer peer-checked:bg-bamboo-500 peer-checked:border-bamboo-500 transition-colors after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-gray-300 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full peer-checked:after:bg-white" />
                </label>
                <div className="flex-1">
                  <p className="text-sm text-gray-200">
                    {useNickname ? `${user.nickname} (닉네임)` : '익명'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {useNickname
                      ? `작성자로 "${user.nickname}"이(가) 표시됩니다`
                      : '작성자로 익명 번호가 표시됩니다'
                    }
                  </p>
                </div>
              </div>
            )}

            {/* File Upload */}
            <div>
              <label className="label">파일 첨부</label>
              <div
                className="border-2 border-dashed border-border rounded-xl p-5 text-center hover:border-bamboo-500/40 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt,.hwp"
                />
                {isUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="spinner" />
                    <span className="text-sm text-gray-400">업로드 중...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-7 h-7 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                    </svg>
                    <span className="text-sm text-gray-400">
                      클릭하여 파일을 선택하세요
                    </span>
                    <span className="text-xs text-gray-600">
                      이미지, PDF, 문서, 압축파일 등 (최대 10MB, 10개)
                    </span>
                  </div>
                )}
              </div>

              {uploadError && (
                <div className="mt-2 text-xs text-red-400">{uploadError}</div>
              )}

              {/* Uploaded Files List */}
              {uploadedFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {uploadedFiles.map(file => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 bg-surface-secondary rounded-lg px-3 py-2.5 border border-border"
                    >
                      {isImageFile(file.mime_type) && file.thumb_key ? (
                        <img
                          src={`/thumbs/${file.thumb_key}`}
                          alt={file.original_name}
                          className="w-9 h-9 rounded-md object-cover border border-border"
                        />
                      ) : (
                        <span className="text-lg w-9 h-9 flex items-center justify-center">
                          {getFileIcon(file.mime_type)}
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-200 truncate">{file.original_name}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(file.id)}
                        className="text-gray-500 hover:text-red-400 transition-colors p-1"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <p className="text-xs text-gray-500 text-right">
                    {uploadedFiles.length}개 파일 첨부됨
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-surface-secondary/30">
          <Link
            href={`/boards/${boardId}`}
            className="btn btn-secondary btn-sm"
          >
            취소
          </Link>
          <button
            type="submit"
            disabled={isLoading || !title.trim() || !body.trim()}
            className="btn btn-primary btn-sm"
          >
            {isLoading ? (
              <div className="spinner spinner-sm" />
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
                작성하기
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
