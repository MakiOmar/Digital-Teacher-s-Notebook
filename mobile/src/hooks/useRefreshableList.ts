import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";

/**
 * Stable list loader: skeleton only on first empty load; pull-to-refresh
 * keeps previous rows visible. Fetcher is read from a ref so callers can
 * change it without recreating `reload`.
 */
export function useRefreshableList<T>(fetcher: () => Promise<T[]>) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoaded = useRef(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const reload = useCallback(async () => {
    const showSkeleton = !hasLoaded.current;
    if (showSkeleton) setLoading(true);
    else setRefreshing(true);
    try {
      const next = await fetcherRef.current();
      setData(next);
      hasLoaded.current = true;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );

  return {
    data,
    setData,
    loading: loading && !hasLoaded.current,
    refreshing,
    reload,
  };
}
