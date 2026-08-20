import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { UNLOCK_COOKIE_NAME, unlockCookieValue } from "@/lib/pin";
import { LockForm } from "@/components/lock/lock-form";

export const dynamic = "force-dynamic";

export default async function LockPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const nextPath = next && next.startsWith("/") ? next : "/";

  const business = await prisma.business.findFirst();
  if (!business?.pinHash) {
    redirect(nextPath);
  }

  const cookieStore = await cookies();
  const alreadyUnlocked = cookieStore.get(UNLOCK_COOKIE_NAME)?.value === unlockCookieValue(business.pinHash);
  if (alreadyUnlocked) {
    redirect(nextPath);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <LockForm next={nextPath} />
    </div>
  );
}
