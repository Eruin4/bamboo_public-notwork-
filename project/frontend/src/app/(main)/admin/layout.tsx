'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { user, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && (!user || user.role !== 'ADMIN')) {
            router.replace('/');
        }
    }, [user, isLoading, router]);

    if (isLoading || !user || user.role !== 'ADMIN') {
        return (
            <div className="container-app py-20 text-center">
                <div className="spinner spinner-lg mx-auto mb-4" />
                <p className="text-gray-500">권한 확인 중...</p>
            </div>
        );
    }

    const tabs = [
        { name: '학교 관리', href: '/admin/schools' },
        { name: '게시판 신청', href: '/admin/board-requests' },
        { name: '도메인 신청', href: '/admin/domain-requests' },
        { name: '밤부콘 신청', href: '/admin/con-requests' },
    ];

    return (
        <div className="container-app py-8 max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-100 mb-6">관리자 페이지</h1>

            <div className="flex border-b border-border mb-8 overflow-x-auto">
                {tabs.map((tab) => {
                    const isActive = pathname.startsWith(tab.href);
                    return (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${isActive
                                ? 'border-bamboo-500 text-bamboo-400'
                                : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-700'
                                }`}
                        >
                            {tab.name}
                        </Link>
                    );
                })}
            </div>

            {children}
        </div>
    );
}
