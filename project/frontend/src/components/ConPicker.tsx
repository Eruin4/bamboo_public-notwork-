'use client';

import { useEffect, useRef, useState } from 'react';
import { cons, MyConPackResponse, ConItemResponse } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface ConPickerProps {
    onSelect: (conTag: string) => void;
}

export default function ConPicker({ onSelect }: ConPickerProps) {
    const { token } = useAuth();
    const [open, setOpen] = useState(false);
    const [packs, setPacks] = useState<MyConPackResponse[]>([]);
    const [activePackId, setActivePackId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const loadPacks = async () => {
        if (!token || packs.length > 0) return;
        setLoading(true);
        try {
            const data = await cons.getMyConPacks(token);
            setPacks(data);
            if (data.length > 0) setActivePackId(data[0].id);
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = () => {
        if (!open) loadPacks();
        setOpen(v => !v);
    };

    const activePack = packs.find(p => p.id === activePackId);

    return (
        <div className="relative" ref={pickerRef}>
            {/* 트리거 버튼 */}
            <button
                type="button"
                onClick={handleToggle}
                className="p-1.5 rounded hover:bg-surface-secondary text-gray-400 hover:text-gray-200 transition-colors text-lg leading-none"
                title="콘 추가"
            >
                <svg className="w-5 h-5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
            </button>

            {/* 피커 팝업 */}
            {open && (
                <div className="absolute bottom-10 left-0 z-50 w-80 bg-surface-secondary border border-border rounded-xl shadow-2xl overflow-hidden">
                    {/* 탭: 밤부콘 목록 */}
                    {packs.length > 0 && (
                        <div className="flex gap-1 p-2 border-b border-border overflow-x-auto scrollbar-thin">
                            {packs.map(p => (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => setActivePackId(p.id)}
                                    className={`flex-shrink-0 w-9 h-9 rounded-lg overflow-hidden border-2 transition-all ${activePackId === p.id ? 'border-primary' : 'border-transparent hover:border-border'}`}
                                    title={p.name}
                                >
                                    {p.thumbnail_url ? (
                                        <img src={p.thumbnail_url} alt={p.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-surface flex items-center justify-center text-xs text-gray-400">
                                            {p.name.charAt(0)}
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* 콘 그리드 */}
                    <div className="p-2 max-h-[140px] overflow-y-auto">
                        {loading ? (
                            <div className="py-8 text-center text-gray-500 text-sm">불러오는 중...</div>
                        ) : packs.length === 0 ? (
                            <div className="py-8 text-center space-y-2">
                                <p className="text-gray-500 text-sm">보관함에 밤부콘이 없습니다</p>
                                <a
                                    href="/cons"
                                    className="text-xs text-primary hover:underline"
                                    onClick={() => setOpen(false)}
                                >
                                    콘 스토어에서 추가하기 →
                                </a>
                            </div>
                        ) : activePack ? (
                            <div className="grid grid-cols-5 gap-1">
                                {activePack.items.map(item => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => {
                                            onSelect(`~con:${item.id}~`);
                                            setOpen(false);
                                        }}
                                        className="w-full aspect-square rounded-lg overflow-hidden hover:bg-surface hover:scale-105 transition-transform p-0.5"
                                        title={item.name || `콘 ${item.id}`}
                                    >
                                        <img
                                            src={item.image_url}
                                            alt={item.name || '콘'}
                                            className="w-full h-full object-cover rounded"
                                        />
                                    </button>
                                ))}
                            </div>
                        ) : null}
                    </div>

                    {/* 하단 링크 */}
                    {packs.length > 0 && (
                        <div className="px-3 py-2 border-t border-border text-right">
                            <a
                                href="/cons"
                                className="text-xs text-gray-500 hover:text-primary transition-colors"
                                onClick={() => setOpen(false)}
                            >
                                콘 스토어 →
                            </a>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
