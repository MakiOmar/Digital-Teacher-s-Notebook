import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";

export type ServerPage<T> = {
  items: T[];
  total: number;
};

export type ServerPagination<T> = {
  pageItems: T[];
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  hasPrev: boolean;
  hasNext: boolean;
  loading: boolean;
  refreshing: boolean;
  setPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  reload: () => Promise<void>;
};

/** Loads only the active SQL page and resets to page one when filters change. */
export function useServerPagination<T>(
  fetchPage: (limit: number, offset: number) => Promise<ServerPage<T>>,
  pageSize: number,
  resetKey?: string | number
): ServerPagination<T> {
  const size = Math.max(1, pageSize || 25);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<T[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoaded = useRef(false);
  const requestId = useRef(0);
  const previousResetKey = useRef(resetKey);

  useEffect(() => {
    if (previousResetKey.current !== resetKey) {
      previousResetKey.current = resetKey;
      setPage(1);
    }
  }, [resetKey]);

  useEffect(() => {
    setPage(1);
  }, [size]);

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    if (hasLoaded.current) setRefreshing(true);
    else setLoading(true);

    try {
      const result = await fetchPage(size, (page - 1) * size);
      if (currentRequest !== requestId.current) return;

      const totalPages = Math.max(1, Math.ceil(result.total / size));
      setItems(result.items);
      setTotalItems(result.total);
      hasLoaded.current = true;
      if (page > totalPages) setPage(totalPages);
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [fetchPage, page, size]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const totalPages = Math.max(1, Math.ceil(totalItems / size));
  const safePage = Math.min(Math.max(1, page), totalPages);

  return useMemo(
    () => ({
      pageItems: items,
      page: safePage,
      totalPages,
      totalItems,
      pageSize: size,
      hasPrev: safePage > 1,
      hasNext: safePage < totalPages,
      loading: loading && !hasLoaded.current,
      refreshing,
      setPage,
      nextPage: () => setPage((current) => Math.min(totalPages, current + 1)),
      prevPage: () => setPage((current) => Math.max(1, current - 1)),
      reload: load,
    }),
    [
      items,
      load,
      loading,
      refreshing,
      safePage,
      size,
      totalItems,
      totalPages,
    ]
  );
}
