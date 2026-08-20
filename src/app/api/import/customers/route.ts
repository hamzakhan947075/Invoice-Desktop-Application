import { NextRequest, NextResponse } from "next/server";
import { requireCurrentBusiness } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { parseCsv } from "@/lib/csv";
import { customerSchema } from "@/lib/validations/customer";

export async function POST(request: NextRequest) {
  const business = await requireCurrentBusiness();

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const rows = parseCsv(await file.text());
  if (rows.length === 0) {
    return NextResponse.json({ error: "The file is empty." }, { status: 400 });
  }

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const colIndex = (label: string) => headers.indexOf(label);
  const nameIndex = colIndex("name");
  if (nameIndex === -1) {
    return NextResponse.json({ error: 'Missing required "Name" column.' }, { status: 400 });
  }
  const emailIndex = colIndex("email");
  const phoneIndex = colIndex("phone");
  const addressIndex = colIndex("address");
  const notesIndex = colIndex("notes");

  let created = 0;
  const errors: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const parsed = customerSchema.safeParse({
      name: row[nameIndex] ?? "",
      email: emailIndex >= 0 ? row[emailIndex] : "",
      phone: phoneIndex >= 0 ? row[phoneIndex] : "",
      address: addressIndex >= 0 ? row[addressIndex] : "",
      notes: notesIndex >= 0 ? row[notesIndex] : "",
    });
    if (!parsed.success) {
      errors.push(`Row ${i + 1}: ${parsed.error.issues[0]?.message ?? "Invalid data."}`);
      continue;
    }

    await prisma.customer.create({
      data: {
        businessId: business.id,
        name: parsed.data.name,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        address: parsed.data.address || null,
        notes: parsed.data.notes || null,
      },
    });
    created++;
  }

  return NextResponse.json({ created, skipped: errors.length, errors: errors.slice(0, 20) });
}
