"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Nudges a genuinely first-time run (the auto-created placeholder business,
 * see requireCurrentBusiness()) to the Settings page so real business
 * details get filled in — this doubles as the desktop app's onboarding,
 * since there's no separate registration flow anymore.
 */
export function FirstRunRedirect({ isPlaceholder }: { isPlaceholder: boolean }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isPlaceholder && pathname !== "/settings") {
      router.replace("/settings");
    }
  }, [isPlaceholder, pathname, router]);

  return null;
}
