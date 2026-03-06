'use client';

import { useAuth } from '@/lib/auth-context';
import { boards, BoardResponse } from '@/lib/api';
import Link from 'next/link';
import { useSWRFetch } from '@/hooks/use-swr-fetch';

export default function BoardsPage() {
  const { token } = useAuth();

  const { data, isLoading } = useSWRFetch<{ boards: BoardResponse[] }>(
    token ? 'boards:list' : null,
    () => boards.list(token!),
  );

  const boardList = data?.boards ?? [];

  if (isLoading) {
    return (
      <div className="py-2">
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-6">
              <div className="skeleton h-5 w-40 mb-3" />
              <div className="skeleton h-3 w-60 mb-4" />
              <div className="flex gap-2">
                <div className="skeleton h-6 w-14 rounded-full" />
                <div className="skeleton h-6 w-14 rounded-full" />
                <div className="skeleton h-6 w-14 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 전체 게시판을 맨 위로, 그 외는 추가된 순서대로 정렬
  const sortedBoards = [
    ...boardList.filter(b => b.board_type === 'GLOBAL'),
    ...boardList.filter(b => b.board_type !== 'GLOBAL')
  ];

  return (
    <div className="py-2">
      <div className="min-w-0">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-100">게시판</h1>
          <p className="text-sm text-gray-500 mt-1">자유롭게 소통하세요</p>
        </div>

        {sortedBoards.length > 0 && (
          <section className="space-y-3">
            {sortedBoards.map((board) => (
              <BoardCard key={board.id} board={board} />
            ))}
          </section>
        )}

        {boardList.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-surface-secondary border border-border flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🎋</span>
            </div>
            <p className="text-gray-500 text-sm">아직 게시판이 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
}

function BoardCard({ board }: { board: BoardResponse }) {
  return (
    <Link
      href={`/boards/${board.id}`}
      className="card card-interactive p-5 block"
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-gray-100 text-[15px]">{board.name}</h3>
          {board.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-1">{board.description}</p>
          )}
        </div>
        <svg
          className="w-4 h-4 text-gray-600 ml-4 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </Link>
  );
}
