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

  const { count } = await supabase
    .from("players")
    .select("*", { count: "exact", head: true })
    .eq("room_id", room.id);
  if ((count ?? 0) !== 4) {
    return NextResponse.json({ error: "Need exactly 4 players to start" }, { status: 400 });
  }

  await dealRound(room.id, room.round_number);
  return NextResponse.json({ ok: true });
}
