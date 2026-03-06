'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { boardManage, ApiError, SchoolListItem, BoardRequestResponse, BoardManageInfo } from '@/lib/api';
import Link from 'next/link';

export default function BoardManagePage() {
    const { user, token, isLoading: isAuthLoading } = useAuth();
    const [activeTab, setActiveTab] = useState<'request' | 'my-requests' | 'managed'>('request');

    // 신청 폼
    const [schools, setSchools] = useState<SchoolListItem[]>([]);
    const [selectedSchools, setSelectedSchools] = useState<SchoolListItem[]>([]);
    const [boardName, setBoardName] = useState('');
    const [boardDescription, setBoardDescription] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // 내 신청 목록
    const [myRequests, setMyRequests] = useState<BoardRequestResponse[]>([]);

    // 내가 관리하는 게시판
    const [managedBoards, setManagedBoards] = useState<BoardManageInfo[]>([]);

    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);

    // 드롭다운 외부 클릭 닫기
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchSchools = useCallback(async () => {
        if (!token) return;
        try {
            const data = await boardManage.getSchoolsList(token);
            setSchools(data);
        } catch (err) {
            console.error(err);
        }
    }, [token]);

    const fetchMyRequests = useCallback(async () => {
        if (!token) return;
        try {
            const data = await boardManage.getMyRequests(token);
            setMyRequests(data);
        } catch (err) {
            console.error(err);
        }
    }, [token]);

    const fetchManagedBoards = useCallback(async () => {
        if (!token) return;
        try {
            const data = await boardManage.getManagedBoards(token);
            setManagedBoards(data);
        } catch (err) {
            console.error(err);
        }
    }, [token]);

    useEffect(() => {
        if (!isAuthLoading && user && token) {
            Promise.all([fetchSchools(), fetchMyRequests(), fetchManagedBoards()]).then(() => {
                setPageLoading(false);
            });
        }
    }, [isAuthLoading, user, token, fetchSchools, fetchMyRequests, fetchManagedBoards]);

    // 사용자 학교 자동 추가
    useEffect(() => {
        if (schools.length > 0 && user?.school_id && selectedSchools.length === 0) {
            const mySchool = schools.find(s => s.id === user.school_id);
            if (mySchool) {
                setSelectedSchools([mySchool]);
            }
        }
    }, [schools, user, selectedSchools.length]);

    const handleSubmitRequest = async () => {
        if (!token) return;
        if (!boardName.trim()) {
            alert('게시판 이름을 입력해주세요');
            return;
        }
        if (selectedSchools.length === 0) {
            alert('최소 1개의 학교를 선택해주세요');
            return;
        }

        setLoading(true);
        try {
            await boardManage.createRequest({
                board_name: boardName,
                board_description: boardDescription || undefined,
                school_ids: selectedSchools.map(s => s.id),
            }, token);
            alert('게시판 신청이 완료되었습니다. 관리자 승인을 기다려주세요.');
            setBoardName('');
            setBoardDescription('');
            // 다시 내 학교만 선택
            const mySchool = schools.find(s => s.id === user?.school_id);
            setSelectedSchools(mySchool ? [mySchool] : []);
            fetchMyRequests();
            setActiveTab('my-requests');
        } catch (err) {
            if (err instanceof ApiError) {
                alert(err.message);
            } else {
                alert('신청에 실패했습니다');
            }
        } finally {
            setLoading(false);
        }
    };

    const addSchool = (school: SchoolListItem) => {
        if (!selectedSchools.some(s => s.id === school.id)) {
            setSelectedSchools(prev => [...prev, school]);
        }
        setSearchQuery('');
        setIsDropdownOpen(false);
    };

    const removeSchool = (schoolId: number) => {
        // 내 학교는 제거 불가
        if (schoolId === user?.school_id) return;
        setSelectedSchools(prev => prev.filter(s => s.id !== schoolId));
    };

    const filteredSchools = schools
        .filter(s => !selectedSchools.some(sel => sel.id === s.id))
        .filter(s =>
            searchQuery === '' ||
            s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.short_name.toLowerCase().includes(searchQuery.toLowerCase())
        );

    const statusBadge = (s: string) => {
        switch (s) {
            case 'PENDING': return <span className="badge bg-yellow-400/10 text-yellow-400">대기중</span>;
            case 'APPROVED': return <span className="badge badge-green">승인됨</span>;
            case 'REJECTED': return <span className="badge bg-red-400/10 text-red-400">거절됨</span>;
            default: return <span className="badge">{s}</span>;
        }
    };

    if (isAuthLoading || pageLoading) {
        return (
            <div className="container-app py-10">
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="card p-6">
                            <div className="skeleton h-5 w-40 mb-3" />
                            <div className="skeleton h-3 w-60 mb-4" />
                            <div className="skeleton h-8 w-full" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="container-app py-16 text-center">
                <p className="text-gray-500 text-sm">로그인이 필요합니다</p>
            </div>
        );
    }

    const tabs = [
        { key: 'request' as const, label: '신규 신청', icon: '✏️' },
        { key: 'my-requests' as const, label: `내 신청`, count: myRequests.length, icon: '📋' },
        { key: 'managed' as const, label: `관리 중`, count: managedBoards.length, icon: '⚙️' },
    ];

    return (
        <div className="container-app py-8">
            {/* Header */}
            <div className="mb-8 animate-fade-in-up">
                <h1 className="text-2xl font-bold text-gray-100">게시판 관리</h1>
                <p className="text-sm text-gray-500 mt-1">새로운 게시판을 신청하거나, 관리 중인 게시판을 설정하세요</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 rounded-xl bg-surface-secondary border border-border mb-6 animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === tab.key
                            ? 'bg-bamboo-500 text-white shadow-sm'
                            : 'text-gray-500 hover:text-gray-300 hover:bg-surface-hover'
                            }`}
                    >
                        <span className="text-xs">{tab.icon}</span>
                        <span>{tab.label}</span>
                        {tab.count !== undefined && tab.count > 0 && (
                            <span className={`text-[10px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full font-bold ${activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-surface-tertiary text-gray-400'
                                }`}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* === 신규 신청 탭 === */}
            {activeTab === 'request' && (
                <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                    <div className="card p-6 space-y-6">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-bamboo-500/10 flex items-center justify-center">
                                <span className="text-sm">📝</span>
                            </div>
                            <div>
                                <h2 className="text-[15px] font-semibold text-gray-100">새 게시판 신청</h2>
                                <p className="text-xs text-gray-500">관리자 승인 후 게시판이 생성됩니다</p>
                            </div>
                        </div>

                        {/* 게시판 이름 */}
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-2">
                                게시판 이름 <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                value={boardName}
                                onChange={e => setBoardName(e.target.value)}
                                className="input w-full"
                                placeholder="예: 영재학교 연합 게시판"
                                maxLength={100}
                            />
                            <p className="text-[11px] text-yellow-500/80 mt-1.5 flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                게시판 이름은 생성 후 변경할 수 없습니다
                            </p>
                        </div>

                        {/* 설명 */}
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-2">설명 (선택)</label>
                            <textarea
                                value={boardDescription}
                                onChange={e => setBoardDescription(e.target.value)}
                                className="input w-full h-20 resize-none"
                                placeholder="게시판에 대한 간단한 설명을 입력하세요"
                            />
                        </div>

                        {/* 접근 가능 학교 */}
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-2">
                                접근 가능 학교 <span className="text-red-400">*</span>
                            </label>

                            <div className="rounded-xl border border-border bg-surface-secondary p-3 min-h-[52px]">
                                {/* 선택된 학교 칩 */}
                                <div className="flex flex-wrap gap-2 items-center">
                                    {selectedSchools.map(school => {
                                        const isMySchool = school.id === user.school_id;
                                        return (
                                            <span
                                                key={school.id}
                                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${isMySchool
                                                    ? 'bg-bamboo-500/15 text-bamboo-400 border border-bamboo-500/25'
                                                    : 'bg-surface-tertiary text-gray-300 border border-border'
                                                    }`}
                                            >
                                                {school.short_name}
                                                {isMySchool && (
                                                    <span className="text-[9px] text-bamboo-500 font-bold">내 학교</span>
                                                )}
                                                {!isMySchool && (
                                                    <button
                                                        onClick={() => removeSchool(school.id)}
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
                                    <div className="relative" ref={dropdownRef}>
                                        <button
                                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-surface-tertiary text-gray-400 border border-dashed border-gray-600 hover:border-bamboo-500/50 hover:text-bamboo-400 transition-all"
                                        >
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                            </svg>
                                            학교 추가
                                        </button>

                                        {isDropdownOpen && (
                                            <div className="absolute left-0 top-full mt-2 w-64 rounded-xl border border-border bg-surface-elevated shadow-card z-50 animate-slide-down">
                                                {/* 검색 */}
                                                <div className="p-2 border-b border-border">
                                                    <input
                                                        type="text"
                                                        value={searchQuery}
                                                        onChange={e => setSearchQuery(e.target.value)}
                                                        className="w-full px-3 py-2 rounded-lg bg-surface-secondary text-sm text-gray-200 border border-border focus:border-bamboo-500/50 focus:outline-none placeholder-gray-600"
                                                        placeholder="학교 이름 검색..."
                                                        autoFocus
                                                    />
                                                </div>

                                                {/* 목록 */}
                                                <div className="max-h-48 overflow-y-auto py-1">
                                                    {filteredSchools.length === 0 ? (
                                                        <div className="px-3 py-4 text-center text-xs text-gray-600">
                                                            {searchQuery ? '검색 결과가 없습니다' : '추가할 학교가 없습니다'}
                                                        </div>
                                                    ) : (
                                                        filteredSchools.map(school => (
                                                            <button
                                                                key={school.id}
                                                                onClick={() => addSchool(school)}
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
                                </div>
                            </div>
                            <p className="text-[11px] text-gray-600 mt-1.5">내 학교는 자동 포함됩니다. 다른 학교를 추가하려면 + 버튼을 누르세요.</p>
                        </div>

                        {/* 제출 버튼 */}
                        <button
                            onClick={handleSubmitRequest}
                            disabled={loading || !boardName.trim()}
                            className="btn btn-primary w-full"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <div className="spinner w-4 h-4" />
                                    신청 중...
                                </span>
                            ) : '게시판 신청하기'}
                        </button>
                    </div>
                </div>
            )}

            {/* === 내 신청 목록 탭 === */}
            {activeTab === 'my-requests' && (
                <div className="space-y-3 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                    {myRequests.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="w-16 h-16 rounded-2xl bg-surface-secondary border border-border flex items-center justify-center mx-auto mb-4">
                                <span className="text-3xl">📋</span>
                            </div>
                            <p className="text-gray-500 text-sm">아직 신청한 게시판이 없습니다</p>
                            <button
                                onClick={() => setActiveTab('request')}
                                className="text-bamboo-400 text-sm mt-2 hover:underline"
                            >
                                새 게시판 신청하기 →
                            </button>
                        </div>
                    ) : (
                        myRequests.map((req, i) => (
                            <div key={req.id} className="card p-5 animate-fade-in-up" style={{ animationDelay: `${0.1 + i * 0.05}s` }}>
                                <div className="flex items-start justify-between mb-3">
                                    <h3 className="font-semibold text-gray-100 text-[15px]">{req.board_name}</h3>
                                    {statusBadge(req.status)}
                                </div>
                                {req.board_description && (
                                    <p className="text-sm text-gray-500 mb-3">{req.board_description}</p>
                                )}
                                <div className="flex flex-wrap gap-1.5 mb-3">
                                    {req.school_names.map((name, idx) => (
                                        <span key={idx} className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-surface-tertiary text-gray-400">
                                            {name}
                                        </span>
                                    ))}
                                </div>
                                {req.admin_note && (
                                    <div className="p-2.5 rounded-lg bg-surface-tertiary border border-border mb-3">
                                        <p className="text-xs text-gray-400">
                                            <span className="text-gray-500 font-medium">관리자 메모:</span> {req.admin_note}
                                        </p>
                                    </div>
                                )}
                                <p className="text-[11px] text-gray-600">
                                    {new Date(req.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                                </p>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* === 관리 중인 게시판 탭 === */}
            {activeTab === 'managed' && (
                <div className="space-y-3 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                    {managedBoards.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="w-16 h-16 rounded-2xl bg-surface-secondary border border-border flex items-center justify-center mx-auto mb-4">
                                <span className="text-3xl">⚙️</span>
                            </div>
                            <p className="text-gray-500 text-sm">관리 중인 게시판이 없습니다</p>
                            <p className="text-gray-600 text-xs mt-1">게시판을 신청하고 승인 받으면 여기에 표시됩니다</p>
                        </div>
                    ) : (
                        managedBoards.map((board, i) => (
                            <Link
                                key={board.id}
                                href={`/board-manage/${board.id}`}
                                className="card card-interactive p-5 block animate-fade-in-up"
                                style={{ animationDelay: `${0.1 + i * 0.05}s` }}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="min-w-0 flex-1">
                                        <h3 className="font-semibold text-gray-100 text-[15px]">{board.name}</h3>
                                        {board.description && (
                                            <p className="text-sm text-gray-500 mt-1 line-clamp-1">{board.description}</p>
                                        )}
                                        <div className="flex flex-wrap gap-1.5 mt-3">
                                            {board.accessible_schools.map(s => (
                                                <span
                                                    key={s.id}
                                                    className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-bamboo-500/10 text-bamboo-400"
                                                >
                                                    {s.short_name}
                                                </span>
                                            ))}
                                        </div>
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
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
