"use client";

import { useActionState } from "react";
import { Lock } from "lucide-react";
import { unlockAction, type UnlockActionState } from "@/app/lock/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LockForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<UnlockActionState, FormData>(
    unlockAction,
    undefined
  );

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center text-center">
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Lock className="h-5 w-5" />
        </div>
        <CardTitle>InvoiceFlow is locked</CardTitle>
        <CardDescription>Enter your PIN to continue.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />
          <Input
            type="password"
            inputMode="numeric"
            name="pin"
            autoFocus
            placeholder="PIN"
            className="text-center text-lg tracking-widest"
          />
          {state?.error && <p className="text-center text-sm text-destructive">{state.error}</p>}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Unlocking…" : "Unlock"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
