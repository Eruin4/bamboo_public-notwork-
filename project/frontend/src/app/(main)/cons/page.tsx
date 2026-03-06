'use client';

import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import { cons, ConPackResponse, ConPackDetailResponse, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/utils';

type Tab = 'store' | 'my-requests' | 'request';

export default function ConStorePage() {
    const { token } = useAuth();
    const [tab, setTab] = useState<Tab>('store');

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-100">밤부콘 스토어</h1>
            </div>

            {/* 탭 */}
            <div className="flex gap-1 border-b border-border">
                {([
                    ['store', '스토어'],
                    ['my-requests', '내 신청'],
                    ['request', '밤부콘 신청'],
                ] as [Tab, string][]).map(([key, label]) => (
                    <button
                        key={key}
                        onClick={() => setTab(key)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === key ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {tab === 'store' && <ConStoreTab />}
            {tab === 'my-requests' && <MyRequestsTab />}
            {tab === 'request' && <ConRequestTab onSuccess={() => setTab('my-requests')} />}
        </div>
    );
}


// ─────────────────────────────────────────────
// 스토어 탭
// ─────────────────────────────────────────────
function ConStoreTab() {
    const { token, user } = useAuth();
    const [packs, setPacks] = useState<ConPackResponse[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedPack, setSelectedPack] = useState<ConPackDetailResponse | null>(null);
    const [processingId, setProcessingId] = useState<number | null>(null);
    const [myPackIds, setMyPackIds] = useState<Set<number>>(new Set());

    const loadMyPacks = async () => {
        if (!token) return;
        try {
            const my = await cons.getMyConPacks(token);
            setMyPackIds(new Set(my.map(p => p.id)));
        } catch { /* ignore */ }
    };

    const loadPacks = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const data = await cons.listConPacks(token, page, search || undefined);
            setPacks(data.packs);
            setTotal(data.total);
        } catch { /* ignore */ }
        finally { setLoading(false); }
    };

    useEffect(() => { loadMyPacks(); }, [token]);
    useEffect(() => { loadPacks(); }, [token, page, search]);

    const handlePackClick = async (pack: ConPackResponse) => {
        if (!token) return;
        try {
            const detail = await cons.getConPack(pack.id, token);
            setSelectedPack(detail);
        } catch { /* ignore */ }
    };

    const handleAddRemove = async (packId: number, isOwned: boolean) => {
        if (!token) return;
        setProcessingId(packId);
        try {
            if (isOwned) {
                await cons.removeFromInventory(packId, token);
                setMyPackIds(prev => { const s = new Set(prev); s.delete(packId); return s; });
            } else {
                await cons.addToInventory(packId, token);
                setMyPackIds(prev => new Set([...prev, packId]));
            }
        } catch (e) {
            alert(e instanceof ApiError ? e.message : '오류가 발생했습니다');
        } finally { setProcessingId(null); }
    };

    const handleDelete = async (packId: number) => {
        if (!token) return;
        if (!confirm('이 밤부콘을 완전히 삭제하시겠습니까?')) return;
        setProcessingId(packId);
        try {
            await cons.deletePack(packId, token);
            alert('삭제되었습니다.');
            setSelectedPack(null);
            loadPacks();
            loadMyPacks();
        } catch (e) {
            alert(e instanceof ApiError ? e.message : '삭제 중 오류가 발생했습니다');
        } finally { setProcessingId(null); }
    };

    return (
        <div className="space-y-4">
            <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="밤부콘 이름 검색..."
                className="input w-full max-w-xs"
            />

            {loading ? (
                <div className="py-20 text-center"><div className="spinner spinner-lg mx-auto" /></div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {packs.map(pack => {
                        const owned = myPackIds.has(pack.id);
                        return (
                            <div key={pack.id} className="card p-3 space-y-2 hover:border-primary/50 transition-all cursor-pointer group">
                                {/* 썸네일 */}
                                <div
                                    className="aspect-square bg-surface rounded-lg overflow-hidden"
                                    onClick={() => handlePackClick(pack)}
                                >
                                    {pack.thumbnail_url ? (
                                        <img src={pack.thumbnail_url} alt={pack.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-500">
                                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                                <p className="font-medium text-sm text-gray-200 truncate">{pack.name}</p>
                                <p className="text-xs text-gray-500">{pack.item_count}개</p>
                                <button
                                    onClick={() => handleAddRemove(pack.id, owned)}
                                    disabled={processingId === pack.id}
                                    className={`w-full btn btn-sm ${owned ? 'btn-secondary text-red-400' : 'btn-primary'}`}
                                >
                                    {processingId === pack.id ? '...' : owned ? '보관함에서 제거' : '+ 보관함에 추가'}
                                </button>
                            </div>
                        );
                    })}
                    {packs.length === 0 && (
                        <div className="col-span-full py-16 text-center text-gray-500">밤부콘이 없습니다.</div>
                    )}
                </div>
            )}

            {/* 페이지네이션 */}
            <div className="flex justify-center gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn btn-secondary btn-sm">이전</button>
                <span className="px-4 py-1 text-gray-400 text-sm flex items-center">{page} / {Math.ceil(total / 20) || 1}</span>
                <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)} className="btn btn-secondary btn-sm">다음</button>
            </div>

            {/* 상세 모달 */}
            {selectedPack && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedPack(null)}>
                    <div className="card max-w-lg w-full max-h-[80vh] overflow-y-auto p-6 space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-xl font-bold text-gray-100">{selectedPack.name}</h2>
                                {selectedPack.description && <p className="text-gray-400 text-sm mt-1">{selectedPack.description}</p>}
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
                        <button
                            onClick={() => handleAddRemove(selectedPack.id, myPackIds.has(selectedPack.id))}
                            disabled={processingId === selectedPack.id}
                            className={`w-full btn ${myPackIds.has(selectedPack.id) ? 'btn-secondary text-red-400' : 'btn-primary'}`}
                        >
                            {myPackIds.has(selectedPack.id) ? '보관함에서 제거' : '+ 보관함에 추가'}
                        </button>
                        {user && selectedPack.uploader_id === user.id && (
                            <button
                                onClick={() => handleDelete(selectedPack.id)}
                                disabled={processingId === selectedPack.id}
                                className="w-full btn btn-secondary text-red-500 mt-2"
                            >
                                이 밤부콘 완전히 삭제하기
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}


// ─────────────────────────────────────────────
// 내 신청 탭
// ─────────────────────────────────────────────
function MyRequestsTab() {
    const { token } = useAuth();
    const [packs, setPacks] = useState<ConPackResponse[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!token) return;
        (async () => {
            setLoading(true);
            try {
                const data = await cons.getMyConRequests(token);
                setPacks(data.packs);
            } catch { /* ignore */ }
            finally { setLoading(false); }
        })();
    }, [token]);

    const handleDelete = async (packId: number) => {
        if (!token) return;
        if (!confirm('정말 자신이 신청한 이 밤부콘을 삭제하시겠습니까?')) return;
        try {
            await cons.deletePack(packId, token);
            alert('삭제되었습니다.');
            setPacks(packs.filter(p => p.id !== packId));
        } catch (e) {
            alert(e instanceof ApiError ? e.message : '삭제 중 오류가 발생했습니다');
        }
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

    if (loading) return <div className="py-20 text-center"><div className="spinner spinner-lg mx-auto" /></div>;
    if (packs.length === 0) return <div className="py-16 text-center text-gray-500">신청 내역이 없습니다.</div>;

    return (
        <div className="space-y-3">
            {packs.map(p => (
                <div key={p.id} className="card p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-surface flex-shrink-0">
                        {p.thumbnail_url && <img src={p.thumbnail_url} alt={p.name} className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-200 truncate">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.item_count}개 · {formatDate(p.created_at)}</p>
                        {p.admin_note && <p className="text-xs text-gray-400 mt-1">메모: {p.admin_note}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                        {statusBadge(p.status)}
                        <button
                            onClick={() => handleDelete(p.id)}
                            className="bg-red-500/10 text-red-400 hover:bg-red-500/20 px-2 py-1 rounded text-xs transition-colors"
                        >
                            삭제
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}


// ─────────────────────────────────────────────
// 신청 탭
// ─────────────────────────────────────────────
function ConRequestTab({ onSuccess }: { onSuccess: () => void }) {
    const { token } = useAuth();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [uploadedItems, setUploadedItems] = useState<{ file_id: number; image_url: string }[]>([]);
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (!token || files.length === 0) return;

        if (uploadedItems.length + files.length > 50) {
            alert('밤부콘은 최대 50개입니다');
            return;
        }

        setUploading(true);
        for (const file of files) {
            try {
                const result = await cons.uploadConImage(file, token);
                setUploadedItems(prev => [...prev, result]);
            } catch (e) {
                alert(`${file.name}: ${e instanceof ApiError ? e.message : '업로드 실패'}`);
            }
        }
        setUploading(false);
        // 파일 input 초기화 (같은 파일 다시 선택 가능)
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleRemove = (index: number) => {
        setUploadedItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!token) return;
        if (!name.trim()) { alert('밤부콘 이름을 입력하세요'); return; }
        if (uploadedItems.length === 0) { alert('콘 이미지를 1개 이상 추가하세요'); return; }

        setSubmitting(true);
        try {
            await cons.createConPack(
                name.trim(),
                description.trim() || null,
                uploadedItems.map(i => i.file_id),
                token
            );
            alert('신청이 완료되었습니다. 전체 게시판 관리자의 승인 후 등록됩니다.');
            onSuccess();
        } catch (e) {
            alert(e instanceof ApiError ? e.message : '오류가 발생했습니다');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="max-w-lg space-y-6">
            <div className="card p-6 space-y-4">
                <h2 className="font-bold text-gray-200">밤부콘 정보</h2>

                <div className="space-y-1">
                    <label className="text-sm text-gray-400">밤부콘 이름 <span className="text-red-400">*</span></label>
                    <input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="예: 귀여운 토끼 콘"
                        className="input w-full"
                        maxLength={100}
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-sm text-gray-400">설명 (선택)</label>
                    <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="밤부콘에 대한 설명..."
                        className="input w-full h-20 resize-none"
                        maxLength={500}
                    />
                </div>
            </div>

            <div className="card p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="font-bold text-gray-200">콘 이미지 <span className="text-gray-500 text-sm font-normal">({uploadedItems.length}/50)</span></h2>
                    <p className="text-xs text-gray-500">이미지는 자동으로 100×100px로 변환됩니다</p>
                </div>

                {/* 이미지 그리드 */}
                <div className="grid grid-cols-5 gap-2">
                    {uploadedItems.map((item, i) => (
                        <div key={item.file_id} className="relative aspect-square group">
                            <img src={item.image_url} alt="" className="w-full h-full object-cover rounded-lg" />
                            <button
                                type="button"
                                onClick={() => handleRemove(i)}
                                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                ×
                            </button>
                        </div>
                    ))}

                    {/* 추가 버튼 */}
                    {uploadedItems.length < 50 && (
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="aspect-square border-2 border-dashed border-border rounded-lg flex items-center justify-center text-gray-500 hover:border-primary hover:text-primary transition-colors text-2xl"
                        >
                            {uploading ? <div className="spinner" /> : '+'}
                        </button>
                    )}
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                />
            </div>

            <button
                onClick={handleSubmit}
                disabled={submitting || uploadedItems.length === 0 || !name.trim()}
                className="btn btn-primary w-full"
            >
                {submitting ? '신청 중...' : '밤부콘 신청'}
            </button>

            <p className="text-xs text-gray-500 text-center">
                신청 후 <strong className="text-gray-400">전체 게시판 관리자</strong>의 검토를 거쳐 승인됩니다.
            </p>
        </div>
    );
}
