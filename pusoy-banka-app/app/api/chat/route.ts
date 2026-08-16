import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET() {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: (data ?? []).reverse() });
}

export async function POST(req: NextRequest) {
  const { name, message } = await req.json();
  if (!name || typeof name !== "string" || !message || typeof message !== "string") {
    return NextResponse.json({ error: "Name and message are required" }, { status: 400 });
  }
  const trimmed = message.trim().slice(0, 500);
  if (!trimmed) return NextResponse.json({ error: "Message can't be empty" }, { status: 400 });

  const { error: insertErr } = await supabase
    .from("chat_messages")
    .insert({ sender_name: name.trim().slice(0, 40), message: trimmed });
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // Keep only the most recent 100 messages: find the 101st-newest timestamp
  // and delete anything older than or equal to that cutoff.
  const { data: overflow } = await supabase
    .from("chat_messages")
    .select("id, created_at")
    .order("created_at", { ascending: false })
    .range(100, 100);
  if (overflow && overflow.length > 0) {
    await supabase.from("chat_messages").delete().lte("created_at", overflow[0].created_at);
  }

  return NextResponse.json({ ok: true });
}
