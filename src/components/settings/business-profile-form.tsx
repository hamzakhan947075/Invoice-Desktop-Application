"use client";

import { useActionState, useEffect, useState } from "react";
import Image from "next/image";
import { Building2 } from "lucide-react";
import { toast } from "sonner";
import {
  updateBusinessProfileAction,
  type BusinessProfileActionState,
} from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { CURRENCIES, CURRENCY_LABELS, type CurrencyCode } from "@/lib/currencies";

type BusinessProfile = {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  currency: string;
  logoUrl: string | null;
};

export function BusinessProfileForm({ business }: { business: BusinessProfile }) {
  const [state, formAction, pending] = useActionState<BusinessProfileActionState, FormData>(
    updateBusinessProfileAction,
    undefined
  );
  const [logoPreview, setLogoPreview] = useState<string | null>(business.logoUrl);

  useEffect(() => {
    if (state?.success) toast.success("Business profile updated.");
  }, [state]);

  return (
    <form action={formAction}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="logo">Business logo</FieldLabel>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
              {logoPreview ? (
                <Image
                  src={logoPreview}
                  alt="Business logo"
                  width={64}
                  height={64}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              ) : (
                <Building2 className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <Input
              id="logo"
              name="logo"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="max-w-xs"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) setLogoPreview(URL.createObjectURL(file));
              }}
            />
          </div>
          <FieldDescription>PNG, JPEG, WEBP, or GIF. Max 2MB.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="name">Business name</FieldLabel>
          <Input id="name" name="name" defaultValue={business.name} required />
        </Field>

        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" name="email" type="email" defaultValue={business.email ?? ""} />
        </Field>

        <Field>
          <FieldLabel htmlFor="phone">Phone</FieldLabel>
          <Input id="phone" name="phone" defaultValue={business.phone ?? ""} />
        </Field>

        <Field>
          <FieldLabel htmlFor="address">Address</FieldLabel>
          <Textarea id="address" name="address" defaultValue={business.address ?? ""} rows={3} />
        </Field>

        <Field>
          <FieldLabel htmlFor="currency">Currency</FieldLabel>
          <Select name="currency" defaultValue={business.currency}>
            <SelectTrigger id="currency" className="w-full">
              <SelectValue placeholder="Select a currency" />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((code: CurrencyCode) => (
                <SelectItem key={code} value={code}>
                  {CURRENCY_LABELS[code]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>Used as the default currency for new invoices.</FieldDescription>
        </Field>

        {state?.error && <FieldError>{state.error}</FieldError>}

        <Button type="submit" disabled={pending} className="w-fit">
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </FieldGroup>
    </form>
  );
}
