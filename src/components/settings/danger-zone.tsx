"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Download, Trash2 } from "lucide-react";
import { flushAllDataAction, type FlushAllDataActionState } from "@/app/(app)/settings/actions";
import { FLUSH_CONFIRMATION_PHRASE } from "@/lib/danger-zone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function DangerZone({ hasPin }: { hasPin: boolean }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<FlushAllDataActionState, FormData>(
    flushAllDataAction,
    undefined
  );
  const [confirmation, setConfirmation] = useState("");

  // The action already revalidates everything server-side — navigating back
  // to the dashboard picks up the fresh (reset) business on the way.
  useEffect(() => {
    if (state?.success) {
      router.push("/");
      router.refresh();
    }
  }, [state, router]);

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4" /> Danger Zone
        </CardTitle>
        <CardDescription>
          Permanently deletes every customer, product, invoice, payment, quote, credit note, expense,
          recurring invoice, and stock record — including the sample data this app came with. Your
          business profile resets to blank too. This can&apos;t be undone except by restoring a backup.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button variant="outline" className="w-fit" asChild>
          <a href="/api/backup/export" download>
            <Download className="h-4 w-4" />
            Export a backup first
          </a>
        </Button>

        <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-destructive/30 p-3">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="confirmation">
                Type <span className="font-mono font-semibold">{FLUSH_CONFIRMATION_PHRASE}</span> to confirm
              </FieldLabel>
              <Input
                id="confirmation"
                name="confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
              />
            </Field>
            {hasPin && (
              <Field>
                <FieldLabel htmlFor="currentPin">Current PIN</FieldLabel>
                <Input id="currentPin" type="password" inputMode="numeric" name="currentPin" className="w-32" />
              </Field>
            )}
            {state?.error && <FieldError>{state.error}</FieldError>}
          </FieldGroup>
          <Button
            type="submit"
            variant="destructive"
            className="w-fit"
            disabled={pending || confirmation !== FLUSH_CONFIRMATION_PHRASE}
          >
            <Trash2 className="h-4 w-4" />
            {pending ? "Deleting everything…" : "Delete all data"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
