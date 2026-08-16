"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface ChatMessage {
  id: string;
  sender_name: string;
  message: string;
  created_at: string;
}

interface OpenRoom {
  room_code: string;
  created_at: string;
  players: string[];
}

export default function ChatWidget() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"chat" | "rooms">("chat");
  const [name, setName] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [openRooms, setOpenRooms] = useState<OpenRoom[]>([]);
  const [joinError, setJoinError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setName(localStorage.getItem("pusoy-chat-name"));
  }, []);

  const poll = useCallback(async () => {
    const res = await fetch("/api/chat");
    if (!res.ok) return;
    const data = await res.json();
    setMessages(data.messages ?? []);
  }, []);

  const pollRooms = useCallback(async () => {
    const res = await fetch("/api/rooms/list");
    if (!res.ok) return;
    const data = await res.json();
    setOpenRooms(data.rooms ?? []);
  }, []);

  useEffect(() => {
    poll();
    pollRooms();
    const interval = setInterval(() => {
      poll();
      pollRooms();
    }, 3000);
    return () => clearInterval(interval);
  }, [poll, pollRooms]);

  useEffect(() => {
    if (open && tab === "chat" && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open, tab]);

  function saveName() {
    if (!nameInput.trim()) return;
    localStorage.setItem("pusoy-chat-name", nameInput.trim());
    setName(nameInput.trim());
  }

  async function send() {
    if (!draft.trim() || !name) return;
    const text = draft.trim();
    setDraft("");
    await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, message: text }),
    });
    poll();
  }

  async function joinOpenRoom(code: string) {
    if (!name) return;
    setJoinError("");
    const res = await fetch(`/api/rooms/${code}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) {
      setJoinError(data.error ?? "Couldn't join that room");
      pollRooms();
      return;
    }
    localStorage.setItem(`pusoy-player-${code}`, data.player.id);
    setOpen(false);
    router.push(`/room/${code}`);
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open ? (
        <div className="w-80 h-96 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl flex flex-col overflow-hidden">
          <div className="flex justify-between items-center px-3 py-2 border-b border-neutral-800">
            <div className="flex gap-1">
              <button
                onClick={() => setTab("chat")}
                className={`text-xs px-2 py-1 rounded font-semibold ${tab === "chat" ? "bg-emerald-600 text-white" : "text-neutral-400 hover:text-neutral-200"}`}
              >
                Chat
              </button>
              <button
                onClick={() => setTab("rooms")}
                className={`text-xs px-2 py-1 rounded font-semibold ${tab === "rooms" ? "bg-emerald-600 text-white" : "text-neutral-400 hover:text-neutral-200"}`}
              >
                Rooms {openRooms.length > 0 && `(${openRooms.length})`}
              </button>
            </div>
            <button onClick={() => setOpen(false)} className="text-neutral-400 hover:text-neutral-200 text-sm">
              ✕
            </button>
          </div>

          {!name ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4">
              <p className="text-sm text-neutral-400 text-center">Pick a name to chat or join rooms</p>
              <input
                className="w-full rounded bg-neutral-800 px-3 py-2 text-sm outline-none border border-neutral-700 text-neutral-100"
                placeholder="Your name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
              />
              <button onClick={saveName} className="w-full rounded bg-emerald-600 hover:bg-emerald-500 py-2 text-sm font-semibold text-white">
                Continue
              </button>
            </div>
          ) : tab === "chat" ? (
            <>
              <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
                {messages.length === 0 && (
                  <p className="text-xs text-neutral-500 text-center mt-4">No messages yet — say hi!</p>
                )}
                {messages.map((m) => (
                  <div key={m.id} className="text-sm">
                    <span className="font-semibold text-emerald-400">{m.sender_name}: </span>
                    <span className="text-neutral-200 break-words">{m.message}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 p-2 border-t border-neutral-800">
                <input
                  className="flex-1 rounded bg-neutral-800 px-3 py-2 text-sm outline-none border border-neutral-700 text-neutral-100"
                  placeholder="Message..."
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  maxLength={500}
                />
                <button onClick={send} className="rounded bg-emerald-600 hover:bg-emerald-500 px-3 text-sm font-semibold text-white">
                  Send
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
              {joinError && <p className="text-xs text-red-400">{joinError}</p>}
              {openRooms.length === 0 && (
                <p className="text-xs text-neutral-500 text-center mt-4">No open rooms right now — create one!</p>
              )}
              {openRooms.map((r) => (
                <div key={r.room_code} className="rounded-lg border border-neutral-800 bg-neutral-800/50 p-2.5 flex justify-between items-center">
                  <div>
                    <div className="text-sm font-semibold text-neutral-100">{r.room_code}</div>
                    <div className="text-xs text-neutral-400">
                      {r.players.length}/4 &middot; {r.players.join(", ") || "empty"}
                    </div>
                  </div>
                  <button
                    onClick={() => joinOpenRoom(r.room_code)}
                    className="rounded bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shrink-0"
                  >
                    Join
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="rounded-full bg-emerald-600 hover:bg-emerald-500 text-white w-14 h-14 shadow-lg flex items-center justify-center text-2xl"
          aria-label="Open chat"
        >
          💬
        </button>
      )}
    </div>
  );
}
