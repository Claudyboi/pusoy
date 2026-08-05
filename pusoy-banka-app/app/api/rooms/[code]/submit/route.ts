import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { tryResolveRound } from "@/lib/gameServer";
import { Card } from "@/lib/types";

function cardKey(c: Card) {
  return `${c.rank}${c.suit}`;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { playerId, front, middle, back } = await req.json();

  if (!playerId || !front || !middle || !back) {
    return NextResponse.json({ error: "Missing playerId/front/middle/back" }, { status: 400 });
  }
  if (front.length !== 3 || middle.length !== 5 || back.length !== 5) {
    return NextResponse.json({ error: "Arrangement must be 3/5/5 cards" }, { status: 400 });
  }

  const { data: room, error: roomErr } = await supabase
    .from("rooms")
    .select("*")
    .eq("room_code", code.toUpperCase())
    .single();
  if (roomErr || !room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const { data: handRow, error: handErr } = await supabase
    .from("round_hands")
    .select("*")
    .eq("room_id", room.id)
    .eq("round_number", room.round_number)
    .eq("player_id", playerId)
    .single();
  if (handErr || !handRow) return NextResponse.json({ error: "Hand not found for this round" }, { status: 404 });
  if (handRow.submitted) {
    return NextResponse.json({ error: "Already submitted this round" }, { status: 400 });
  }

  // Validate the submitted 13 cards are exactly the dealt 13 cards, no
  // duplicates, nothing invented or missing.
  const dealtKeys = new Set((handRow.dealt_cards as Card[]).map(cardKey));
  const submittedCards: Card[] = [...front, ...middle, ...back];
  if (submittedCards.length !== 13) {
    return NextResponse.json({ error: "Must arrange exactly 13 cards" }, { status: 400 });
  }
  const submittedKeys = submittedCards.map(cardKey);
  const uniqueSubmitted = new Set(submittedKeys);
  if (uniqueSubmitted.size !== 13 || ![...uniqueSubmitted].every((k) => dealtKeys.has(k))) {
    return NextResponse.json({ error: "Submitted cards don't match your dealt hand" }, { status: 400 });
  }

  const { error: updateErr } = await supabase
    .from("round_hands")
    .update({ front, middle, back, submitted: true })
    .eq("id", handRow.id);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  const result = await tryResolveRound(room.id, room.round_number);

  return NextResponse.json({ ok: true, resolved: result !== null });
}
