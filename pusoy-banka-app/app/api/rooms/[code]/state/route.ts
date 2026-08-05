import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const playerId = req.nextUrl.searchParams.get("playerId");

  const { data: room, error: roomErr } = await supabase
    .from("rooms")
    .select("*")
    .eq("room_code", code.toUpperCase())
    .single();
  if (roomErr || !room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const { data: players, error: playersErr } = await supabase
    .from("players")
    .select("*")
    .eq("room_id", room.id)
    .order("seat", { ascending: true });
  if (playersErr) return NextResponse.json({ error: playersErr.message }, { status: 500 });

  // The round players are currently arranging/waiting on is room.round_number
  // while status is 'arranging'. After a reveal, round_number has already
  // advanced, so the just-finished round is round_number - 1.
  const activeRoundNumber = room.status === "revealed" ? room.round_number - 1 : room.round_number;

  const { data: handRows } = await supabase
    .from("round_hands")
    .select("*, players!inner(seat, name)")
    .eq("room_id", room.id)
    .eq("round_number", activeRoundNumber);

  let myHand = null;
  if (playerId) {
    myHand = (handRows ?? []).find((h: any) => h.player_id === playerId) ?? null;
  }

  const submittedCount = (handRows ?? []).filter((h: any) => h.submitted).length;

  let latestResult = null;
  if (room.status === "revealed") {
    const { data: resultRow } = await supabase
      .from("round_results")
      .select("*")
      .eq("room_id", room.id)
      .eq("round_number", activeRoundNumber)
      .single();
    latestResult = resultRow ?? null;
  }

  return NextResponse.json({
    room,
    players,
    activeRoundNumber,
    myHand,
    submittedCount,
    totalPlayers: players?.length ?? 0,
    latestResult,
  });
}
