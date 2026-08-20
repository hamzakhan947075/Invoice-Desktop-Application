import { requireCurrentBusiness, PLACEHOLDER_BUSINESS_NAME } from "@/lib/auth/current-user";
import { AppShell } from "@/components/layout/app-shell";
import { FirstRunRedirect } from "@/components/layout/first-run-redirect";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const business = await requireCurrentBusiness();

  return (
    <AppShell businessName={business.name}>
      <FirstRunRedirect isPlaceholder={business.name === PLACEHOLDER_BUSINESS_NAME} />
      {children}
    </AppShell>
  );
}
