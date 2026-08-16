import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET() {
  const { data: rooms, error } = await supabase
    .from("rooms")
    .select("id, room_code, status, created_at")
    .eq("status", "waiting")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const roomIds = (rooms ?? []).map((r) => r.id);
  let playersByRoom: Record<string, string[]> = {};
  if (roomIds.length > 0) {
    const { data: players } = await supabase
      .from("players")
      .select("room_id, name, is_bot")
      .in("room_id", roomIds);
    playersByRoom = {};
    for (const p of players ?? []) {
      if (p.is_bot) continue; // solo rooms are already full of bots, not joinable anyway
      (playersByRoom[p.room_id] ||= []).push(p.name);
    }
  }

  const openRooms = (rooms ?? [])
    .map((r) => ({
      room_code: r.room_code,
      created_at: r.created_at,
      players: playersByRoom[r.id] ?? [],
    }))
    .filter((r) => r.players.length < 4); // exclude full/solo rooms

  return NextResponse.json({ rooms: openRooms });
}
