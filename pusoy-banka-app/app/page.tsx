"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function createRoom() {
    if (!name.trim()) return setError("Enter your name first");
    setLoading(true);
    setError("");
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error);
    localStorage.setItem(`pusoy-player-${data.room.room_code}`, data.player.id);
    router.push(`/room/${data.room.room_code}`);
  }

  async function joinRoom() {
    if (!name.trim()) return setError("Enter your name first");
    if (!joinCode.trim()) return setError("Enter a room code");
    setLoading(true);
    setError("");
    const code = joinCode.trim().toUpperCase();
    const res = await fetch(`/api/rooms/${code}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error);
    localStorage.setItem(`pusoy-player-${code}`, data.player.id);
    router.push(`/room/${code}`);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-100 p-6">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-3xl font-bold text-center">Pusoy Banka</h1>

        <input
          className="w-full rounded-lg bg-neutral-800 px-4 py-3 outline-none border border-neutral-700 focus:border-neutral-400"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <button
          onClick={createRoom}
          disabled={loading}
          className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 py-3 font-semibold disabled:opacity-50"
        >
          Create a room
        </button>

        <div className="flex items-center gap-3 text-neutral-500">
          <div className="h-px flex-1 bg-neutral-800" />
          or
          <div className="h-px flex-1 bg-neutral-800" />
        </div>

        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg bg-neutral-800 px-4 py-3 outline-none border border-neutral-700 focus:border-neutral-400 uppercase"
            placeholder="Room code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            maxLength={5}
          />
          <button
            onClick={joinRoom}
            disabled={loading}
            className="rounded-lg bg-neutral-700 hover:bg-neutral-600 px-5 font-semibold disabled:opacity-50"
          >
            Join
          </button>
        </div>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
      </div>
    </main>
  );
}
