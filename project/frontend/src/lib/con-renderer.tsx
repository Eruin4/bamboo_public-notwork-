'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef } from 'react';

// 전역 콘 메타 캐시 (클라이언트 사이드)
const conMetaCache = new Map<number, string>(); // id -> image_url
const pendingFetch = new Set<number>(); // 현재 fetch 중인 ID
let batchTimer: ReturnType<typeof setTimeout> | null = null;
let batchIds: Set<number> = new Set();
const batchCallbacks: Map<number, ((url: string) => void)[]> = new Map();

async function fetchBatch(ids: number[], token: string) {
    if (ids.length === 0) return;
    try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';
        const resp = await fetch(`${API_URL}/cons/items/meta?ids=${ids.join(',')}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) return;
        const data: { id: number; image_url: string }[] = await resp.json();
        for (const item of data) {
            conMetaCache.set(item.id, item.image_url);
            pendingFetch.delete(item.id);
            const cbs = batchCallbacks.get(item.id) || [];
            for (const cb of cbs) cb(item.image_url);
            batchCallbacks.delete(item.id);
        }
    } catch {
        // silent
    }
}

export function resolveConUrl(id: number, token: string, onReady: (url: string) => void): string | null {
    // 캐시 히트
    if (conMetaCache.has(id)) {
        onReady(conMetaCache.get(id)!);
        return conMetaCache.get(id)!;
    }

    if (!pendingFetch.has(id)) {
        pendingFetch.add(id);
        batchIds.add(id);
        const callbacks = batchCallbacks.get(id) || [];
        callbacks.push(onReady);
        batchCallbacks.set(id, callbacks);

        // 디바운스: 50ms 내 요청을 묶어서 한 번에 fetch
        if (batchTimer) clearTimeout(batchTimer);
        batchTimer = setTimeout(() => {
            const toFetch = Array.from(batchIds);
            batchIds = new Set();
            batchTimer = null;
            fetchBatch(toFetch, token);
        }, 50);
    } else {
        // 이미 대기 중이지만 콜백 추가
        const callbacks = batchCallbacks.get(id) || [];
        callbacks.push(onReady);
        batchCallbacks.set(id, callbacks);
    }

    return null;
}

/** 본문/댓글 텍스트에서 ~con:123~ 패턴 파싱 */
export const CON_PATTERN = /~con:(\d+)~/g;

export function extractConIds(text: string): number[] {
    const ids: number[] = [];
    const matches = text.matchAll(/~con:(\d+)~/g);
    for (const m of matches) {
        ids.push(Number(m[1]));
    }
    return [...new Set(ids)];
}

/** 콘 ID 목록을 미리 캐시에 로드 */
export async function preloadConIds(ids: number[], token: string) {
    const missing = ids.filter(id => !conMetaCache.has(id));
    if (missing.length === 0) return;
    await fetchBatch(missing, token);
}

/** ~con:123~ 패턴을 <img> 로 교체하는 리액트 렌더링 함수 */
export function renderBodyWithCons(text: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const regex = /~con:(\d+)~/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(text.slice(lastIndex, match.index));
        }
        const id = Number(match[1]);
        const url = conMetaCache.get(id);
        if (url) {
            parts.push(
                <img
                    key={`con-${id}-${match.index}`}
                    src={url}
                    alt="콘"
                    width={100}
                    height={100}
                    style={{ display: 'inline-block', verticalAlign: 'middle' }}
                />
            );
        } else {
            // 캐시에 없으면 일단 플레이스홀더
            parts.push(
                <span
                    key={`con-ph-${id}-${match.index}`}
                    style={{ display: 'inline-block', width: 100, height: 100, background: '#333', borderRadius: 4, verticalAlign: 'middle' }}
                />
            );
        }
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
    }

    return parts;
}
