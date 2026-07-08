import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Public waitlist signup. No auth — anyone can join. Writes via the service
 * client (the waitlist table has RLS on with no policies, so it's otherwise
 * invisible). Dedupes on lower(email).
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: { email?: string; name?: string; company?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 200) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  const name = (body.name ?? "").trim().slice(0, 120) || null;
  const company = (body.company ?? "").trim().slice(0, 120) || null;

  const service = createServiceClient();
  // Already on the list? Treat as success (idempotent, no email enumeration).
  const { data: existing } = await service.from("waitlist").select("id").eq("email", email).maybeSingle();
  if (existing) return NextResponse.json({ ok: true, alreadyOn: true });

  const { error } = await service.from("waitlist").insert({ email, name, company });
  if (error) {
    // Unique-violation race → still a success from the user's view.
    if (error.code === "23505") return NextResponse.json({ ok: true, alreadyOn: true });
    console.error("[waitlist] insert failed", { error: error.message });
    return NextResponse.json({ error: "Couldn't join the waitlist. Try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
