import path from "path";
import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { getUploadsRoot } from "@/lib/uploads";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const root = getUploadsRoot();
  const resolved = path.resolve(root, ...segments);

  // Every requested path must stay inside the uploads root — reject anything
  // that escapes it (e.g. via `..` segments) before touching the filesystem.
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const buffer = await readFile(resolved);
    const contentType = MIME_TYPES[path.extname(resolved).toLowerCase()] ?? "application/octet-stream";
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}
