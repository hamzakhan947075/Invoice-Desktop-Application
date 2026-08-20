"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function BackupSettings() {
  const [restoring, setRestoring] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChosen(file: File | null) {
    if (!file) return;
    setPendingFile(file);
    setConfirmOpen(true);
  }

  async function handleConfirmRestore() {
    if (!pendingFile) return;
    setRestoring(true);
    try {
      const formData = new FormData();
      formData.set("file", pendingFile);
      const response = await fetch("/api/backup/import", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error ?? "Restore failed.");
      } else {
        toast.success(result.message ?? "Backup received.", { duration: 10000 });
      }
    } catch {
      toast.error("Restore failed — couldn't reach the app.");
    } finally {
      setRestoring(false);
      setConfirmOpen(false);
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data & backup</CardTitle>
        <CardDescription>
          Everything — invoices, quotes, customers, products, expenses — lives in one local
          database file. Download a backup to move it to another computer, or as a safety copy
          before a big change.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Button variant="outline" asChild>
          <a href="/api/backup/export" download>
            <Download className="h-4 w-4" />
            Download backup
          </a>
        </Button>

        <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={restoring}>
          <Upload className="h-4 w-4" />
          Restore from backup
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".db"
          className="hidden"
          onChange={(event) => handleFileChosen(event.target.files?.[0] ?? null)}
        />
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore from &ldquo;{pendingFile?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This replaces all current data with what&rsquo;s in the backup file once you restart
              the app. Your current data is kept as a dated backup file first, just in case.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingFile(null)}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={restoring} onClick={handleConfirmRestore}>
              {restoring ? "Uploading…" : "Restore"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
