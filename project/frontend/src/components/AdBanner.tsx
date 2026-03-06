'use client';

/**
 * AdBanner — 광고 자리 Placeholder
 *
 * 실제 광고 네트워크(AdSense / AdFit) 연동 시 이 컴포넌트 내부만 교체하면 됩니다.
 *
 * variant:
 *  - 'sidebar'   : PC 사이드바용  세로 배너  (160×600)
 *  - 'banner'    : 모바일 상단용  가로 배너  (320×50)
 *  - 'feed'      : 게시글 목록 사이  인피드형  (전체 너비 × 80px)
 */

type AdVariant = 'sidebar' | 'banner' | 'feed';

interface AdBannerProps {
    variant: AdVariant;
    className?: string;
}

const configs: Record<AdVariant, { width: string; height: string; label: string }> = {
    sidebar: { width: 'w-full', height: 'h-[600px]', label: '광고 (160×600)' },
    banner: { width: 'w-full', height: 'h-[50px]', label: '광고 (320×50)' },
    feed: { width: 'w-full', height: 'h-[80px]', label: '광고' },
};

export default function AdBanner({ variant, className = '' }: AdBannerProps) {
    const { width, height, label } = configs[variant];

    return (
        <div
            className={`${width} ${height} ${className} flex items-center justify-center rounded-xl border border-dashed border-border bg-surface-secondary/40 overflow-hidden select-none`}
            aria-label="광고"
        >
            {/* ── 실제 광고 코드는 여기에 삽입 ── */}
            {/* 예시 (AdFit):
        <ins
          className="kakao_ad_area"
          style={{ display: 'none' }}
          data-ad-unit="DAN-XXXXXXXXXX"
          data-ad-width="xxx"
          data-ad-height="xxx"
        />
      */}

            {/* Placeholder UI */}
            <div className="flex flex-col items-center gap-1 pointer-events-none">
                <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                        d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
                    />
                </svg>
                <span className="text-[10px] text-gray-700 font-medium">{label}</span>
            </div>
        </div>
    );
}
