"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import {
  setPinAction,
  changePinAction,
  removePinAction,
  setRecoveryQuestionAction,
  type PinActionState,
} from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function SetPinForm() {
  const [state, formAction, pending] = useActionState<PinActionState, FormData>(setPinAction, undefined);
  useEffect(() => {
    if (state?.success) toast.success("PIN set. You'll need it next time the app locks.");
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <Input type="password" inputMode="numeric" name="pin" placeholder="New PIN" className="w-32" />
        <Input type="password" inputMode="numeric" name="confirmPin" placeholder="Confirm PIN" className="w-32" />
      </div>
      <p className="text-xs text-muted-foreground">
        A recovery question is required, so a forgotten PIN doesn&apos;t lock you out for good.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <Input name="recoveryQuestion" placeholder="Recovery question" className="w-56" />
        <Input name="recoveryAnswer" placeholder="Answer" className="w-40" />
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Setting…" : "Set PIN"}
        </Button>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

function ChangePinForm() {
  const [state, formAction, pending] = useActionState<PinActionState, FormData>(
    changePinAction,
    undefined
  );
  useEffect(() => {
    if (state?.success) toast.success("PIN changed.");
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <Input type="password" inputMode="numeric" name="currentPin" placeholder="Current PIN" className="w-32" />
        <Input type="password" inputMode="numeric" name="newPin" placeholder="New PIN" className="w-32" />
        <Input type="password" inputMode="numeric" name="confirmPin" placeholder="Confirm PIN" className="w-32" />
      </div>
      <p className="text-xs text-muted-foreground">
        Optionally update your recovery question too — leave both blank to keep the current one.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <Input name="recoveryQuestion" placeholder="New recovery question" className="w-56" />
        <Input name="recoveryAnswer" placeholder="New answer" className="w-40" />
      </div>
      <div>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Changing…" : "Change PIN"}
        </Button>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

function SetRecoveryQuestionForm() {
  const [state, formAction, pending] = useActionState<PinActionState, FormData>(
    setRecoveryQuestionAction,
    undefined
  );
  useEffect(() => {
    if (state?.success) toast.success("Recovery question set.");
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <p className="text-sm text-muted-foreground">
        No recovery question is set for your PIN yet — if you forget it, there&apos;s no way back in. Set
        one now with your current PIN.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <Input type="password" inputMode="numeric" name="currentPin" placeholder="Current PIN" className="w-32" />
        <Input name="recoveryQuestion" placeholder="Recovery question" className="w-56" />
        <Input name="recoveryAnswer" placeholder="Answer" className="w-40" />
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Saving…" : "Set recovery question"}
        </Button>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

function RemovePinForm() {
  const [state, formAction, pending] = useActionState<PinActionState, FormData>(
    removePinAction,
    undefined
  );
  useEffect(() => {
    if (state?.success) toast.success("PIN removed.");
  }, [state]);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <Input type="password" inputMode="numeric" name="currentPin" placeholder="Current PIN" className="w-32" />
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "Removing…" : "Remove PIN"}
      </Button>
      {state?.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

export function PinSettings({
  hasPin,
  hasRecoveryQuestion,
}: {
  hasPin: boolean;
  hasRecoveryQuestion: boolean;
}) {
  const [showChangeForms, setShowChangeForms] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4" /> App lock
        </CardTitle>
        <CardDescription>
          {hasPin
            ? "A PIN is required to open InvoiceFlow. Useful if this computer is shared."
            : "Set a PIN so InvoiceFlow locks itself when reopened — useful if this computer is shared."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!hasPin ? (
          <SetPinForm />
        ) : (
          <>
            {!hasRecoveryQuestion && <SetRecoveryQuestionForm />}
            {showChangeForms ? (
              <>
                <ChangePinForm />
                <RemovePinForm />
              </>
            ) : (
              <Button variant="outline" className="w-fit" onClick={() => setShowChangeForms(true)}>
                Change or remove PIN
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
