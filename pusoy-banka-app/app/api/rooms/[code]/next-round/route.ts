import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { dealRound } from "@/lib/gameServer";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const { data: room, error: roomErr } = await supabase
    .from("rooms")
    .select("*")
    .eq("room_code", code.toUpperCase())
    .single();
  if (roomErr || !room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  if (room.status !== "revealed") {
    return NextResponse.json({ error: "Round hasn't been revealed yet" }, { status: 400 });
  }

  await dealRound(room.id, room.round_number);
  return NextResponse.json({ ok: true });
}
