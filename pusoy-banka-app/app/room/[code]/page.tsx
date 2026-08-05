"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

interface CardT {
  rank: number;
  suit: "D" | "C" | "H" | "S";
}

const RANK_LABELS: Record<number, string> = {
  2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9", 10: "10",
  11: "J", 12: "Q", 13: "K", 14: "A",
};
const SUIT_SYMBOLS: Record<string, string> = { D: "\u2666", C: "\u2663", H: "\u2665", S: "\u2660" };
const SUIT_COLOR: Record<string, string> = { D: "text-red-500", H: "text-red-500", C: "text-neutral-100", S: "text-neutral-100" };

function cardKey(c: CardT) {
  return `${c.rank}${c.suit}`;
}

function CardChip({ card, onClick, highlight }: { card: CardT; onClick?: () => void; highlight?: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-14 h-20 rounded-md border flex flex-col items-center justify-center font-semibold text-lg shrink-0
        ${highlight ? "border-emerald-400 bg-emerald-950" : "border-neutral-700 bg-neutral-900"}
        ${SUIT_COLOR[card.suit]}`}
    >
      <span>{RANK_LABELS[card.rank]}</span>
      <span>{SUIT_SYMBOLS[card.suit]}</span>
    </button>
  );
}

type Slot = "pool" | "front" | "middle" | "back";

export default function RoomPage() {
  const { code } = useParams<{ code: string }>();
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [state, setState] = useState<any>(null);
  const [error, setError] = useState("");
  const [assignments, setAssignments] = useState<Record<string, Slot>>({});
  const [roundKeyForAssignments, setRoundKeyForAssignments] = useState<string | null>(null);

  useEffect(() => {
    setPlayerId(localStorage.getItem(`pusoy-player-${code}`));
  }, [code]);

  const poll = useCallback(async () => {
    if (!code) return;
    const res = await fetch(`/api/rooms/${code}/state${playerId ? `?playerId=${playerId}` : ""}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }
    setState(data);
  }, [code, playerId]);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [poll]);

  // Reset local arrangement state when a fresh (unsubmitted) hand arrives.
  useEffect(() => {
    if (!state?.myHand) return;
    const key = `${state.activeRoundNumber}`;
    if (roundKeyForAssignments !== key && !state.myHand.submitted) {
      const fresh: Record<string, Slot> = {};
      for (const c of state.myHand.dealt_cards as CardT[]) fresh[cardKey(c)] = "pool";
      setAssignments(fresh);
      setRoundKeyForAssignments(key);
    }
  }, [state, roundKeyForAssignments]);

  async function startGame() {
    const res = await fetch(`/api/rooms/${code}/start`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) setError(data.error);
    else poll();
  }

  async function nextRound() {
    const res = await fetch(`/api/rooms/${code}/next-round`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) setError(data.error);
    else poll();
  }

  function cycleCard(card: CardT) {
    const key = cardKey(card);
    const counts = { front: 0, middle: 0, back: 0 } as Record<Slot, number>;
    for (const s of Object.values(assignments)) if (s !== "pool") counts[s as Slot]++;

    const order: Slot[] = ["pool", "front", "middle", "back"];
    const capacity: Record<Slot, number> = { pool: Infinity, front: 3, middle: 5, back: 5 };
    let current = assignments[key] ?? "pool";
    let idx = order.indexOf(current);
    for (let tries = 0; tries < 4; tries++) {
      idx = (idx + 1) % order.length;
      const candidate = order[idx];
      const candidateCount = candidate === current ? 0 : counts[candidate] ?? 0;
      if (candidate === "pool" || candidateCount < capacity[candidate]) {
        setAssignments({ ...assignments, [key]: candidate });
        return;
      }
    }
  }

  async function submitArrangement() {
    if (!state?.myHand) return;
    const cards = state.myHand.dealt_cards as CardT[];
    const front = cards.filter((c) => assignments[cardKey(c)] === "front");
    const middle = cards.filter((c) => assignments[cardKey(c)] === "middle");
    const back = cards.filter((c) => assignments[cardKey(c)] === "back");
    if (front.length !== 3 || middle.length !== 5 || back.length !== 5) {
      setError("Arrange into exactly 3 front / 5 middle / 5 back before submitting");
      return;
    }
    const res = await fetch(`/api/rooms/${code}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId, front, middle, back }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error);
    else poll();
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-neutral-950 text-red-400 p-6">
        {error}
      </main>
    );
  }
  if (!state) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-400 p-6">
        Loading room...
      </main>
    );
  }

  const { room, players, myHand, submittedCount, totalPlayers, latestResult } = state;
  const myPlayer = players.find((p: any) => p.id === playerId);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Room {room.room_code}</h1>
          <span className="text-neutral-400 text-sm">Round {room.round_number}</span>
        </header>

        {/* Players / leaderboard, always visible */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {players.map((p: any) => (
            <div
              key={p.id}
              className={`rounded-lg border p-3 ${p.seat === room.banka_seat ? "border-amber-400 bg-amber-950/30" : "border-neutral-800 bg-neutral-900"}`}
            >
              <div className="font-semibold flex items-center gap-1">
                {p.name} {p.seat === room.banka_seat && <span className="text-amber-400 text-xs">BANKA</span>}
              </div>
              <div className="text-sm text-neutral-400">
                {p.total_points} pts &middot; {p.rounds_won}W-{p.rounds_lost}L-{p.rounds_tied}T
              </div>
            </div>
          ))}
        </div>

        {/* Lobby */}
        {room.status === "waiting" && (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6 text-center space-y-4">
            <p>Waiting for players... ({totalPlayers}/4)</p>
            <p className="text-neutral-400 text-sm">Share code <span className="font-bold text-neutral-200">{room.room_code}</span> with your friends</p>
            {totalPlayers === 4 && (
              <button onClick={startGame} className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-6 py-3 font-semibold">
                Start Game
              </button>
            )}
          </div>
        )}

        {/* Arranging */}
        {room.status === "arranging" && myHand && !myHand.submitted && (
          <div className="space-y-4">
            <p className="text-neutral-400 text-sm">Tap a card to cycle it: pool &rarr; front &rarr; middle &rarr; back &rarr; pool</p>

            {(["front", "middle", "back"] as Slot[]).map((slot) => (
              <div key={slot}>
                <div className="text-sm text-neutral-400 mb-1 capitalize">
                  {slot} ({(myHand.dealt_cards as CardT[]).filter((c) => assignments[cardKey(c)] === slot).length}/{slot === "front" ? 3 : 5})
                </div>
                <div className="flex gap-2 flex-wrap min-h-[5.5rem]">
                  {(myHand.dealt_cards as CardT[])
                    .filter((c) => assignments[cardKey(c)] === slot)
                    .map((c) => (
                      <CardChip key={cardKey(c)} card={c} onClick={() => cycleCard(c)} highlight={slot} />
                    ))}
                </div>
              </div>
            ))}

            <div>
              <div className="text-sm text-neutral-400 mb-1">Pool</div>
              <div className="flex gap-2 flex-wrap">
                {(myHand.dealt_cards as CardT[])
                  .filter((c) => (assignments[cardKey(c)] ?? "pool") === "pool")
                  .map((c) => (
                    <CardChip key={cardKey(c)} card={c} onClick={() => cycleCard(c)} />
                  ))}
              </div>
            </div>

            <button
              onClick={submitArrangement}
              className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 py-3 font-semibold"
            >
              Submit
            </button>
          </div>
        )}

        {room.status === "arranging" && myHand?.submitted && (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6 text-center">
            Waiting for other players... ({submittedCount}/4 submitted)
          </div>
        )}

        {/* Revealed */}
        {room.status === "revealed" && latestResult && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Round {latestResult.round_number} results</h2>
            {latestResult.result.matchups.map((m: any, i: number) => {
              const otherSeats = [0, 1, 2, 3].filter((s) => s !== latestResult.banka_seat);
              const opponent = players.find((p: any) => p.seat === otherSeats[i]);
              return (
                <div key={i} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
                  <div className="font-semibold mb-1">
                    Banka vs {opponent?.name}
                    {m.resolvedBySpecial && (
                      <span className="ml-2 text-amber-400 text-sm">
                        Special! {m.bankaSpecial?.type ?? m.playerSpecial?.type}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-neutral-400">
                    {m.segments.map((s: any) => `${s.segment}: ${s.winner}`).join(" · ")}
                  </div>
                  <div className="text-sm mt-1">
                    Net to banka: <span className={m.bankaNetPoints >= 0 ? "text-emerald-400" : "text-red-400"}>{m.bankaNetPoints}</span>
                  </div>
                </div>
              );
            })}
            <button onClick={nextRound} className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 py-3 font-semibold">
              Next Round
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
