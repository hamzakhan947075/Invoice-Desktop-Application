"use client";

import { usePathname } from "next/navigation";

/**
 * Keyed by pathname (not search params) so filter/sort updates on the same
 * page — which only touch the query string via router.replace/refresh —
 * don't retrigger this, only real navigation between routes does.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="animate-in fade-in slide-in-from-bottom-1 duration-300 ease-out">
      {children}
    </div>
  );
}
