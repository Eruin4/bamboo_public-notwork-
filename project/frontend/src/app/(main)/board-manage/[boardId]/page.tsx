'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useParams, useRouter } from 'next/navigation';
import { boardManage, ApiError, BoardManageInfo, SchoolListItem, SubManagerCandidate, ReportItem } from '@/lib/api';
import Link from 'next/link';

const STATUS_LABELS: Record<string, string> = {
    PENDING: '대기중',
    REVIEWED: '검토중',
    RESOLVED: '처리완료',
    DISMISSED: '무시됨',
};

const STATUS_COLORS: Record<string, string> = {
    PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    REVIEWED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    RESOLVED: 'bg-green-500/10 text-green-400 border-green-500/20',
    DISMISSED: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

export default function BoardManageDetailPage() {
    const { user, token, isLoading: isAuthLoading } = useAuth();
    const params = useParams();
    const router = useRouter();
    const boardId = Number(params.boardId);

    const [activeTab, setActiveTab] = useState<'general' | 'reports' | 'settings'>('general');

    const [board, setBoard] = useState<BoardManageInfo | null>(null);
    const [allSchools, setAllSchools] = useState<SchoolListItem[]>([]);
    const [candidates, setCandidates] = useState<SubManagerCandidate[]>([]);
    const [loading, setLoading] = useState(true);

    // School add
    const [schoolSearch, setSchoolSearch] = useState('');
    const [showSchoolDropdown, setShowSchoolDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Click outside to close dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowSchoolDropdown(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Sub manager add
    const [selectedCandidate, setSelectedCandidate] = useState<number | ''>('');
    const [subManagerSearch, setSubManagerSearch] = useState('');
    const [isSearchingCandidates, setIsSearchingCandidates] = useState(false);
    const subManagerSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Reports
    const [openReportId, setOpenReportId] = useState<number | null>(null);
    const [reports, setReports] = useState<ReportItem[]>([]);
    const [reportsTotal, setReportsTotal] = useState(0);
    const [reportsPage, setReportsPage] = useState(1);
    const [reportsStatus, setReportsStatus] = useState<string>('');
    const [reportsLoading, setReportsLoading] = useState(false);
    const [resolvingId, setResolvingId] = useState<number | null>(null);

    // Transfer Ownership
    const [selectedOwnerCandidate, setSelectedOwnerCandidate] = useState<number | ''>('');

    // Settings
    const [newDescription, setNewDescription] = useState('');
    const [newThreshold, setNewThreshold] = useState<number>(5);
    const [isUpdatingDesc, setIsUpdatingDesc] = useState(false);

    const isOwner = user?.role === 'ADMIN' || board?.my_role === 'OWNER';
    const isSubManager = board?.my_role === 'SUB_MANAGER';

    const fetchBoard = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            const data = await boardManage.getBoardManageInfo(boardId, token);
            setBoard(data);
            setNewDescription(data.description || ''); // Initialize description
            setNewThreshold(data.hot_post_threshold || 5); // Initialize threshold
        } catch (err) {
            if (err instanceof ApiError && err.status === 403) {
                alert('게시판 관리 권한이 없습니다');
                router.push('/board-manage');
            }
        } finally {
            setLoading(false);
        }
    }, [token, boardId, router]);

    const fetchSchools = useCallback(async () => {
        if (!token) return;
        try {
            const data = await boardManage.getSchoolsList(token);
            setAllSchools(data);
        } catch (err) {
            console.error(err);
        }
    }, [token]);

    const fetchCandidates = useCallback(async (q?: string) => {
        if (!token) return;
        setIsSearchingCandidates(true);
        try {
            const data = await boardManage.getSubManagerCandidates(boardId, token, q);
            setCandidates(data);
        } catch (err) {
            // 부관리자 후보 조회 실패 (OWNER가 아닌 경우 403)
        } finally {
            setIsSearchingCandidates(false);
        }
    }, [token, boardId]);

    const handleSubManagerSearchChange = (q: string) => {
        setSubManagerSearch(q);
        setSelectedCandidate('');
        if (subManagerSearchTimeout.current) clearTimeout(subManagerSearchTimeout.current);
        subManagerSearchTimeout.current = setTimeout(() => {
            fetchCandidates(q || undefined);
        }, 400);
    };

    const fetchReports = useCallback(async () => {
        if (!token) return;
        setReportsLoading(true);
        try {
            const data = await boardManage.getBoardReports(boardId, token, reportsPage, reportsStatus || undefined);
            setReports(data.reports);
            setReportsTotal(data.total);
        } catch (err) {
            console.error(err);
            if (err instanceof ApiError) alert(err.message);
        } finally {
            setReportsLoading(false);
        }
    }, [token, boardId, reportsPage, reportsStatus]);

    useEffect(() => {
        if (!isAuthLoading && user && token) {
            fetchBoard();
            fetchSchools();
        }
    }, [isAuthLoading, user, token, fetchBoard, fetchSchools]);

    useEffect(() => {
        if (isOwner && token) {
            fetchCandidates();
        }
    }, [isOwner, token, fetchCandidates]);

    useEffect(() => {
        if (activeTab === 'reports' && token) {
            fetchReports();
        }
    }, [activeTab, fetchReports]);


    // === Handlers ===

    const handleAddSchool = async (schoolId: number) => {
        if (!token) return;
        try {
            const res = await boardManage.addSchool(boardId, schoolId, token);
            alert(res.message);
            setSchoolSearch('');
            setShowSchoolDropdown(false);
            fetchBoard();
        } catch (err) {
            if (err instanceof ApiError) alert(err.message);
            else alert('학교 추가에 실패했습니다');
        }
    };

    const handleRemoveSchool = async (schoolId: number, schoolName: string) => {
        if (!token) return;
        if (!confirm(`${schoolName}을(를) 이 게시판에서 제거하시겠습니까?`)) return;
        try {
            const res = await boardManage.removeSchool(boardId, schoolId, token);
            alert(res.message);
            fetchBoard();
        } catch (err) {
            if (err instanceof ApiError) alert(err.message);
            else alert('학교 제거에 실패했습니다');
        }
    };

    const handleAddSubManager = async () => {
        if (!token || !selectedCandidate) return;
        try {
            const res = await boardManage.addSubManager(boardId, Number(selectedCandidate), token);
            alert(res.message);
            setSelectedCandidate('');
            fetchBoard();
            fetchCandidates();
        } catch (err) {
            if (err instanceof ApiError) alert(err.message);
            else alert('부관리자 임명에 실패했습니다');
        }
    };

    const handleRemoveSubManager = async (userId: number, email: string) => {
        if (!token) return;
        if (!confirm(`${email}의 부관리자 권한을 해제하시겠습니까?`)) return;
        try {
            const res = await boardManage.removeSubManager(boardId, userId, token);
            alert(res.message);
            fetchBoard();
            fetchCandidates();
        } catch (err) {
            if (err instanceof ApiError) alert(err.message);
            else alert('부관리자 해제에 실패했습니다');
        }
    };

    const handleResolveReport = async (reportId: number, newStatus: string) => {
        if (!token) return;

        const note = prompt('처리 메모를 입력하세요 (선택):');

        setResolvingId(reportId);
        setOpenReportId(null);
        try {
            const res = await boardManage.resolveBoardReport(boardId, reportId, newStatus, note, token);
            alert(res.message);
            fetchReports();
        } catch (err) {
            if (err instanceof ApiError) alert(err.message);
            else alert('신고 처리에 실패했습니다.');
        } finally {
            setResolvingId(null);
        }
    };

    const handleDeleteRequest = async () => {
        if (!token || !board) return;
        if (!confirm(`정말로 '${board.name}' 게시판의 삭제를 요청하시겠습니까? 관리자 승인 후 삭제됩니다.`)) return;

        try {
            const res = await boardManage.requestBoardDeletion(boardId, token);
            alert(res.message);
        } catch (err) {
            if (err instanceof ApiError) alert(err.message);
            else alert('삭제 요청에 실패했습니다');
        }
    };

    const handleUpdateSettings = async () => {
        if (!token) return;
        setIsUpdatingDesc(true);
        try {
            const res = await boardManage.updateBoard(boardId, { description: newDescription, hot_post_threshold: newThreshold }, token);
            alert(res.message);
            fetchBoard();
        } catch (err) {
            if (err instanceof ApiError) alert(err.message);
            else alert('설정 수정에 실패했습니다');
        } finally {
            setIsUpdatingDesc(false);
        }
    };

    const handleTransferOwnership = async () => {
        if (!token || !selectedOwnerCandidate) return;
        if (!confirm('정말로 소유권을 이전하시겠습니까? 이 작업은 되돌릴 수 없으며, 기존 소유자는 부관리자로 변경됩니다.')) return;

        try {
            const res = await boardManage.transferOwnership(boardId, Number(selectedOwnerCandidate), token);
            alert(res.message);
            setSelectedOwnerCandidate('');
            fetchBoard();
            fetchCandidates();
        } catch (err) {
            if (err instanceof ApiError) alert(err.message);
            else alert('소유권 이전에 실패했습니다');
        }
    };


    // === Loading / Error States ===

    if (isAuthLoading || loading) {
        return (
            <div className="container-app py-8 max-w-2xl mx-auto">
                <div className="skeleton h-4 w-24 mb-6" />
                <div className="card p-6 space-y-4">
                    <div className="skeleton h-7 w-48" />
                    <div className="skeleton h-4 w-64" />
                    <div className="skeleton h-20 w-full mt-4" />
                </div>
            </div>
        );
    }

    if (!user || !board) {
        return (
            <div className="container-app py-20 text-center">
                <div className="text-4xl mb-4">😶</div>
                <p className="text-gray-400">게시판을 찾을 수 없습니다</p>
                <Link href="/board-manage" className="btn btn-ghost mt-4">목록으로</Link>
            </div>
        );
    }

    const availableSchools = allSchools.filter(
        s => !board.accessible_schools.some(as => as.id === s.id)
    );

    const filteredSchools = availableSchools.filter(
        s => s.name.includes(schoolSearch) || s.short_name.includes(schoolSearch)
    );

    const ownerManager = board.managers.find(m => m.role === 'OWNER');
    const subManagers = board.managers.filter(m => m.role === 'SUB_MANAGER');

    return (
        <div className="container-app py-6 max-w-3xl mx-auto">
            {/* Header */}
            <div className="mb-6 animate-fade-in-up">
                <Link
                    href="/board-manage"
                    className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-bamboo-400 transition-colors mb-4"
                >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    게시판 관리 목록
                </Link>

                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-gray-100">{board.name}</h1>
                    {isOwner && <span className="badge badge-green">관리자</span>}
                    {isSubManager && <span className="badge badge-blue">부관리자</span>}
                </div>
                {board.description && (
                    <p className="text-gray-400 mt-1">{board.description}</p>
                )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border mb-6 animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
                <button
                    onClick={() => setActiveTab('general')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'general'
                        ? 'border-bamboo-400 text-bamboo-400'
                        : 'border-transparent text-gray-500 hover:text-gray-300'
                        }`}
                >
                    일반 설정
                </button>
                <button
                    onClick={() => setActiveTab('reports')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'reports'
                        ? 'border-bamboo-400 text-bamboo-400'
                        : 'border-transparent text-gray-500 hover:text-gray-300'
                        }`}
                >
                    신고 관리
                </button>
                {isOwner && (
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'settings'
                            ? 'border-bamboo-400 text-bamboo-400'
                            : 'border-transparent text-gray-500 hover:text-gray-300'
                            }`}
                    >
                        고급 설정
                    </button>
                )}
            </div>

            {/* TAB: General (Existing content) */}
            {activeTab === 'general' && (
                <div className="space-y-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>

                    {/* 접근 가능 학교 관리 */}
                    {board.board_type === 'GLOBAL' ? (
                        <div className="card">
                            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                                <h2 className="text-base font-bold text-gray-100 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-bamboo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
                                    </svg>
                                    접근 가능 학교
                                </h2>
                                <span className="badge badge-green">전체 (Global)</span>
                            </div>
                            <div className="p-6 text-gray-400 text-sm">
                                이 게시판은 모든 학교에서 접근 가능한 전체 게시판입니다. 학교별 접근 제한을 설정할 수 없습니다.
                            </div>
                        </div>
                    ) : (
                        <div className="card overflow-visible">
                            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                                <h2 className="text-base font-bold text-gray-100 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-bamboo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
                                    </svg>
                                    접근 가능 학교
                                </h2>
                                <span className="badge badge-gray">{board.accessible_schools.length}개</span>
                            </div>
                            <div className="p-6">
                                <div className="rounded-xl border border-border bg-surface-secondary p-3 min-h-[52px]">
                                    <div className="flex flex-wrap gap-2 items-center">
                                        {board.accessible_schools.map(school => {
                                            const isOwnerSchool = school.id === board.owner_school_id;
                                            return (
                                                <span
                                                    key={school.id}
                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${isOwnerSchool
                                                        ? 'bg-bamboo-500/15 text-bamboo-400 border border-bamboo-500/25'
                                                        : 'bg-surface-tertiary text-gray-300 border border-border'
                                                        }`}
                                                >
                                                    {school.short_name}
                                                    {isOwnerSchool && (
                                                        <span className="text-[9px] text-bamboo-500 font-bold">관리자 학교</span>
                                                    )}
                                                    {isOwner && !isOwnerSchool && (
                                                        <button
                                                            onClick={() => handleRemoveSchool(school.id, school.name)}
                                                            className="ml-0.5 text-gray-500 hover:text-red-400 transition-colors"
                                                        >
                                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </span>
                                            );
                                        })}

                                        {/* + 버튼 및 검색 드롭다운 */}
                                        {isOwner && (
                                            <div className="relative" ref={dropdownRef}>
                                                <button
                                                    onClick={() => setShowSchoolDropdown(!showSchoolDropdown)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-surface-tertiary text-gray-400 border border-dashed border-gray-600 hover:border-bamboo-500/50 hover:text-bamboo-400 transition-all"
                                                >
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                                    </svg>
                                                    학교 추가
                                                </button>

                                                {showSchoolDropdown && (
                                                    <div className="absolute left-0 top-full mt-2 w-64 rounded-xl border border-border bg-surface-elevated shadow-card z-50 animate-slide-down">
                                                        {/* 검색 */}
                                                        <div className="p-2 border-b border-border">
                                                            <input
                                                                type="text"
                                                                value={schoolSearch}
                                                                onChange={e => setSchoolSearch(e.target.value)}
                                                                className="w-full px-3 py-2 rounded-lg bg-surface-secondary text-sm text-gray-200 border border-border focus:border-bamboo-500/50 focus:outline-none placeholder-gray-600"
                                                                placeholder="학교 이름 검색..."
                                                                autoFocus
                                                            />
                                                        </div>

                                                        {/* 목록 */}
                                                        <div className="max-h-48 overflow-y-auto py-1">
                                                            {filteredSchools.length === 0 ? (
                                                                <div className="px-3 py-4 text-center text-xs text-gray-600">
                                                                    {schoolSearch ? '검색 결과가 없습니다' : '추가할 학교가 없습니다'}
                                                                </div>
                                                            ) : (
                                                                filteredSchools.map(school => (
                                                                    <button
                                                                        key={school.id}
                                                                        onClick={() => handleAddSchool(school.id)}
                                                                        className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-surface-hover transition-colors flex items-center justify-between"
                                                                    >
                                                                        <div>
                                                                            <span className="font-medium">{school.short_name}</span>
                                                                            <span className="text-xs text-gray-500 ml-1.5">{school.name}</span>
                                                                        </div>
                                                                        <svg className="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                                                        </svg>
                                                                    </button>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <p className="text-[11px] text-gray-600 mt-2 ml-1">
                                    게시판에 접근할 수 있는 학교를 관리할 수 있습니다.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* 관리자 관리 */}
                    <div className="card">
                        <div className="px-6 py-4 border-b border-border">
                            <h2 className="text-base font-bold text-gray-100 flex items-center gap-2">
                                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                                </svg>
                                관리자
                            </h2>
                        </div>
                        <div className="p-6 space-y-3">
                            {ownerManager && (
                                <div className="flex items-center justify-between p-3 bg-surface-secondary rounded-xl border border-border">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-bamboo-500/20 flex items-center justify-center">
                                            <svg className="w-4 h-4 text-bamboo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>
                                        </div>
                                        <div>
                                            <span className="text-sm font-medium text-gray-200">{ownerManager.email}</span>
                                            <span className="badge badge-green ml-2 text-[10px]">OWNER</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {subManagers.length > 0 && (
                                <>
                                    <div className="text-xs text-gray-500 font-medium mt-4 mb-2">부관리자</div>
                                    {subManagers.map(m => (
                                        <div key={m.user_id} className="flex items-center justify-between p-3 bg-surface-secondary rounded-xl border border-border">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                                                    <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                                                </div>
                                                <div>
                                                    <span className="text-sm font-medium text-gray-200">{m.email}</span>
                                                    <span className="badge badge-blue ml-2 text-[10px]">SUB</span>
                                                </div>
                                            </div>
                                            {isOwner && (
                                                <button onClick={() => handleRemoveSubManager(m.user_id, m.email)} className="text-red-400 hover:text-red-300 p-1" title="해제">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </>
                            )}

                            {/* 부관리자 추가 */}
                            {isOwner && (
                                <div className="mt-4 pt-4 border-t border-border">
                                    <p className="text-xs text-gray-500 mb-3">이메일로 검색하여 다른 학교 사용자도 부관리자로 임명할 수 있습니다.</p>
                                    <div className="flex gap-2 mb-2">
                                        <input
                                            type="text"
                                            value={subManagerSearch}
                                            onChange={e => handleSubManagerSearchChange(e.target.value)}
                                            className="input flex-1 text-sm py-1"
                                            placeholder="이메일로 사용자 검색..."
                                        />
                                        {isSearchingCandidates && <div className="spinner spinner-sm self-center" />}
                                    </div>
                                    {candidates.length > 0 && (
                                        <div className="mb-2">
                                            <select
                                                value={selectedCandidate}
                                                onChange={e => setSelectedCandidate(e.target.value ? Number(e.target.value) : '')}
                                                className="input w-full text-sm py-1"
                                                size={Math.min(candidates.length, 5)}
                                            >
                                                {candidates.map(c => (
                                                    <option key={c.user_id} value={c.user_id}>
                                                        {c.email}{c.nickname ? ` (${c.nickname})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    {subManagerSearch && candidates.length === 0 && !isSearchingCandidates && (
                                        <p className="text-xs text-gray-600 mb-2">검색 결과가 없습니다</p>
                                    )}
                                    <button onClick={handleAddSubManager} disabled={!selectedCandidate} className="btn btn-primary btn-sm">임명</button>
                                </div>
                            )}

                            {/* 소유권 위임 (OWNER/ADMIN ONLY) */}
                            {isOwner && (() => {
                                // 소유권 위임은 같은 학교 사용자만 (소유자의 학교 기준)
                                const sameSchoolCandidates = candidates.filter(c => c.school_id === board.owner_school_id);
                                return (
                                    <div className="mt-6 pt-4 border-t border-red-500/20">
                                        <p className="text-xs text-red-400 font-bold mb-1">⚠️ 소유권 위임</p>
                                        <p className="text-xs text-gray-500 mb-3">
                                            같은 학교 사용자에게 게시판 소유권을 영구적으로 이전합니다. {user?.role === 'ADMIN' ? '관리자에 의한 변경입니다.' : '본인은 부관리자로 변경됩니다.'}
                                        </p>
                                        <div className="flex gap-2">
                                            <select
                                                value={selectedOwnerCandidate}
                                                onChange={e => setSelectedOwnerCandidate(e.target.value ? Number(e.target.value) : '')}
                                                className="input flex-1 text-sm py-1 border-red-500/30 focus:border-red-500"
                                            >
                                                <option value="">위임 대상 선택...</option>
                                                {subManagers.filter(m => m.school_id === board.owner_school_id).length > 0 && (
                                                    <optgroup label="부관리자 (같은 학교)">
                                                        {subManagers.filter(m => m.school_id === board.owner_school_id).map(m => (
                                                            <option key={m.user_id} value={m.user_id}>{m.email} (부관리자)</option>
                                                        ))}
                                                    </optgroup>
                                                )}
                                                {sameSchoolCandidates.length > 0 && (
                                                    <optgroup label="새로운 후보 (같은 학교)">
                                                        {sameSchoolCandidates.map(c => (
                                                            <option key={c.user_id} value={c.user_id}>{c.email}{c.nickname ? ` (${c.nickname})` : ''}</option>
                                                        ))}
                                                    </optgroup>
                                                )}
                                            </select>
                                            <button
                                                onClick={handleTransferOwnership}
                                                disabled={!selectedOwnerCandidate}
                                                className="btn btn-secondary border-red-500/30 text-red-400 hover:bg-red-500/10 btn-sm"
                                            >
                                                위임
                                            </button>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: Reports */}
            {activeTab === 'reports' && (
                <div className="space-y-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                    <div className="flex items-center justify-between mb-2">
                        <select
                            value={reportsStatus}
                            onChange={(e) => setReportsStatus(e.target.value)}
                            className="input text-sm w-40"
                        >
                            <option value="">모든 상태</option>
                            <option value="PENDING">대기중</option>
                            <option value="REVIEWED">검토중</option>
                            <option value="RESOLVED">처리완료</option>
                            <option value="DISMISSED">반려</option>
                        </select>
                        <button onClick={fetchReports} className="btn btn-ghost btn-sm" title="새로고침">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                    </div>

                    {reportsLoading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="card p-4">
                                    <div className="skeleton h-5 w-32 mb-2" />
                                    <div className="skeleton h-4 w-full" />
                                </div>
                            ))}
                        </div>
                    ) : reports.length > 0 ? (
                        <div className="space-y-3">
                            {reports.map(report => (
                                <div key={report.id} className="card p-4 hover:border-bamboo-400/30 transition-colors overflow-visible">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={`badge px-2 py-0.5 text-xs border ${STATUS_COLORS[report.status] || ''}`}>
                                                    {STATUS_LABELS[report.status] || report.status}
                                                </span>
                                                <span className="text-sm font-semibold text-gray-200">
                                                    {report.reason}
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                    {new Date(report.created_at || '').toLocaleDateString()}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-400 mb-2">
                                                {report.description || '내용 없음'}
                                            </p>
                                            <div className="flex items-center gap-2 text-xs text-gray-600">
                                                <span>대상: {report.target_type} #{report.target_id}</span>
                                                {report.resolution_note && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="text-gray-500">메모: {report.resolution_note}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="relative">
                                                <button
                                                    onClick={() => setOpenReportId(openReportId === report.id ? null : report.id)}
                                                    className="btn btn-secondary btn-sm text-xs gap-1.5 min-w-[90px] justify-between"
                                                    disabled={resolvingId === report.id}
                                                >
                                                    {resolvingId === report.id ? (
                                                        <span className="opacity-50">처리중...</span>
                                                    ) : (
                                                        <>
                                                            <span>{STATUS_LABELS[report.status] || report.status}</span>
                                                            <svg className={`w-3 h-3 text-gray-500 transition-transform ${openReportId === report.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                                            </svg>
                                                        </>
                                                    )}
                                                </button>

                                                {openReportId === report.id && (
                                                    <>
                                                        <div className="fixed inset-0 z-10" onClick={() => setOpenReportId(null)} />
                                                        <div className="absolute right-0 mt-1 w-32 bg-surface-elevated border border-border rounded-lg shadow-xl z-20 overflow-hidden animate-fade-in-up origin-top-right">
                                                            {Object.entries(STATUS_LABELS).map(([status, label]) => (
                                                                <button
                                                                    key={status}
                                                                    onClick={() => handleResolveReport(report.id, status)}
                                                                    className={`w-full text-left px-3 py-2 text-xs hover:bg-surface-hover transition-colors ${report.status === status ? 'text-bamboo-400 font-medium bg-bamboo-500/5' : 'text-gray-300'
                                                                        }`}
                                                                >
                                                                    {label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                            {report.post_id && (
                                                <Link
                                                    href={`/boards/${boardId}/posts/${report.post_id}`}
                                                    target="_blank"
                                                    className="btn btn-ghost btn-sm text-xs text-bamboo-400 hover:text-bamboo-300"
                                                >
                                                    글 이동
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-500 card bg-surface-secondary/50 border-dashed">
                            신고 내역이 없습니다
                        </div>
                    )}
                </div>
            )}

            {/* TAB: Settings */}
            {activeTab === 'settings' && isOwner && (
                <div className="space-y-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>

                    {/* 일반 정보 수정 */}
                    <div className="card p-6">
                        <h2 className="text-base font-bold text-gray-100 mb-4">게시판 정보 설정</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-2">게시판 이름</label>
                                <input
                                    type="text"
                                    value={board.name}
                                    className="input w-full bg-surface-tertiary text-gray-500 cursor-not-allowed"
                                    disabled
                                    title="게시판 이름은 변경할 수 없습니다"
                                />
                                <p className="text-[11px] text-yellow-500/80 mt-1.5 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    게시판 이름은 생성 후 변경할 수 없습니다
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-2">설명</label>
                                <textarea
                                    value={newDescription}
                                    onChange={(e) => setNewDescription(e.target.value)}
                                    className="input w-full h-24 resize-none"
                                    placeholder="예: 영재학교 연합 게시판"
                                    maxLength={100}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-2">인기글 요구 추천수</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={newThreshold}
                                    onChange={(e) => setNewThreshold(Number(e.target.value))}
                                    className="input w-full"
                                />
                                <p className="text-[11px] text-gray-500 mt-1">
                                    설정한 추천 수를 초과하면 인기 게시글로 표시됩니다 (기본값: 5).
                                </p>
                            </div>

                            <div className="flex justify-end">
                                <button
                                    onClick={handleUpdateSettings}
                                    disabled={isUpdatingDesc}
                                    className="btn btn-primary"
                                >
                                    {isUpdatingDesc ? '저장 중...' : '저장하기'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="card border-red-500/20 bg-red-500/5">
                        <div className="p-6">
                            <h2 className="text-lg font-bold text-red-500 mb-2">위험 구역</h2>
                            <p className="text-gray-400 text-sm mb-6">
                                게시판을 삭제하면 복구할 수 없을 수도 있습니다. 관리자의 승인이 필요합니다.
                            </p>

                            <button
                                onClick={handleDeleteRequest}
                                className="btn bg-red-500/10 hover:bg-red-500/20 text-red-500 border-red-500/20 w-full sm:w-auto"
                            >
                                게시판 삭제 요청
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
