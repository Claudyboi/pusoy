import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { name } = await req.json();
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const { data: room, error: roomErr } = await supabase
    .from("rooms")
    .select("*")
    .eq("room_code", code.toUpperCase())
    .single();
  if (roomErr || !room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  if (room.status !== "waiting") {
    return NextResponse.json({ error: "Room has already started" }, { status: 400 });
  }

  const { data: existingPlayers, error: playersErr } = await supabase
    .from("players")
    .select("seat")
    .eq("room_id", room.id);
  if (playersErr) return NextResponse.json({ error: playersErr.message }, { status: 500 });

  const takenSeats = new Set((existingPlayers ?? []).map((p) => p.seat));
  if (takenSeats.size >= 4) {
    return NextResponse.json({ error: "Room is full" }, { status: 400 });
  }
  let seat = 0;
  while (takenSeats.has(seat)) seat++;

  const { data: player, error: insertErr } = await supabase
    .from("players")
    .insert({ room_id: room.id, seat, name })
    .select()
    .single();
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  return NextResponse.json({ room, player });
}
