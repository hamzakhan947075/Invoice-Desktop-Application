import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { BusinessProfileForm } from "@/components/settings/business-profile-form";
import { BackupSettings } from "@/components/settings/backup-settings";
import { PinSettings } from "@/components/settings/pin-settings";
import { UpdateSettings } from "@/components/settings/update-settings";

export default async function SettingsPage() {
  const business = await requireCurrentBusiness();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <BusinessProfileForm
        business={{
          name: business.name,
          email: business.email,
          phone: business.phone,
          address: business.address,
          currency: business.currency,
          logoUrl: business.logoUrl,
        }}
      />
      <BackupSettings />
      <PinSettings hasPin={Boolean(business.pinHash)} />
      <UpdateSettings />
    </div>
  );
}
