/**
 * Utility functions.
 */

export function formatDate(dateString: string, options?: { hideYear?: boolean }): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;

  const formatOptions: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
  };

  if (!options?.hideYear) {
    formatOptions.year = 'numeric';
  }

  return date.toLocaleDateString('ko-KR', formatOptions);
}

export function formatAuthor(
  anonNumber: number | null,
  schoolName: string | null,
  isAuthor: boolean,
  nickname?: string | null
): string {
  const parts = [];

  if (schoolName) {
    parts.push(schoolName);
  }

  if (nickname) {
    parts.push(nickname);
  } else if (anonNumber !== null) {
    parts.push(`익명 ${anonNumber}`);
  } else {
    parts.push('익명');
  }



  return parts.join(' · ');
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

