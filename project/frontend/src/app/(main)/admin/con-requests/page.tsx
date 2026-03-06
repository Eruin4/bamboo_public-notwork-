'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { cons, ConPackResponse, ConPackDetailResponse, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/utils';

export default function AdminConRequestsPage() {
    const { token } = useAuth();
    const [packs, setPacks] = useState<ConPackResponse[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState<string>('PENDING');
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<number | null>(null);
    const [selectedPack, setSelectedPack] = useState<ConPackDetailResponse | null>(null);

    const fetchPacks = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const data = await cons.adminListConRequests(token, statusFilter || undefined, page);
            setPacks(data.packs);
            setTotal(data.total);
        } catch { /* ignore */ }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchPacks(); }, [token, page, statusFilter]);

    const handleView = async (pack: ConPackResponse) => {
        if (!token) return;
        try {
            const detail = await cons.getConPack(pack.id, token);
            setSelectedPack(detail);
        } catch { /* ignore */ }
    };

    const handleResolve = async (packId: number, status: 'APPROVED' | 'REJECTED') => {
        if (!token) return;
        const note = prompt(`관리자 메모 입력 (선택):`) ?? null;
        if (status === 'APPROVED' && !confirm('승인하시겠습니까?')) return;
        if (status === 'REJECTED' && !confirm('거절하시겠습니까?')) return;

        setProcessingId(packId);
        try {
            await cons.adminResolveConRequest(packId, status, note, token);
            alert(status === 'APPROVED' ? '승인되었습니다.' : '거절되었습니다.');
            setSelectedPack(null);
            fetchPacks();
        } catch (e) {
            alert(e instanceof ApiError ? e.message : '오류');
        } finally { setProcessingId(null); }
    };

    const handleDelete = async (packId: number) => {
        if (!token) return;
        if (!confirm('정말 이 밤부콘을 완전히 삭제하시겠습니까? (복구 불가)')) return;

        setProcessingId(packId);
        try {
            await cons.deletePack(packId, token);
            alert('삭제되었습니다.');
            setSelectedPack(null);
            fetchPacks();
        } catch (e) {
            alert(e instanceof ApiError ? e.message : '오류');
        } finally { setProcessingId(null); }
    };

    const statusBadge = (s: string) => {
        const map: Record<string, string> = {
            PENDING: 'bg-yellow-500/10 text-yellow-400',
            APPROVED: 'bg-green-500/10 text-green-400',
            REJECTED: 'bg-red-500/10 text-red-400',
        };
        const label: Record<string, string> = { PENDING: '대기중', APPROVED: '승인됨', REJECTED: '거절됨' };
        return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[s] || ''}`}>{label[s] || s}</span>;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-100">밤부콘 신청 관리</h2>
                <select
                    value={statusFilter}
                    onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                    className="bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-gray-200"
                >
                    <option value="">전체</option>
                    <option value="PENDING">대기중</option>
                    <option value="APPROVED">승인됨</option>
                    <option value="REJECTED">거절됨</option>
                </select>
            </div>

            {loading ? (
                <div className="py-20 text-center"><div className="spinner spinner-lg mx-auto" /></div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-surface-secondary text-gray-400 font-medium border-b border-border">
                            <tr>
                                <th className="px-4 py-3 w-16">ID</th>
                                <th className="px-4 py-3">이름</th>
                                <th className="px-4 py-3 w-16">개수</th>
                                <th className="px-4 py-3 w-32">신청일</th>
                                <th className="px-4 py-3 w-24">상태</th>
                                <th className="px-4 py-3 w-40 text-right">관리</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {packs.map(pack => (
                                <tr key={pack.id} className="hover:bg-surface-secondary/50 transition-colors">
                                    <td className="px-4 py-3 text-gray-500">#{pack.id}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            {pack.thumbnail_url && (
                                                <img src={pack.thumbnail_url} alt="" className="w-8 h-8 rounded object-cover" />
                                            )}
                                            <div>
                                                <p className="font-medium text-gray-200">{pack.name}</p>
                                                {pack.description && <p className="text-xs text-gray-500 truncate max-w-xs">{pack.description}</p>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-400">{pack.item_count}개</td>
                                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(pack.created_at)}</td>
                                    <td className="px-4 py-3">{statusBadge(pack.status)}</td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex justify-end gap-2 flex-wrap">
                                            <button
                                                onClick={() => handleView(pack)}
                                                className="btn btn-secondary btn-sm px-2 py-1 h-auto text-xs"
                                            >
                                                미리보기
                                            </button>
                                            {pack.status === 'PENDING' && (
                                                <>
                                                    <button
                                                        onClick={() => handleResolve(pack.id, 'APPROVED')}
                                                        disabled={processingId === pack.id}
                                                        className="btn btn-primary btn-sm px-2 py-1 h-auto text-xs"
                                                    >
                                                        승인
                                                    </button>
                                                    <button
                                                        onClick={() => handleResolve(pack.id, 'REJECTED')}
                                                        disabled={processingId === pack.id}
                                                        className="btn btn-secondary btn-sm px-2 py-1 h-auto text-xs"
                                                    >
                                                        거절
                                                    </button>
                                                </>
                                            )}
                                            <button
                                                onClick={() => handleDelete(pack.id)}
                                                disabled={processingId === pack.id}
                                                className="btn btn-secondary btn-sm px-2 py-1 h-auto text-xs text-red-500 hover:text-red-400"
                                            >
                                                삭제
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {packs.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-10 text-center text-gray-500">신청 내역이 없습니다.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* 페이지네이션 */}
            <div className="flex justify-center gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn btn-secondary btn-sm">이전</button>
                <span className="px-4 py-1 text-gray-400 text-sm flex items-center">{page} / {Math.ceil(total / 20) || 1}</span>
                <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)} className="btn btn-secondary btn-sm">다음</button>
            </div>

            {/* 미리보기 모달 */}
            {selectedPack && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedPack(null)}>
                    <div className="card max-w-lg w-full max-h-[80vh] overflow-y-auto p-6 space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-xl font-bold text-gray-100">{selectedPack.name}</h2>
                                {selectedPack.description && <p className="text-gray-400 text-sm mt-1">{selectedPack.description}</p>}
                                <p className="text-xs text-gray-500 mt-1">{selectedPack.item_count}개 콘</p>
                            </div>
                            <button onClick={() => setSelectedPack(null)} className="text-gray-400 hover:text-gray-200 text-2xl leading-none">&times;</button>
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                            {selectedPack.items.map(item => (
                                <div key={item.id} className="aspect-square rounded-lg overflow-hidden bg-surface">
                                    <img src={item.image_url} alt={item.name || '콘'} className="w-full h-full object-cover" />
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2 mt-4">
                            {selectedPack.status === 'PENDING' && (
                                <>
                                    <button
                                        onClick={() => handleResolve(selectedPack.id, 'APPROVED')}
                                        disabled={processingId === selectedPack.id}
                                        className="btn btn-primary flex-1"
                                    >
                                        승인
                                    </button>
                                    <button
                                        onClick={() => handleResolve(selectedPack.id, 'REJECTED')}
                                        disabled={processingId === selectedPack.id}
                                        className="btn btn-secondary flex-1"
                                    >
                                        거절
                                    </button>
                                </>
                            )}
                            <button
                                onClick={() => handleDelete(selectedPack.id)}
                                disabled={processingId === selectedPack.id}
                                className="btn btn-secondary flex-1 text-red-500"
                            >
                                삭제 (복구 불가)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
