"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import PinPad from "@/components/PinPad";
import { db } from "@/lib/firebase";
import { ref, onValue, update } from "firebase/database";

// ── helpers ──────────────────────────────────────────────────────────────────
const CASHIER_PIN = process.env.NEXT_PUBLIC_CASHIER_PIN || "1234";

const STATUS_META = {
  new:        { label: "New",        color: "#3B82F6", border: "border-l-blue-500",  badge: "bg-blue-500/15 text-blue-400" },
  preparing:  { label: "Preparing",  color: "#C9784C", border: "border-l-orange-500",badge: "bg-orange-500/15 text-orange-400" },
  ready:      { label: "Ready",      color: "#5A9E6A", border: "border-l-green-500", badge: "bg-green-500/15 text-green-400" },
  paid:       { label: "Paid",       color: "#6B7280", border: "border-l-gray-500",  badge: "bg-gray-500/15 text-gray-400" },
};

const NEXT_STATUS  = { new: "preparing", preparing: "ready", ready: "paid" };
const NEXT_LABEL   = { new: "→ Preparing", preparing: "→ Ready", ready: "✓ Paid" };

function formatTime(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch (_) {}
}

// ── subcomponent: Clock ───────────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono text-sm text-[#E8DDD0]/70 tabular-nums">{time}</span>;
}

// ── subcomponent: OrderCard ────────────────────────────────────────────────────
function OrderCard({ order, onAdvance }) {
  const meta = STATUS_META[order.status] || STATUS_META.new;
  const next = NEXT_STATUS[order.status];

  return (
    <div
      className={`bg-[#221A0F] rounded-2xl border-l-4 ${meta.border} shadow-lg flex flex-col overflow-hidden transition-all duration-300 hover:scale-[1.01] hover:shadow-xl`}
    >
      {/* Header */}
      <div className="flex justify-between items-start px-5 pt-5 pb-3">
        <div>
          <span
            className="text-[1.1rem] font-bold tracking-wide"
            style={{ fontFamily: "Georgia, serif", color: "#C9A84C" }}
          >
            #{order.firebaseKey?.slice(-6).toUpperCase()}
          </span>
          <p className="text-[#E8DDD0]/50 text-xs mt-0.5">
            Table {order.table} · {formatTime(order.timestamp || order.placedAt)}
          </p>
        </div>
        <span className={`text-xs font-bold px-3 py-1 rounded-full ${meta.badge}`}>
          {meta.label}
        </span>
      </div>

      {/* Items */}
      <ul className="px-5 space-y-2 flex-1">
        {(order.items || []).map((item, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-[#E8DDD0]/80">
            <span className="text-base">{item.emoji}</span>
            <span className="flex-1 leading-tight">{item.name}</span>
            <span className="text-[#E8DDD0]/40">×{item.qty}</span>
            <span className="text-[#C9A84C] font-semibold tabular-nums">
              ₹{item.price * item.qty}
            </span>
          </li>
        ))}
      </ul>

      {/* Note */}
      {order.note && (
        <div className="mx-5 mt-3 border-l-2 border-[#C9A84C] pl-3 py-1">
          <p className="text-xs text-[#E8DDD0]/50 italic leading-snug">{order.note}</p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-4 mt-3 border-t border-white/5">
        <span
          className="text-[1.4rem] font-bold text-[#E8DDD0]"
          style={{ fontFamily: "Georgia, serif" }}
        >
          ₹{order.total}
        </span>
        {next && (
          <button
            onClick={() => onAdvance(order.firebaseKey, next)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${
              next === "preparing"
                ? "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30"
                : next === "ready"
                ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                : "bg-[#C9A84C]/20 text-[#C9A84C] hover:bg-[#C9A84C]/30"
            }`}
          >
            {NEXT_LABEL[order.status]}
          </button>
        )}
      </div>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function CashierPage() {
  const [authed, setAuthed]             = useState(false);
  const [orders, setOrders]             = useState([]);
  const [activeTab, setActiveTab]       = useState("All");
  const [newAlert, setNewAlert]         = useState(false);
  const prevKeysRef                     = useRef(new Set());
  const alertTimerRef                   = useRef(null);

  // Subscribe to Firebase
  useEffect(() => {
    if (!authed) return;
    const ordersRef = ref(db, "orders");
    const unsub = onValue(ordersRef, (snapshot) => {
      const data = snapshot.val() || {};
      const arr = Object.entries(data)
        .map(([key, val]) => ({ ...val, firebaseKey: key }))
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      // Detect new orders
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

  // Stats
  const newCount      = orders.filter((o) => o.status === "new").length;
  const prepCount     = orders.filter((o) => o.status === "preparing").length;
  const readyCount    = orders.filter((o) => o.status === "ready").length;
  const revenue       = orders
    .filter((o) => o.status === "paid")
    .reduce((s, o) => s + (o.total || 0), 0);

  // Filter
  const TABS = ["All", "New", "Preparing", "Ready", "Paid"];
  const visible =
    activeTab === "All"
      ? orders
      : orders.filter((o) => o.status === activeTab.toLowerCase());

  // ── PIN WALL ────────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <PinPad
        role="Cashier"
        pin={CASHIER_PIN}
        onSuccess={() => setAuthed(true)}
        dark={false}
      />
    );
  }

  // ── DASHBOARD ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen pb-12" style={{ background: "#0F0A07", color: "#E8DDD0" }}>

      {/* NEW ORDER ALERT BANNER */}
      <div
        className={`fixed top-0 inset-x-0 z-[99] flex items-center justify-center py-3 gap-3 transition-all duration-500 ${
          newAlert
            ? "translate-y-0 opacity-100 bg-[#C9A84C]"
            : "-translate-y-full opacity-0 pointer-events-none bg-[#C9A84C]"
        }`}
      >
        <span className="text-lg">🔔</span>
        <span className="font-bold text-[#0F0A07] tracking-wide">New order received!</span>
      </div>

      {/* TOPBAR */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-6 py-4 border-b border-white/5"
        style={{ background: "rgba(15,10,7,0.85)", backdropFilter: "blur(12px)" }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold" style={{ fontFamily: "Georgia, serif", color: "#E8DDD0" }}>
            Lumière <span className="italic" style={{ color: "#C9A84C" }}>Café</span>
          </h1>
          <span className="text-[0.65rem] font-bold uppercase tracking-[0.2em] px-2.5 py-1 rounded-full border border-[#C9A84C]/40 text-[#C9A84C]">
            Cashier
          </span>
        </div>

        <div className="flex items-center gap-5">
          {/* Live dot */}
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#5A9E6A] shadow-[0_0_6px_2px_rgba(90,158,106,0.7)] animate-pulse" />
            <span className="text-xs text-[#5A9E6A] font-semibold hidden sm:inline">Live</span>
          </span>

          <LiveClock />

          {/* Alert icon */}
          <button
            className={`relative text-xl transition-transform ${newAlert ? "animate-bounce" : ""}`}
            title="New Order"
          >
            🔔
            {newCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#C9A84C] text-[#0F0A07] text-[0.55rem] font-black w-4 h-4 rounded-full flex items-center justify-center">
                {newCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setAuthed(false)}
            className="text-sm px-4 py-2 rounded-xl border border-white/10 text-[#E8DDD0]/50 hover:text-[#E8DDD0] hover:border-white/20 transition-all"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-8">

        {/* STATS BAR */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "New Orders",  value: newCount,               valueColor: "#C9A84C", icon: "🆕" },
            { label: "Preparing",   value: prepCount,              valueColor: "#C9784C", icon: "👨‍🍳" },
            { label: "Ready",       value: readyCount,             valueColor: "#5A9E6A", icon: "✅" },
            { label: "Revenue",     value: `₹${revenue}`,          valueColor: "#C9A84C", icon: "💰" },
          ].map(({ label, value, valueColor, icon }) => (
            <div
              key={label}
              className="rounded-2xl p-5 flex items-center gap-4 border border-white/5"
              style={{ background: "#1A1208" }}
            >
              <span className="text-2xl">{icon}</span>
              <div>
                <p className="text-xs text-[#E8DDD0]/40 uppercase tracking-widest font-semibold">{label}</p>
                <p
                  className="text-2xl font-bold mt-0.5 tabular-nums"
                  style={{ fontFamily: "Georgia, serif", color: valueColor }}
                >
                  {value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* FILTER TABS */}
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-200 ${
                activeTab === tab
                  ? "bg-[#C9A84C] text-[#0F0A07]"
                  : "bg-[#1A1208] text-[#E8DDD0]/50 border border-white/5 hover:text-[#E8DDD0] hover:border-white/10"
              }`}
            >
              {tab}
              {tab !== "All" && (
                <span className="ml-1.5 opacity-60">
                  ({orders.filter((o) => o.status === tab.toLowerCase() || (tab === "All")).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ORDER GRID */}
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center opacity-30 space-y-3">
            <span className="text-6xl grayscale">🧾</span>
            <p className="text-lg italic" style={{ fontFamily: "Georgia, serif" }}>
              No {activeTab === "All" ? "" : activeTab.toLowerCase() + " "}orders yet
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-5">
            {visible.map((order) => (
              <OrderCard key={order.firebaseKey} order={order} onAdvance={advanceStatus} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
