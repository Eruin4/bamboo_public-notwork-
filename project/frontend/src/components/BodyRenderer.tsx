'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { extractConIds, preloadConIds, renderBodyWithCons } from '@/lib/con-renderer';

interface BodyRendererProps {
    text: string;
    className?: string;
}

/**
 * 게시글/댓글 본문 렌더러.
 * ~con:123~ 태그를 실제 이미지로 교체하며, SWR-style 클라이언트 캐시를 사용합니다.
 */
export default function BodyRenderer({ text, className }: BodyRendererProps) {
    const { token } = useAuth();
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (!token) return;
        const ids = extractConIds(text);
        if (ids.length === 0) {
            setReady(true);
            return;
        }
        preloadConIds(ids, token).then(() => setReady(true));
    }, [text, token]);

    const parts = ready ? renderBodyWithCons(text) : [text];

    return (
        <div className={className} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {parts.map((part, i) =>
                typeof part === 'string'
                    ? <span key={i}>{part}</span>
                    : part
            )}
        </div>
    );
}
