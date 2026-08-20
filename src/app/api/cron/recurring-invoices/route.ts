import { NextResponse } from "next/server";
import { generateDueInvoices } from "@/lib/recurring-invoice-generator";

/**
 * Triggers generation of every recurring invoice due today or earlier,
 * across all businesses. Meant to be called by an external scheduler (e.g.
 * Vercel Cron) once a day — not a user-facing route, so it authenticates
 * with a shared secret rather than a session.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const generated = await generateDueInvoices();

  return NextResponse.json({
    generated: generated.length,
    invoices: generated,
  });
}
