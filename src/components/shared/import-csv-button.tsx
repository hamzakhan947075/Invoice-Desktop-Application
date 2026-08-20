"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ImportCsvButton({ action }: { action: string }) {
  const router = useRouter();
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | null) {
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch(action, { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error ?? "Import failed.");
        return;
      }

      const parts = [`${result.created} imported`];
      if (result.skipped > 0) parts.push(`${result.skipped} skipped`);
      toast.success(parts.join(", ") + ".", {
        description: result.errors?.length ? result.errors.slice(0, 3).join("\n") : undefined,
        duration: 8000,
      });
      router.refresh();
    } catch {
      toast.error("Import failed — couldn't reach the app.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <>
      <Button variant="outline" disabled={importing} onClick={() => fileInputRef.current?.click()}>
        <Upload className="h-4 w-4" />
        {importing ? "Importing…" : "Import CSV"}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
      />
    </>
  );
}
