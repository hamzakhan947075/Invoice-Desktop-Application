"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { recoverPinAction, type RecoverPinActionState } from "@/app/lock/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function RecoverPinForm({
  next,
  recoveryQuestion,
  onCancel,
}: {
  next: string;
  recoveryQuestion: string;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState<RecoverPinActionState, FormData>(
    recoverPinAction,
    undefined
  );

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center text-center">
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <KeyRound className="h-5 w-5" />
        </div>
        <CardTitle>Reset your PIN</CardTitle>
        <CardDescription>Answer your recovery question to set a new PIN.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction}>
          <input type="hidden" name="next" value={next} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="answer">{recoveryQuestion}</FieldLabel>
              <Input id="answer" name="answer" autoFocus required />
            </Field>
            <Field>
              <FieldLabel htmlFor="newPin">New PIN</FieldLabel>
              <Input
                id="newPin"
                type="password"
                inputMode="numeric"
                name="newPin"
                placeholder="4–8 digits"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="confirmNewPin">Confirm new PIN</FieldLabel>
              <Input id="confirmNewPin" type="password" inputMode="numeric" name="confirmNewPin" required />
            </Field>
            {state?.error && <FieldError>{state.error}</FieldError>}
          </FieldGroup>
          <div className="mt-4 flex flex-col gap-2">
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Resetting…" : "Reset PIN"}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={onCancel}>
              Back to unlock
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
