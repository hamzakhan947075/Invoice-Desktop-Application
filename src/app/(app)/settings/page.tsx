import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { BusinessProfileForm } from "@/components/settings/business-profile-form";

export default async function SettingsPage() {
  const business = await requireCurrentBusiness();

  return (
    <div className="max-w-2xl">
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
    </div>
  );
}
