'use client';

import BoardsLayout from '@/components/BoardsLayout';

export default function BoardsSectionLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <BoardsLayout>{children}</BoardsLayout>;
}
