import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExportCsvButton({ href }: { href: string }) {
  return (
    <Button variant="outline" asChild>
      <a href={href} download>
        <Download className="h-4 w-4" />
        Export CSV
      </a>
    </Button>
  );
}
