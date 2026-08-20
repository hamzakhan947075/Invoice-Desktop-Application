"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function UpdateSettings() {
  const [version, setVersion] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    window.electronAPI?.getAppVersion().then(setVersion);
  }, []);

  async function handleCheck() {
    if (!window.electronAPI) return;
    setChecking(true);
    try {
      const result = await window.electronAPI.checkForUpdates();
      setAvailable(result.status === "available");
      if (result.status === "error") toast.error(result.message ?? "Update check failed.");
      else toast.success(result.message ?? "Checked for updates.");
    } finally {
      setChecking(false);
    }
  }

  if (!version) {
    // Not running inside the packaged Electron app (e.g. a plain browser
    // during development) — there's nothing meaningful to show or check.
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Updates
        </CardTitle>
        <CardDescription>
          InvoiceFlow {version}
          {available && " — a new version is downloading in the background."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" disabled={checking} onClick={handleCheck}>
          {checking ? "Checking…" : "Check for updates"}
        </Button>
      </CardContent>
    </Card>
  );
}
