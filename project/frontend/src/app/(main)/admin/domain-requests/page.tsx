'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { admin, DomainRequestResponse, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/utils';

export default function DomainRequestsPage() {
    const { token } = useAuth();
    const [requests, setRequests] = useState<DomainRequestResponse[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | ''>('');
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<number | null>(null);

    const fetchRequests = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const data = await admin.getDomainRequests(token, page, statusFilter || undefined);
            setRequests(data.requests);
            setTotal(data.total);
        } catch (err) {
            console.error(err);
            alert('도메인 신청 목록을 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, [token, page, statusFilter]);

    const handleResolve = async (requestId: number, status: 'APPROVED' | 'REJECTED') => {
        if (!token) return;

        if (status === 'APPROVED') {
            if (!confirm('승인하시겠습니까? 승인 시 학교 및 게시판이 자동 생성되거나, 기존 학교에 도메인이 추가됩니다.')) return;
        } else {
            if (!confirm('거절하시겠습니까?')) return;
        }

        const note = prompt('관리자 메모를 입력하세요 (선택):');

        setProcessingId(requestId);
        try {
            await admin.resolveDomainRequest(requestId, status, note, token);
            alert(status === 'APPROVED' ? '승인되었습니다.' : '거절되었습니다.');
            fetchRequests();
        } catch (err) {
            if (err instanceof ApiError) {
                alert(err.message);
            } else {
                alert('처리 중 오류가 발생했습니다.');
            }
        } finally {
            setProcessingId(null);
        }
    };

    const handleDelete = async (requestId: number) => {
        if (!token) return;

        if (!confirm('정말 이 도메인 신청 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;

        setProcessingId(requestId);
        try {
            await admin.deleteDomainRequest(requestId, token);
            alert('삭제되었습니다.');
            fetchRequests();
        } catch (err) {
            if (err instanceof ApiError) {
                alert(err.message);
            } else {
                alert('삭제 중 오류가 발생했습니다.');
            }
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-100">도메인 신청 관리</h2>
                <div className="flex items-center gap-2">
                    <select
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value as any);
                            setPage(1);
                        }}
                        className="bg-surface-secondary border border-border rounded-lg px-3 py-2 text-sm text-gray-200"
                    >
                        <option value="">전체 상태</option>
                        <option value="PENDING">대기중</option>
                        <option value="APPROVED">승인됨</option>
                        <option value="REJECTED">거절됨</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="py-20 text-center">
                    <div className="spinner spinner-lg mx-auto mb-4" />
                    <p className="text-gray-500">불러오는 중...</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-surface-secondary text-gray-400 font-medium border-b border-border">
                            <tr>
                                <th className="px-4 py-3 w-16">ID</th>
                                <th className="px-4 py-3 w-40">학교명 (줄임말)</th>
                                <th className="px-4 py-3 w-32">도메인</th>
                                <th className="px-4 py-3">설명</th>
                                <th className="px-4 py-3 w-32">요청자</th>
                                <th className="px-4 py-3 w-24">상태</th>
                                <th className="px-4 py-3 w-32">요청일</th>
                                <th className="px-4 py-3 w-32 text-right">관리</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {requests.map((req) => (
                                <tr key={req.id} className="hover:bg-surface-secondary/50 transition-colors">
                                    <td className="px-4 py-3 text-gray-500">#{req.id}</td>
                                    <td className="px-4 py-3 font-medium text-gray-200">
                                        {req.school_name}
                                        <span className="text-gray-500 ml-1 text-xs">({req.school_short_name})</span>
                                    </td>
                                    <td className="px-4 py-3 text-blue-400">@{req.email_domain}</td>
                                    <td className="px-4 py-3 text-gray-400 truncate max-w-xs" title={req.description || ''}>
                                        {req.description || '-'}
                                    </td>
                                    <td className="px-4 py-3 text-gray-300 text-xs">
                                        {req.requester_email || '-'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${req.status === 'PENDING'
                                            ? 'bg-yellow-500/10 text-yellow-400'
                                            : req.status === 'APPROVED'
                                                ? 'bg-green-500/10 text-green-400'
                                                : 'bg-red-500/10 text-red-400'
                                            }`}>
                                            {req.status === 'PENDING' ? '대기중'
                                                : req.status === 'APPROVED' ? '승인됨'
                                                    : '거절됨'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-500 text-xs">
                                        {formatDate(req.created_at)}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex flex-col items-end gap-2">
                                            {req.status === 'PENDING' && (
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleResolve(req.id, 'APPROVED')}
                                                        disabled={processingId === req.id}
                                                        className="btn btn-primary btn-sm px-2 py-1 h-auto text-xs"
                                                    >
                                                        승인
                                                    </button>
                                                    <button
                                                        onClick={() => handleResolve(req.id, 'REJECTED')}
                                                        disabled={processingId === req.id}
                                                        className="btn btn-secondary btn-sm px-2 py-1 h-auto text-xs"
                                                    >
                                                        거절
                                                    </button>
                                                </div>
                                            )}
                                            <button
                                                onClick={() => handleDelete(req.id)}
                                                disabled={processingId === req.id}
                                                className="btn btn-secondary btn-sm px-2 py-1 h-auto text-xs text-red-500 hover:bg-red-500/10 hover:text-red-400 border-red-500/20"
                                            >
                                                기록 삭제
                                            </button>
                                            {req.admin_note && (
                                                <div className="text-xs text-gray-500 mt-1 text-right">
                                                    {req.admin_note}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {requests.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                                        신청 내역이 없습니다.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination */}
            <div className="flex justify-center gap-2 mt-4">
                <button
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="btn btn-secondary btn-sm"
                >
                    이전
                </button>
                <span className="px-4 py-1 text-gray-400 text-sm flex items-center">
                    {page} / {Math.ceil(total / 20) || 1}
                </span>
                <button
                    disabled={page >= Math.ceil(total / 20)}
                    onClick={() => setPage(p => p + 1)}
                    className="btn btn-secondary btn-sm"
                >
                    다음
                </button>
            </div>
        </div>
    );
}
