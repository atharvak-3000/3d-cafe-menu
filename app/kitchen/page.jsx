"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import PinPad from "@/components/PinPad";
import { db } from "@/lib/firebase";
import { ref, onValue, update } from "firebase/database";
import { CATEGORY_COLORS } from "@/lib/menuItems";

// ── constants ─────────────────────────────────────────────────────────────────
const KITCHEN_PIN = process.env.NEXT_PUBLIC_KITCHEN_PIN || "5678";

const STATUS_ORDER = { new: 0, preparing: 1, ready: 2 };

const STATUS_META = {
  new:       { label: "NEW",       border: "border-l-blue-500",   badge: "text-blue-400 border-blue-400/40" },
  preparing: { label: "COOKING",   border: "border-l-orange-500", badge: "text-orange-400 border-orange-400/40" },
  ready:     { label: "READY",     border: "border-l-[#5A9E6A]",  badge: "text-[#7BC98A] border-[#5A9E6A]/40" },
};

// ── helpers ───────────────────────────────────────────────────────────────────
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch (_) {}
}

function getElapsed(ts) {
  if (!ts) return "";
  const diffMs = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function formatTime(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

// ── ElapsedTimer — re-renders every 30s ──────────────────────────────────────
function ElapsedTimer({ ts }) {
  const [label, setLabel] = useState(() => getElapsed(ts));
  useEffect(() => {
    const id = setInterval(() => setLabel(getElapsed(ts)), 30000);
    return () => clearInterval(id);
  }, [ts]);
  return <span className="text-[#5A9E6A]/70 text-xs">{label}</span>;
}

// ── LiveClock ─────────────────────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono text-sm text-[#C8DCC8]/50 tabular-nums">{time}</span>;
}

// ── Ticket Card ───────────────────────────────────────────────────────────────
function Ticket({ order, onAdvance }) {
  const meta = STATUS_META[order.status] || STATUS_META.new;
  const ts   = order.placedAt || order.timestamp;

  return (
    <div
      className={`flex flex-col rounded-xl border-l-4 ${meta.border} overflow-hidden transition-all duration-300 hover:brightness-110`}
      style={{ background: "#111815", border: "1px solid rgba(90,158,106,0.15)", borderLeftWidth: "4px" }}
    >
      {/* Ticket Header */}
      <div className="px-4 pt-4 pb-3 border-b border-[rgba(90,158,106,0.1)]">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-mono text-[0.7rem] text-[#5A9E6A] tracking-widest font-bold">
              #{order.firebaseKey?.slice(-6).toUpperCase()}
            </p>
            <p className="font-mono text-2xl font-bold text-[#7BC98A] leading-tight mt-0.5">
              TABLE {order.table}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-xs text-[#C8DCC8]/40">{formatTime(ts)}</span>
              <span className="text-[#5A9E6A]/40">·</span>
              <ElapsedTimer ts={ts} />
            </div>
          </div>
          <span
            className={`font-mono text-[0.6rem] font-bold px-2 py-1 rounded border tracking-widest ${meta.badge}`}
          >
            {meta.label}
          </span>
        </div>
      </div>

      {/* Items */}
      <ul className="px-4 py-3 flex-1 space-y-3">
        {(order.items || []).map((item, i) => {
          const catBg = CATEGORY_COLORS[item.category] || "#E8D5A3";
          const hasImg = item.imageUrl && item.imageUrl.trim() !== "";
          return (
            <li key={i} className="flex items-center gap-3">
              <span className="font-mono font-bold tabular-nums text-lg shrink-0" style={{ color: "#7BC98A", minWidth: "2rem" }}>×{item.qty}</span>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: catBg, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                {hasImg
                  /* eslint-disable-next-line @next/next/no-img-element */
                  ? <img src={item.imageUrl} alt={item.name} style={{ height: "85%", width: "auto", maxWidth: "85%", objectFit: "contain", mixBlendMode: "multiply", filter: "drop-shadow(0 1px 3px rgba(44,24,16,0.15))" }} />
                  : <span className="text-xl">{item.emoji}</span>
                }
              </div>
              <span className="font-mono text-sm text-[#C8DCC8]/80 leading-tight">{item.name}</span>
            </li>
          );
        })}
      </ul>

      {/* Note */}
      {order.note && (
        <div
          className="mx-4 mb-3 pl-3 py-2 text-xs font-mono text-[#C9A84C]/70 italic leading-snug"
          style={{ borderLeft: "2px solid #C9A84C66" }}
        >
          {order.note}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[rgba(90,158,106,0.1)]">
        {order.status === "new" && (
          <button
            onClick={() => onAdvance(order.firebaseKey, "preparing")}
            className="w-full font-mono text-xs font-bold py-2.5 rounded-lg bg-orange-500/15 text-orange-400 border border-orange-500/20 hover:bg-orange-500/25 active:scale-95 transition-all tracking-widest uppercase"
          >
            → START COOKING
          </button>
        )}
        {order.status === "preparing" && (
          <button
            onClick={() => onAdvance(order.firebaseKey, "ready")}
            className="w-full font-mono text-xs font-bold py-2.5 rounded-lg bg-[#5A9E6A]/15 text-[#7BC98A] border border-[#5A9E6A]/20 hover:bg-[#5A9E6A]/25 active:scale-95 transition-all tracking-widest uppercase"
          >
            ✓ READY TO SERVE
          </button>
        )}
        {order.status === "ready" && (
          <p className="text-center font-mono text-xs text-[#5A9E6A]/40 tracking-widest uppercase py-1">
            ✓ AWAITING COLLECTION
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function KitchenPage() {
  const [authed, setAuthed]       = useState(false);
  const [orders, setOrders]       = useState([]);
  const [newAlert, setNewAlert]   = useState(false);
  const prevKeysRef               = useRef(new Set());
  const alertTimerRef             = useRef(null);

  useEffect(() => {
    if (!authed) return;
    const ordersRef = ref(db, "orders");
    const unsub = onValue(ordersRef, (snapshot) => {
      const data = snapshot.val() || {};
      const arr = Object.entries(data)
        .map(([key, val]) => ({ ...val, firebaseKey: key }))
        .filter((o) => o.status !== "paid")
        .sort((a, b) => {
          const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
          if (statusDiff !== 0) return statusDiff;
          return (a.timestamp || 0) - (b.timestamp || 0); // oldest first within same status
        });

      const incoming = new Set(arr.map((o) => o.firebaseKey));
      const isFirst  = prevKeysRef.current.size === 0;
      const hasNew   = !isFirst && [...incoming].some((k) => !prevKeysRef.current.has(k));

      if (hasNew) {
        playBeep();
        setNewAlert(true);
        clearTimeout(alertTimerRef.current);
        alertTimerRef.current = setTimeout(() => setNewAlert(false), 3500);
      }
      prevKeysRef.current = incoming;
      setOrders(arr);
    });
    return () => { unsub(); clearTimeout(alertTimerRef.current); };
  }, [authed]);

  const advanceStatus = useCallback((key, nextStatus) => {
    update(ref(db, `orders/${key}`), { status: nextStatus });
  }, []);

  const pendingCount = orders.filter((o) => o.status === "new").length;

  // ── PIN WALL ───────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <PinPad
        role="Kitchen"
        pin={KITCHEN_PIN}
        onSuccess={() => setAuthed(true)}
        dark={true}
      />
    );
  }

  // ── KDS ────────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen pb-12 relative overflow-x-hidden"
      style={{ background: "#080B0A", color: "#C8DCC8", fontFamily: "'DM Sans', 'Courier New', monospace" }}
    >
      {/* SCANLINE OVERLAY */}
      <div
        className="pointer-events-none fixed inset-0 z-[999]"
        style={{
          background:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.07) 2px, rgba(0,0,0,0.07) 4px)",
        }}
      />

      {/* NEW ORDER ALERT BANNER */}
      <div
        className={`fixed top-0 inset-x-0 z-[99] flex items-center justify-center py-3 gap-3 font-mono font-bold tracking-widest text-sm uppercase transition-all duration-500 ${
          newAlert
            ? "translate-y-0 opacity-100 bg-[#5A9E6A] text-[#080B0A]"
            : "-translate-y-full opacity-0 pointer-events-none bg-[#5A9E6A] text-[#080B0A]"
        }`}
      >
        <span className="text-lg">🔔</span>
        NEW ORDER RECEIVED
      </div>

      {/* TOPBAR */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-6 py-4 border-b"
        style={{
          background: "rgba(8,11,10,0.9)",
          backdropFilter: "blur(12px)",
          borderColor: "rgba(90,158,106,0.15)",
        }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold" style={{ fontFamily: "Georgia, serif", color: "#C8DCC8" }}>
            Lumière{" "}
            <span className="italic" style={{ color: "#5A9E6A" }}>
              Kitchen
            </span>
          </h1>
          <span className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.25em] px-2 py-1 rounded border border-[#5A9E6A]/30 text-[#5A9E6A]">
            KDS
          </span>
        </div>

        <div className="flex items-center gap-5">
          {/* Blinking LIVE */}
          <span className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full bg-[#5A9E6A] animate-ping"
              style={{ boxShadow: "0 0 6px 2px rgba(90,158,106,0.7)" }}
            />
            <span className="font-mono text-xs text-[#5A9E6A] font-bold tracking-widest hidden sm:inline">LIVE</span>
          </span>

          {/* Pending count */}
          <span
            className={`font-mono text-xs font-bold px-2.5 py-1 rounded border tracking-widest ${
              pendingCount > 0
                ? "text-orange-400 border-orange-400/30 bg-orange-400/10"
                : "text-[#C8DCC8]/30 border-[#C8DCC8]/10"
            }`}
          >
            {pendingCount} PENDING
          </span>

          <LiveClock />

          <button
            onClick={() => setAuthed(false)}
            className="font-mono text-xs px-3 py-1.5 rounded border border-[rgba(90,158,106,0.2)] text-[#C8DCC8]/40 hover:text-[#C8DCC8] hover:border-[rgba(90,158,106,0.5)] transition-all tracking-widest uppercase"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-40 opacity-20 text-center space-y-4">
            <span className="text-6xl grayscale">🍽️</span>
            <p className="font-mono text-lg tracking-widest uppercase">NO ACTIVE TICKETS</p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {orders.map((order) => (
              <Ticket key={order.firebaseKey} order={order} onAdvance={advanceStatus} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
