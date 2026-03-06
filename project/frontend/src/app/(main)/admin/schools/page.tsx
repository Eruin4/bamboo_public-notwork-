'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { admin, SchoolAdminResponse, ApiError } from '@/lib/api';

export default function AdminSchoolsPage() {
    const { user, token, isLoading: isAuthLoading } = useAuth();
    const router = useRouter();

    const [schools, setSchools] = useState<SchoolAdminResponse[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<{ short_name: string; is_active: boolean; allowed_domains: string }>({
        short_name: '',
        is_active: false,
        allowed_domains: '',
    });

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createForm, setCreateForm] = useState({
        name: '',
        short_name: '',
        allowed_domains: '',
        description: '',
        is_active: true,
    });

    useEffect(() => {
        if (!isAuthLoading) {
            if (!user || user.role !== 'ADMIN') {
                return; // Layout handles redirect
            }
            fetchSchools();
        }
    }, [user, isAuthLoading, page]);

    const fetchSchools = async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const response = await admin.getSchools(token, page);
            setSchools(response.schools);
            setTotal(response.total);
        } catch (err) {
            console.error(err);
            alert('목록을 불러오는데 실패했습니다');
        } finally {
            setIsLoading(false);
        }
    };

    const startEdit = (school: SchoolAdminResponse) => {
        setEditingId(school.id);
        setEditForm({
            short_name: school.short_name,
            is_active: school.is_active,
            allowed_domains: school.allowed_domains.join(', '),
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
    };

    const handleCreate = async () => {
        if (!token) return;
        if (!createForm.name || !createForm.short_name || !createForm.allowed_domains) {
            alert('필수 항목을 모두 입력해주세요 (학교명, 별명, 도메인)');
            return;
        }

        try {
            const domains = createForm.allowed_domains.split(',').map(d => d.trim()).filter(Boolean);

            await admin.createSchool({
                name: createForm.name,
                short_name: createForm.short_name,
                allowed_domains: domains,
                description: createForm.description || undefined,
                is_active: createForm.is_active,
            }, token);

            alert('학교가 추가되었습니다');
            setIsCreateModalOpen(false);
            setCreateForm({
                name: '',
                short_name: '',
                allowed_domains: '',
                description: '',
                is_active: true,
            });
            fetchSchools();
        } catch (err) {
            if (err instanceof ApiError) {
                alert(err.message);
            } else {
                console.error(err);
                alert('학교 추가에 실패했습니다');
            }
        }
    };

    const handleUpdate = async (schoolId: number) => {
        if (!token) return;
        try {
            const domains = editForm.allowed_domains.split(',').map(d => d.trim()).filter(Boolean);

            await admin.updateSchool(schoolId, {
                short_name: editForm.short_name,
                is_active: editForm.is_active,
                allowed_domains: domains,
            }, token);

            alert('수정되었습니다');
            setEditingId(null);
            fetchSchools();
        } catch (err) {
            console.error(err);
            alert('수정에 실패했습니다');
        }
    };

    const handleDelete = async (schoolId: number, schoolName: string) => {
        if (!token) return;
        const confirmMsg = `정말 "${schoolName}" 학교를 삭제하시겠습니까?\n\n경고: 연결된 모든 게시판과 게시글이 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`;
        if (!confirm(confirmMsg)) return;

        const input = prompt(`삭제를 확인하려면 학교 이름 "${schoolName}"을(를) 정확히 입력하세요.`);
        if (input !== schoolName) {
            alert('학교 이름이 일치하지 않습니다.');
            return;
        }

        try {
            await admin.deleteSchool(schoolId, token);
            alert('삭제되었습니다.');
            fetchSchools();
        } catch (err) {
            if (err instanceof ApiError) {
                alert(err.message);
            } else {
                alert('삭제 중 오류가 발생했습니다.');
            }
        }
    };

    if (isAuthLoading || !user || user.role !== 'ADMIN') {
        return null; // Layout will show loading
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-100">등록된 학교 목록</h2>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="btn btn-primary btn-sm"
                >
                    + 학교 추가
                </button>
            </div>

            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-border bg-surface-tertiary">
                                <th className="p-4 font-medium text-gray-400 text-sm w-16">ID</th>
                                <th className="p-4 font-medium text-gray-400 text-sm w-40">학교명</th>
                                <th className="p-4 font-medium text-gray-400 text-sm w-32">별명/게시판</th>
                                <th className="p-4 font-medium text-gray-400 text-sm">허용 도메인</th>
                                <th className="p-4 font-medium text-gray-400 text-sm w-24">상태</th>
                                <th className="p-4 font-medium text-gray-400 text-sm w-40 text-right">관리</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-500">
                                        로딩 중...
                                    </td>
                                </tr>
                            ) : schools.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-500">
                                        등록된 학교가 없습니다
                                    </td>
                                </tr>
                            ) : (
                                schools.map((school) => (
                                    <tr key={school.id} className="hover:bg-surface-hover transition-colors">
                                        <td className="p-4 text-gray-500 text-sm text-center">{school.id}</td>

                                        {editingId === school.id ? (
                                            <>
                                                <td className="p-4 text-gray-300 font-medium">
                                                    {school.name}
                                                </td>
                                                <td className="p-4">
                                                    <input
                                                        type="text"
                                                        value={editForm.short_name}
                                                        onChange={(e) => setEditForm({ ...editForm, short_name: e.target.value })}
                                                        className="input text-sm py-1.5 w-full"
                                                        placeholder="별명"
                                                    />
                                                </td>
                                                <td className="p-4">
                                                    <input
                                                        type="text"
                                                        value={editForm.allowed_domains}
                                                        onChange={(e) => setEditForm({ ...editForm, allowed_domains: e.target.value })}
                                                        className="input text-sm py-1.5 w-full"
                                                        placeholder="example.com, test.ac.kr"
                                                    />
                                                </td>
                                                <td className="p-4">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={editForm.is_active}
                                                            onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                                                            className="rounded border-gray-600 bg-surface-tertiary text-bamboo-500 focus:ring-bamboo-500/20"
                                                        />
                                                        <span className="text-sm text-gray-300">활성</span>
                                                    </label>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => handleUpdate(school.id)}
                                                            className="btn btn-primary px-3 py-1 text-xs"
                                                        >
                                                            저장
                                                        </button>
                                                        <button
                                                            onClick={cancelEdit}
                                                            className="btn btn-secondary px-3 py-1 text-xs"
                                                        >
                                                            취소
                                                        </button>
                                                    </div>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="p-4 text-gray-200 font-medium">{school.name}</td>
                                                <td className="p-4 text-gray-300 text-sm">{school.short_name}</td>
                                                <td className="p-4 text-gray-400 text-sm">
                                                    <div className="flex flex-wrap gap-1">
                                                        {school.allowed_domains.map((domain) => (
                                                            <span key={domain} className="px-1.5 py-0.5 rounded bg-surface-tertiary border border-border text-xs">
                                                                @{domain}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    {school.is_active ? (
                                                        <span className="badge badge-green">활성</span>
                                                    ) : (
                                                        <span className="badge bg-red-500/10 text-red-400 border-red-500/20">비활성</span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => startEdit(school)}
                                                            className="btn btn-ghost btn-sm px-2 text-gray-400 hover:text-bamboo-400"
                                                            title="수정"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(school.id, school.name)}
                                                            className="btn btn-ghost btn-sm px-2 text-gray-400 hover:text-red-400"
                                                            title="삭제"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

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

            {/* Create Modal */}
            {
                isCreateModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-surface-secondary rounded-xl border border-border w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                            <div className="p-4 border-b border-border flex justify-between items-center bg-surface-tertiary">
                                <h3 className="font-bold text-lg">새 학교 추가</h3>
                                <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-white">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">
                                        학교명 <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={createForm.name}
                                        onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                                        className="input w-full"
                                        placeholder="예: 한국과학영재학교"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">
                                            별명 (게시판 이름) <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={createForm.short_name}
                                            onChange={e => setCreateForm({ ...createForm, short_name: e.target.value })}
                                            className="input w-full"
                                            placeholder="예: 한과영"
                                        />
                                    </div>
                                    <div className="flex items-end pb-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={createForm.is_active}
                                                onChange={e => setCreateForm({ ...createForm, is_active: e.target.checked })}
                                                className="rounded border-gray-600 bg-surface-tertiary text-bamboo-500 focus:ring-bamboo-500/20"
                                            />
                                            <span className="text-sm text-gray-300">활성 상태로 생성</span>
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">
                                        허용 도메인 <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={createForm.allowed_domains}
                                        onChange={e => setCreateForm({ ...createForm, allowed_domains: e.target.value })}
                                        className="input w-full"
                                        placeholder="예: ksa.hs.kr, student.ksa.hs.kr (쉼표로 구분)"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">학생들이 가입할 때 사용할 이메일 도메인입니다.</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">
                                        설명
                                    </label>
                                    <textarea
                                        value={createForm.description}
                                        onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                                        className="input w-full h-20 resize-none"
                                        placeholder="학교에 대한 간단한 설명"
                                    />
                                </div>
                            </div>
                            <div className="p-4 border-t border-border bg-surface-tertiary flex justify-end gap-2">
                                <button
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="btn btn-secondary"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handleCreate}
                                    className="btn btn-primary"
                                >
                                    추가하기
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
