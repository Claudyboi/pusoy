import { supabase } from "./supabaseClient";
import { dealHands } from "./deck";
import { buildPlayerHand } from "./scoring";
import { scoreRoundWithSpecials } from "./scoring";
import { getBankaSeatForRound } from "./scoring";
import { Card, PlayerArrangement } from "./types";

export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/** Deals a fresh round: 13 cards to each of the 4 seated players. */
export async function dealRound(roomId: string, roundNumber: number) {
  const { data: players, error: playersErr } = await supabase
    .from("players")
    .select("id, seat")
    .eq("room_id", roomId)
    .order("seat", { ascending: true });
  if (playersErr) throw playersErr;
  if (!players || players.length !== 4) throw new Error("Room must have exactly 4 players to deal");

  const hands = dealHands(); // [Card[], Card[], Card[], Card[]] indexed by seat 0-3

  const rows = players.map((p) => ({
    room_id: roomId,
    round_number: roundNumber,
    player_id: p.id,
    dealt_cards: hands[p.seat],
    submitted: false,
  }));

  const { error: insertErr } = await supabase.from("round_hands").insert(rows);
  if (insertErr) throw insertErr;

  await supabase.from("rooms").update({ status: "arranging" }).eq("id", roomId);
}

/**
 * Checks if all 4 players have submitted their arrangement for the current
 * round. If so, scores the round (including specials), updates each
 * player's cumulative stats, logs the result, and advances the room to the
 * next round (rotating banka every 3 rounds).
 */
export async function tryResolveRound(roomId: string, roundNumber: number) {
  const { data: handRows, error: handsErr } = await supabase
    .from("round_hands")
    .select("*, players!inner(id, seat, name)")
    .eq("room_id", roomId)
    .eq("round_number", roundNumber);
  if (handsErr) throw handsErr;
  if (!handRows || handRows.length !== 4) return null;
  if (!handRows.every((h) => h.submitted)) return null; // not everyone's in yet

  const { data: room, error: roomErr } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .single();
  if (roomErr) throw roomErr;

  const bankaSeat = room.banka_seat;
  const bySeat = new Map(handRows.map((h: any) => [h.players.seat, h]));

  const bankaRow = bySeat.get(bankaSeat);
  if (!bankaRow) throw new Error("Banka seat has no hand row");

  const otherSeats = [0, 1, 2, 3].filter((s) => s !== bankaSeat);

  const arrangementOf = (row: any): PlayerArrangement => ({
    front: row.front as Card[],
    middle: row.middle as Card[],
    back: row.back as Card[],
  });

  const bankaHand = buildPlayerHand(arrangementOf(bankaRow));
  const otherHands = otherSeats.map((seat) => buildPlayerHand(arrangementOf(bySeat.get(seat))));
  const otherCards = otherSeats.map((seat) => bySeat.get(seat).dealt_cards as Card[]);

  const result = scoreRoundWithSpecials(
    bankaRow.dealt_cards as Card[],
    bankaHand,
    otherCards,
    otherHands,
    { pointsPerSegment: 1 }
  );

  // Net points per seat this round
  const netBySeat = new Map<number, number>();
  netBySeat.set(bankaSeat, result.bankaTotalPoints);
  result.matchups.forEach((m, i) => {
    netBySeat.set(otherSeats[i], -m.bankaNetPoints);
  });

  // Update each player's cumulative stats
  const { data: allPlayers } = await supabase.from("players").select("*").eq("room_id", roomId);
  for (const p of allPlayers ?? []) {
    const net = netBySeat.get(p.seat) ?? 0;
    await supabase
      .from("players")
      .update({
        total_points: p.total_points + net,
        rounds_won: p.rounds_won + (net > 0 ? 1 : 0),
        rounds_lost: p.rounds_lost + (net < 0 ? 1 : 0),
        rounds_tied: p.rounds_tied + (net === 0 ? 1 : 0),
        times_banka: p.times_banka + (p.seat === bankaSeat ? 1 : 0),
      })
      .eq("id", p.id);
  }

  await supabase.from("round_results").insert({
    room_id: roomId,
    round_number: roundNumber,
    banka_seat: bankaSeat,
    result,
  });

  const nextRoundNumber = roundNumber + 1;
  const nextBankaSeat = getBankaSeatForRound(nextRoundNumber, room.starting_banka_seat);

  await supabase
    .from("rooms")
    .update({ status: "revealed", round_number: nextRoundNumber, banka_seat: nextBankaSeat })
    .eq("id", roomId);

  return result;
}
