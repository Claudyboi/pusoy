import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { generateRoomCode, dealRound } from "@/lib/gameServer";

const BOT_NAMES = ["Ana (bot)", "Bo (bot)", "Cy (bot)"];

export async function POST(req: NextRequest) {
  const { name } = await req.json();
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const roomCode = generateRoomCode();
    const { data: room, error: roomErr } = await supabase
      .from("rooms")
      .insert({ room_code: roomCode })
      .select()
      .single();

    if (roomErr) {
      if (roomErr.code === "23505") continue;
      return NextResponse.json({ error: roomErr.message }, { status: 500 });
    }

    const { data: humanPlayer, error: humanErr } = await supabase
      .from("players")
      .insert({ room_id: room.id, seat: 0, name })
      .select()
      .single();
    if (humanErr) return NextResponse.json({ error: humanErr.message }, { status: 500 });

    const botRows = BOT_NAMES.map((botName, i) => ({
      room_id: room.id,
      seat: i + 1,
      name: botName,
      is_bot: true,
    }));
    const { error: botsErr } = await supabase.from("players").insert(botRows);
    if (botsErr) return NextResponse.json({ error: botsErr.message }, { status: 500 });

    await dealRound(room.id, room.round_number);

    return NextResponse.json({ room, player: humanPlayer });
  }

  return NextResponse.json({ error: "Could not generate a unique room code, try again" }, { status: 500 });
}
