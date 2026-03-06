/**
 * SWR fetch hook – wraps the Bamboo API client with SWR caching.
 *
 * Benefits:
 * - 5-minute deduplication: navigating away and back won't re-fetch
 * - Stale-while-revalidate: shows cached data instantly, revalidates in background
 * - No focus revalidation: prevents unnecessary refetches when switching tabs
 */
import useSWR, { SWRConfiguration, KeyedMutator } from 'swr';

/** Default SWR options – aggressive caching to minimize API calls. */
const DEFAULT_SWR_OPTIONS: SWRConfiguration = {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 5 * 60 * 1000, // 5 minutes
    errorRetryCount: 2,
};

interface UseSWRFetchResult<T> {
    data: T | undefined;
    error: Error | undefined;
    isLoading: boolean;
    mutate: KeyedMutator<T>;
}

/**
 * Generic SWR wrapper.
 *
 * @param key  Unique cache key (set to `null` to skip fetching)
 * @param fetcher  Async function returning data
 * @param options  Optional SWR config overrides
 */
export function useSWRFetch<T>(
    key: string | null,
    fetcher: () => Promise<T>,
    options?: SWRConfiguration,
): UseSWRFetchResult<T> {
    const { data, error, isLoading, mutate } = useSWR<T>(
        key,
        fetcher,
        { ...DEFAULT_SWR_OPTIONS, ...options },
    );

    return { data, error, isLoading, mutate };
}
