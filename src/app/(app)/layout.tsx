import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireCurrentBusiness, PLACEHOLDER_BUSINESS_NAME } from "@/lib/auth/current-user";
import { AppShell } from "@/components/layout/app-shell";
import { FirstRunRedirect } from "@/components/layout/first-run-redirect";
import { UNLOCK_COOKIE_NAME, unlockCookieValue } from "@/lib/pin";

// Every page here reads live business data with no session/cookie call to
// anchor it — without this, Next.js statically prerenders these routes at
// `next build` time and bakes in whatever was in the database on the build
// machine, serving that same stale snapshot to every user forever after.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const business = await requireCurrentBusiness();

  if (business.pinHash) {
    const cookieStore = await cookies();
    const unlocked = cookieStore.get(UNLOCK_COOKIE_NAME)?.value === unlockCookieValue(business.pinHash);
    if (!unlocked) {
      redirect("/lock");
    }
  }

  return (
    <AppShell businessName={business.name}>
      <FirstRunRedirect isPlaceholder={business.name === PLACEHOLDER_BUSINESS_NAME} />
      {children}
    </AppShell>
  );
}
