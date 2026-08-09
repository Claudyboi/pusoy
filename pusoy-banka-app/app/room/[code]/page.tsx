"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import { FaceIcon } from "@/lib/CardFace";

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

function CardFace({ card }: { card: CardT }) {
  const isFace = card.rank >= 11 && card.rank <= 13;
  return (
    <div className={`w-14 h-20 rounded-md border flex flex-col items-center justify-center font-semibold text-lg shrink-0 border-neutral-700 bg-neutral-900 ${SUIT_COLOR[card.suit]}`}>
      {isFace ? (
        <>
          <FaceIcon rank={card.rank} colorClass={SUIT_COLOR[card.suit]} />
          <span className="text-xs mt-0.5">{RANK_LABELS[card.rank]}{SUIT_SYMBOLS[card.suit]}</span>
        </>
      ) : (
        <>
          <span>{RANK_LABELS[card.rank]}</span>
          <span>{SUIT_SYMBOLS[card.suit]}</span>
        </>
      )}
    </div>
  );
}

function DraggableCard({ card }: { card: CardT }) {
  const key = cardKey(card);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: key });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50, opacity: isDragging ? 0.4 : 1 }
    : undefined;
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="touch-none cursor-grab active:cursor-grabbing">
      <CardFace card={card} />
    </div>
  );
}

function DroppableZone({ id, label, count, capacity, children }: { id: string; label: string; count: number; capacity: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div>
      <div className="text-sm text-neutral-400 mb-1">
        {label} ({count}/{capacity})
      </div>
      <div
        ref={setNodeRef}
        className={`flex gap-2 flex-wrap min-h-[5.5rem] rounded-lg border-2 border-dashed p-2 transition-colors ${
          isOver ? "border-emerald-400 bg-emerald-950/20" : "border-neutral-800"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

type Slot = "pool" | "front" | "middle" | "back";

const SLOT_LABELS: Record<Slot, string> = { pool: "Pool", front: "Bottom", middle: "Middle", back: "Top" };

export default function RoomPage() {
  const { code } = useParams<{ code: string }>();
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [state, setState] = useState<any>(null);
  const [error, setError] = useState("");
  const [assignments, setAssignments] = useState<Record<string, Slot>>({});
  const [roundKeyForAssignments, setRoundKeyForAssignments] = useState<string | null>(null);
  const [activeDragCard, setActiveDragCard] = useState<CardT | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } })
  );

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

  const capacity: Record<Slot, number> = { pool: Infinity, front: 3, middle: 5, back: 5 };

  function handleDragStart(event: any) {
    const key = event.active.id as string;
    const cards = (state?.myHand?.dealt_cards as CardT[]) ?? [];
    setActiveDragCard(cards.find((c) => cardKey(c) === key) ?? null);
  }

  function handleDragEnd(event: any) {
    setActiveDragCard(null);
    const { active, over } = event;
    if (!over) return;
    const key = active.id as string;
    const targetSlot = over.id as Slot;

    const counts = { front: 0, middle: 0, back: 0 } as Record<Slot, number>;
    for (const [k, s] of Object.entries(assignments)) {
      if (s !== "pool" && k !== key) counts[s as Slot]++;
    }
    if (targetSlot !== "pool" && counts[targetSlot] >= capacity[targetSlot]) {
      return; // slot full, ignore drop
    }
    setAssignments({ ...assignments, [key]: targetSlot });
  }

  function cycleCard(card: CardT) {
    const key = cardKey(card);
    const counts = { front: 0, middle: 0, back: 0 } as Record<Slot, number>;
    for (const s of Object.values(assignments)) if (s !== "pool") counts[s as Slot]++;

    const order: Slot[] = ["pool", "front", "middle", "back"];
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
      <main className="min-h-screen flex flex-col items-center justify-center bg-neutral-950 text-red-400 p-6 gap-4">
        <p>{error}</p>
        <Link href="/" className="rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-100 px-5 py-2 font-semibold">
          Back to Home
        </Link>
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

  const { room, players, myHand, submittedCount, latestResult, revealHands } = state;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-neutral-500 hover:text-neutral-300 text-sm">&larr; Home</Link>
            <h1 className="text-2xl font-bold">Room {room.room_code}</h1>
          </div>
          <span className="text-neutral-400 text-sm">Round {room.round_number}</span>
        </header>

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

        {room.status === "waiting" && (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6 text-center space-y-4">
            <p>Waiting for players... ({players.length}/4)</p>
            <p className="text-neutral-400 text-sm">Share code <span className="font-bold text-neutral-200">{room.room_code}</span> with your friends</p>
            {players.length === 4 && (
              <button onClick={startGame} className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-6 py-3 font-semibold">
                Start Game
              </button>
            )}
          </div>
        )}

        {room.status === "arranging" && myHand && !myHand.submitted && (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="space-y-4">
              <p className="text-neutral-400 text-sm">Drag cards into place (or tap to cycle Pool &rarr; Bottom &rarr; Middle &rarr; Top)</p>

              {(["front", "middle", "back"] as Slot[]).map((slot) => {
                const cardsInSlot = (myHand.dealt_cards as CardT[]).filter((c) => assignments[cardKey(c)] === slot);
                return (
                  <DroppableZone key={slot} id={slot} label={SLOT_LABELS[slot]} count={cardsInSlot.length} capacity={capacity[slot]}>
                    {cardsInSlot.map((c) => (
                      <div key={cardKey(c)} onClick={() => cycleCard(c)}>
                        <DraggableCard card={c} />
                      </div>
                    ))}
                  </DroppableZone>
                );
              })}

              <DroppableZone id="pool" label="Pool" count={(myHand.dealt_cards as CardT[]).filter((c) => (assignments[cardKey(c)] ?? "pool") === "pool").length} capacity={13}>
                {(myHand.dealt_cards as CardT[])
                  .filter((c) => (assignments[cardKey(c)] ?? "pool") === "pool")
                  .map((c) => (
                    <div key={cardKey(c)} onClick={() => cycleCard(c)}>
                      <DraggableCard card={c} />
                    </div>
                  ))}
              </DroppableZone>

              <button onClick={submitArrangement} className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 py-3 font-semibold">
                Submit
              </button>
            </div>

            <DragOverlay>{activeDragCard ? <CardFace card={activeDragCard} /> : null}</DragOverlay>
          </DndContext>
        )}

        {room.status === "arranging" && myHand?.submitted && (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6 text-center">
            Waiting for other players... ({submittedCount}/4 submitted)
          </div>
        )}

        {room.status === "revealed" && latestResult && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Round {latestResult.round_number} results</h2>

            {revealHands && (
              <div className="space-y-3">
                {[...revealHands]
                  .sort((a: any, b: any) => (a.seat === latestResult.banka_seat ? -1 : b.seat === latestResult.banka_seat ? 1 : a.seat - b.seat))
                  .map((h: any) => (
                    <div key={h.seat} className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
                      <div className="font-semibold mb-2 flex items-center gap-2">
                        {h.name}
                        {h.seat === latestResult.banka_seat && <span className="text-amber-400 text-xs">BANKA</span>}
                      </div>
                      {(["front", "middle", "back"] as const).map((slot) => (
                        <div key={slot} className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-neutral-500 w-14">{SLOT_LABELS[slot]}</span>
                          <div className="flex gap-1">
                            {(h[slot] as CardT[])?.map((c) => (
                              <div key={cardKey(c)} className="scale-75 -my-2 -mx-1">
                                <CardFace card={c} />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
              </div>
            )}

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
                    {m.segments.map((s: any) => `${SLOT_LABELS[s.segment as Slot]}: ${s.winner}`).join(" \u00b7 ")}
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
