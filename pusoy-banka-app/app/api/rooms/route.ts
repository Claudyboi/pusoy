import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { generateRoomCode } from "@/lib/gameServer";

export async function POST(req: NextRequest) {
  const { name } = await req.json();
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Try a few times in case of a room_code collision (very unlikely).
  for (let attempt = 0; attempt < 5; attempt++) {
    const roomCode = generateRoomCode();
    const { data: room, error: roomErr } = await supabase
      .from("rooms")
      .insert({ room_code: roomCode })
      .select()
      .single();

    if (roomErr) {
      if (roomErr.code === "23505") continue; // unique violation, retry with new code
      return NextResponse.json({ error: roomErr.message }, { status: 500 });
    }

    const { data: player, error: playerErr } = await supabase
      .from("players")
      .insert({ room_id: room.id, seat: 0, name })
      .select()
      .single();

    if (playerErr) {
      return NextResponse.json({ error: playerErr.message }, { status: 500 });
    }

    return NextResponse.json({ room, player });
  }

  return NextResponse.json({ error: "Could not generate a unique room code, try again" }, { status: 500 });
}
