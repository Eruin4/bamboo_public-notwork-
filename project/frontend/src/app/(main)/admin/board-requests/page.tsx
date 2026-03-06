'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { boardManage, ApiError, BoardRequestResponse } from '@/lib/api';

export default function AdminBoardRequestsPage() {
    const { user, token, isLoading: isAuthLoading } = useAuth();
    const [requests, setRequests] = useState<BoardRequestResponse[]>([]);
    const [statusFilter, setStatusFilter] = useState<string>('PENDING');
    const [loading, setLoading] = useState(true);
    const [resolveModal, setResolveModal] = useState<{
        request: BoardRequestResponse;
        action: string;
    } | null>(null);
    const [adminNote, setAdminNote] = useState('');
    const [processing, setProcessing] = useState(false);

    const fetchRequests = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            const data = await boardManage.getRequestsAdmin(token, statusFilter || undefined);
            setRequests(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [token, statusFilter]);

    useEffect(() => {
        if (!isAuthLoading && user && token) {
            fetchRequests();
        }
    }, [isAuthLoading, user, token, fetchRequests]);

    const handleResolve = async () => {
        if (!token || !resolveModal) return;
        setProcessing(true);
        try {
            const res = await boardManage.resolveRequest(
                resolveModal.request.id,
                resolveModal.action,
                adminNote || null,
                token
            );
            alert(res.message);
            setResolveModal(null);
            setAdminNote('');
            fetchRequests();
        } catch (err) {
            if (err instanceof ApiError) alert(err.message);
            else alert('처리에 실패했습니다');
        } finally {
            setProcessing(false);
        }
    };

    const statusLabel = (s: string) => {
        switch (s) {
            case 'PENDING': return <span className="px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400">대기중</span>;
            case 'APPROVED': return <span className="px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400">승인됨</span>;
            case 'REJECTED': return <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400">거절됨</span>;
            default: return <span className="px-2 py-0.5 rounded text-xs bg-gray-500/20 text-gray-400">{s}</span>;
        }
    };

    if (isAuthLoading) {
        return <div className="flex justify-center py-20"><div className="loading-spinner" /></div>;
    }

    if (!user || user.role !== 'ADMIN') {
        return <div className="text-center py-20 text-gray-400">관리자 권한이 필요합니다</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-100">게시판 신청 관리</h1>
                <p className="text-gray-400 text-sm mt-1">사용자들의 게시판 생성 신청을 관리합니다.</p>
            </div>

            {/* 필터 */}
            <div className="flex gap-2">
                {['PENDING', 'APPROVED', 'REJECTED', ''].map(f => (
                    <button
                        key={f || 'all'}
                        onClick={() => setStatusFilter(f)}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${statusFilter === f
                            ? 'bg-bamboo-500 text-white'
                            : 'bg-surface-tertiary text-gray-400 hover:text-white'
                            }`}
                    >
                        {f === '' ? '전체' : f === 'PENDING' ? '대기중' : f === 'APPROVED' ? '승인됨' : '거절됨'}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center py-10"><div className="loading-spinner" /></div>
            ) : requests.length === 0 ? (
                <div className="card p-8 text-center text-gray-500">
                    {statusFilter ? '해당 상태의 신청이 없습니다' : '신청이 없습니다'}
                </div>
            ) : (
                <div className="space-y-3">
                    {requests.map(req => (
                        <div key={req.id} className="card p-5">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-gray-100 text-lg">
                                        {req.board_name.startsWith('[DELETE] ')
                                            ? req.board_name.replace('[DELETE] ', '🗑️ 삭제 요청: ')
                                            : req.board_name}
                                    </h3>
                                    {req.board_name.startsWith('[DELETE] ') && (
                                        <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400 border border-red-500/30">
                                            삭제 요청
                                        </span>
                                    )}
                                </div>
                                {statusLabel(req.status)}
                            </div>

                            {req.board_description && (
                                <p className="text-sm text-gray-400 mb-3">{req.board_description}</p>
                            )}

                            <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                                <div>
                                    <span className="text-gray-500">신청자: </span>
                                    <span className="text-gray-300">{req.requester_email}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500">소속: </span>
                                    <span className="text-gray-300">{req.requester_school_name || '-'}</span>
                                </div>
                            </div>

                            <div className="mb-3">
                                <span className="text-gray-500 text-sm">접근 학교: </span>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                    {req.school_names.map((name, i) => (
                                        <span key={i} className="px-2 py-0.5 bg-surface-tertiary rounded text-xs text-gray-300">
                                            {name}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <p className="text-xs text-gray-600 mb-3">
                                {new Date(req.created_at).toLocaleString('ko-KR')}
                            </p>

                            {req.admin_note && (
                                <p className="text-xs text-gray-500 mb-3 p-2 bg-surface-tertiary rounded">
                                    관리자 메모: {req.admin_note}
                                </p>
                            )}

                            {req.status === 'PENDING' && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { setResolveModal({ request: req, action: 'APPROVED' }); setAdminNote(''); }}
                                        className="btn btn-primary text-sm"
                                    >
                                        승인
                                    </button>
                                    <button
                                        onClick={() => { setResolveModal({ request: req, action: 'REJECTED' }); setAdminNote(''); }}
                                        className="btn bg-red-600 hover:bg-red-700 text-white text-sm"
                                    >
                                        거절
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* 처리 모달 */}
            {resolveModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
                    <div className="bg-surface-secondary rounded-xl p-6 w-full max-w-md border border-border">
                        <h3 className="text-lg font-bold text-gray-100 mb-4">
                            {resolveModal.action === 'APPROVED' ? '게시판 신청 승인' : '게시판 신청 거절'}
                        </h3>

                        <div className="mb-4">
                            <p className="text-sm text-gray-400">
                                게시판: <span className="text-gray-200">{resolveModal.request.board_name}</span>
                            </p>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-400 mb-1.5">
                                관리자 메모 (선택)
                            </label>
                            <textarea
                                value={adminNote}
                                onChange={e => setAdminNote(e.target.value)}
                                className="input w-full h-20 resize-none"
                                placeholder="메모 입력..."
                            />
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setResolveModal(null)}
                                className="btn bg-surface-tertiary text-gray-300 hover:bg-border"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleResolve}
                                disabled={processing}
                                className={`btn text-white ${resolveModal.action === 'APPROVED'
                                    ? 'bg-green-600 hover:bg-green-700'
                                    : 'bg-red-600 hover:bg-red-700'
                                    }`}
                            >
                                {processing ? '처리 중...' : resolveModal.action === 'APPROVED' ? '승인 확인' : '거절 확인'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
