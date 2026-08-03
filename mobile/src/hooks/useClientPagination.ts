import { useEffect, useMemo, useState } from "react";

export type ClientPagination<T> = {
  /** Items for the current page only. */
  pageItems: T[];
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  hasPrev: boolean;
  hasNext: boolean;
  setPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
};

/**
 * Client-side page slicing for filtered lists.
 * Resets to page 1 when `resetKey` or `pageSize` changes.
 */
export function useClientPagination<T>(
  items: T[],
  pageSize: number,
  resetKey?: string | number
): ClientPagination<T> {
  const [page, setPage] = useState(1);
  const size = Math.max(1, pageSize || 25);

  useEffect(() => {
    setPage(1);
  }, [size, resetKey]);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / size));
  const safePage = Math.min(Math.max(1, page), totalPages);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * size;
    return items.slice(start, start + size);
  }, [items, safePage, size]);

  return {
    pageItems,
    page: safePage,
    totalPages,
    totalItems,
    pageSize: size,
    hasPrev: safePage > 1,
    hasNext: safePage < totalPages,
    setPage,
    nextPage: () => setPage((p) => Math.min(totalPages, p + 1)),
    prevPage: () => setPage((p) => Math.max(1, p - 1)),
  };
}
