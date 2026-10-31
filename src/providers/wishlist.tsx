import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { readWishlist, writeWishlist } from '@/lib/wishlist';

type WishlistContextValue = {
  ids: Set<string>;
  has(skinUuid: string | null | undefined): boolean;
  toggle(skinUuid: string): void;
  clear(): void;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    readWishlist().then(setIds);
  }, []);

  const toggle = useCallback((skinUuid: string) => {
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(skinUuid)) next.delete(skinUuid);
      else next.add(skinUuid);
      writeWishlist(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    const next = new Set<string>();
    setIds(next);
    writeWishlist(next);
  }, []);

  const value = useMemo(
    () => ({ ids, has: (id: string | null | undefined) => !!id && ids.has(id), toggle, clear }),
    [ids, toggle, clear],
  );
  return <WishlistContext value={value}>{children}</WishlistContext>;
}

export function useWishlist() {
  const ctx = use(WishlistContext);
  if (!ctx) throw new Error('useWishlist fora do WishlistProvider');
  return ctx;
}
