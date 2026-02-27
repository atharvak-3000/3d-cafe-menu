"use client";

import { useState, useEffect, useCallback } from "react";
import PinPad from "@/components/PinPad";
import { db } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import { menuItems } from "@/lib/menuItems";

// ── env ──────────────────────────────────────────────────────────────────────
const ANALYTICS_PIN = process.env.NEXT_PUBLIC_ANALYTICS_PIN || "9999";

// ── helpers ───────────────────────────────────────────────────────────────────
function isToday(ts) {
  if (!ts) return false;
  const d = new Date(typeof ts === "number" ? ts : ts);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

function fmt(ts) {
  if (!ts) return "—";
  return new Date(typeof ts === "number" ? ts : ts).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Live Clock ────────────────────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono text-sm tabular-nums" style={{ color: "rgba(232,221,208,0.6)" }}>
      {time}
    </span>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color }) {
  return (
    <div
      style={{
        background: "#221A0F",
        borderRadius: 16,
        borderLeft: `3px solid ${color}`,
        padding: "22px 24px",
      }}
    >
      <p
        style={{
          fontSize: "0.7rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.15em",
          color: "rgba(232,221,208,0.45)",
          marginBottom: 6,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontFamily: "Georgia, serif",
          fontSize: "2rem",
          fontWeight: 700,
          color,
          lineHeight: 1,
          marginBottom: 4,
        }}
      >
        {value}
      </p>
      <p style={{ fontSize: "0.75rem", color: "rgba(232,221,208,0.4)" }}>{sub}</p>
    </div>
  );
}

// ── Status pill colours ───────────────────────────────────────────────────────
const STATUS_COLOR = {
  new:       { dot: "#3B82F6", label: "New",       bg: "rgba(59,130,246,0.10)"  },
  preparing: { dot: "#F97316", label: "Preparing", bg: "rgba(249,115,22,0.10)" },
  ready:     { dot: "#5A9E6A", label: "Ready",     bg: "rgba(90,158,106,0.10)" },
  paid:      { dot: "#C9A84C", label: "Paid",      bg: "rgba(201,168,76,0.10)" },
};

// ── Rank badge ────────────────────────────────────────────────────────────────
function RankBadge({ rank }) {
  if (rank === 1) return <span style={{ fontSize: "1.1rem" }}>🥇</span>;
  if (rank === 2) return <span style={{ fontSize: "1.1rem" }}>🥈</span>;
  if (rank === 3) return <span style={{ fontSize: "1.1rem" }}>🥉</span>;
  return (
    <span
      style={{
        fontFamily: "Georgia, serif",
        color: "rgba(232,221,208,0.4)",
        fontSize: "0.9rem",
      }}
    >
      {rank}
    </span>
  );
}

// ── CSV export ────────────────────────────────────────────────────────────────
function exportCsv(orders) {
  const header = ["Order ID", "Table", "Status", "Items", "Total", "Placed At", "Timestamp"];
  const rows = orders.map((o) => [
    o.firebaseKey?.slice(-6).toUpperCase() ?? "",
    o.table ?? "",
    o.status ?? "",
    `"${(o.items || []).map((i) => `${i.name} x${i.qty}`).join("; ")}"`,
    o.total ?? 0,
    o.placedAt ?? "",
    o.timestamp ?? "",
  ]);
  const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "lumiere-orders.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [authed, setAuthed] = useState(false);
  const [orders, setOrders] = useState([]);   // all orders raw

  // ── Firebase subscription ────────────────────────────────────────────────────
  useEffect(() => {
    if (!authed) return;
    const ordersRef = ref(db, "orders");
    const unsub = onValue(ordersRef, (snapshot) => {
      const data = snapshot.val() || {};
      const arr = Object.entries(data)
        .map(([key, val]) => ({ ...val, firebaseKey: key }))
        .sort((a, b) => (b.timestamp || b.placedAt || 0) - (a.timestamp || a.placedAt || 0));
      setOrders(arr);
    });
    return () => unsub();
  }, [authed]);

  // ── Derived analytics ─────────────────────────────────────────────────────────
  const paidOrders    = orders.filter((o) => o.status === "paid");
  const totalRevenue  = paidOrders.reduce((s, o) => s + (o.total || 0), 0);
  const avgOrderValue = paidOrders.length
    ? Math.round(totalRevenue / paidOrders.length)
    : 0;

  const ordersToday  = orders.filter((o) => isToday(o.timestamp || o.placedAt));
  const revenueToday = paidOrders
    .filter((o) => isToday(o.timestamp || o.placedAt))
    .reduce((s, o) => s + (o.total || 0), 0);

  // Most ordered item (by qty, across ALL orders)
  const itemQtyMap = {};
  orders.forEach((o) => {
    (o.items || []).forEach((it) => {
      itemQtyMap[it.name] = (itemQtyMap[it.name] || 0) + (it.qty || 1);
    });
  });
  const topItemName = Object.entries(itemQtyMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  // Status counts
  const statusCounts = { new: 0, preparing: 0, ready: 0, paid: 0 };
  orders.forEach((o) => { if (statusCounts[o.status] !== undefined) statusCounts[o.status]++; });

  // Top-selling items (ALL orders, by qty)
  const itemStats = {}; // name → { emoji, qty, orders, price }
  orders.forEach((o) => {
    (o.items || []).forEach((it) => {
      if (!itemStats[it.name]) {
        // look up price from menuItems list
        const master = menuItems.find((m) => m.name === it.name);
        itemStats[it.name] = {
          emoji:  it.emoji || "🍽️",
          qty:    0,
          orders: 0,
          price:  it.price || master?.price || 0,
        };
      }
      itemStats[it.name].qty    += it.qty || 1;
      itemStats[it.name].orders += 1;
    });
  });
  const topItems = Object.entries(itemStats)
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8);

  // Recent paid orders (last 10)
  const recentPaid = paidOrders.slice(0, 10);

  // ── PIN WALL ──────────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <PinPad
        role="Analytics"
        pin={ANALYTICS_PIN}
        onSuccess={() => setAuthed(true)}
        dark={false}
      />
    );
  }

  // ── DASHBOARD ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#0F0A07", color: "#E8DDD0", fontFamily: "DM Sans, sans-serif", paddingBottom: 64 }}>

      {/* ── TOPBAR ─────────────────────────────────────────────────────────────── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 28px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(15,10,7,0.88)",
          backdropFilter: "blur(14px)",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        {/* Left */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1
            style={{
              fontFamily: "Georgia, serif",
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "#E8DDD0",
              margin: 0,
            }}
          >
            Lumière <span style={{ color: "#C9A84C", fontStyle: "italic" }}>Café</span>
          </h1>
          <span
            style={{
              fontSize: "0.6rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              padding: "4px 10px",
              borderRadius: 999,
              border: "1px solid rgba(201,168,76,0.5)",
              color: "#C9A84C",
            }}
          >
            Analytics
          </span>
        </div>

        {/* Right */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <LiveClock />

          <button
            onClick={() => exportCsv(orders)}
            style={{
              padding: "7px 16px",
              borderRadius: 10,
              border: "1px solid rgba(201,168,76,0.4)",
              background: "rgba(201,168,76,0.08)",
              color: "#C9A84C",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "rgba(201,168,76,0.18)")}
            onMouseOut={(e) => (e.currentTarget.style.background = "rgba(201,168,76,0.08)")}
          >
            ↓ Export CSV
          </button>

          <button
            onClick={() => setAuthed(false)}
            style={{
              padding: "7px 16px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "transparent",
              color: "rgba(232,221,208,0.5)",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.color = "#E8DDD0")}
            onMouseOut={(e) => (e.currentTarget.style.color = "rgba(232,221,208,0.5)")}
          >
            Logout
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "36px 20px", display: "flex", flexDirection: "column", gap: 40 }}>

        {/* ── SECTION 1: KPI CARDS ──────────────────────────────────────────────── */}
        <section>
          <SectionTitle>Key Metrics</SectionTitle>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 16,
            }}
            className="kpi-grid"
          >
            <KpiCard
              label="Total Revenue"
              value={`₹${totalRevenue.toLocaleString("en-IN")}`}
              sub="from paid orders"
              color="#C9A84C"
            />
            <KpiCard
              label="Total Orders"
              value={orders.length}
              sub={`${paidOrders.length} paid · ${orders.length - paidOrders.length} pending`}
              color="#E8DDD0"
            />
            <KpiCard
              label="Avg Order Value"
              value={`₹${avgOrderValue}`}
              sub="per paid order"
              color="#C9A84C"
            />
            <KpiCard
              label="Orders Today"
              value={ordersToday.length}
              sub="since midnight"
              color="#5A9E6A"
            />
            <KpiCard
              label="Revenue Today"
              value={`₹${revenueToday.toLocaleString("en-IN")}`}
              sub="today's earnings"
              color="#5A9E6A"
            />
            <KpiCard
              label="Most Ordered Item"
              value={topItemName}
              sub="top seller"
              color="#C4807A"
            />
          </div>
        </section>

        {/* ── SECTION 2: TOP SELLING ITEMS ─────────────────────────────────────── */}
        <section>
          <SectionTitle>Top Selling Items</SectionTitle>
          <div style={{ background: "#1A1208", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.05)" }}>
            {topItems.length === 0 ? (
              <EmptyState>No order data yet</EmptyState>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.87rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    {["Rank", "Emoji", "Item Name", "Orders", "Qty Sold", "Revenue (₹)"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "12px 16px",
                          textAlign: h === "Rank" || h === "Emoji" ? "center" : "left",
                          color: "rgba(232,221,208,0.4)",
                          fontWeight: 700,
                          fontSize: "0.7rem",
                          textTransform: "uppercase",
                          letterSpacing: "0.12em",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topItems.map((item, idx) => (
                    <tr
                      key={item.name}
                      style={{
                        background: idx % 2 === 0 ? "#221A0F" : "#1A1208",
                        borderBottom: "1px solid rgba(255,255,255,0.03)",
                        transition: "background 0.15s",
                      }}
                    >
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        <RankBadge rank={idx + 1} />
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center", fontSize: "1.2rem" }}>
                        {item.emoji}
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 600, color: "#E8DDD0" }}>
                        {item.name}
                      </td>
                      <td style={{ padding: "12px 16px", color: "rgba(232,221,208,0.55)", tabularNums: true }}>
                        {item.orders}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          fontFamily: "Georgia, serif",
                          fontWeight: 700,
                          color: "#C9A84C",
                        }}
                      >
                        {item.qty}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          fontFamily: "Georgia, serif",
                          color: "#5A9E6A",
                          fontWeight: 700,
                        }}
                      >
                        ₹{(item.qty * item.price).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* ── SECTION 3: STATUS BREAKDOWN ──────────────────────────────────────── */}
        <section>
          <SectionTitle>Orders by Status</SectionTitle>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {Object.entries(STATUS_COLOR).map(([key, meta]) => {
              const count = statusCounts[key] || 0;
              const pct   = orders.length ? Math.round((count / orders.length) * 100) : 0;
              return (
                <div
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 20px",
                    borderRadius: 999,
                    background: meta.bg,
                    border: `1px solid ${meta.dot}30`,
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: "50%",
                      background: meta.dot,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontWeight: 600, color: "#E8DDD0", fontSize: "0.85rem" }}>
                    {meta.label}
                  </span>
                  <span
                    style={{
                      fontFamily: "Georgia, serif",
                      fontWeight: 700,
                      color: meta.dot,
                      fontSize: "1rem",
                    }}
                  >
                    {count}
                  </span>
                  <span style={{ color: "rgba(232,221,208,0.35)", fontSize: "0.78rem" }}>
                    ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── SECTION 4: RECENT PAID ORDERS ────────────────────────────────────── */}
        <section>
          <SectionTitle>Recent Paid Orders</SectionTitle>
          <div style={{ background: "#1A1208", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.05)" }}>
            {recentPaid.length === 0 ? (
              <EmptyState>No paid orders yet</EmptyState>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.87rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    {["Order ID", "Table", "Items", "Total", "Time"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "12px 16px",
                          textAlign: "left",
                          color: "rgba(232,221,208,0.4)",
                          fontWeight: 700,
                          fontSize: "0.7rem",
                          textTransform: "uppercase",
                          letterSpacing: "0.12em",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentPaid.map((order, idx) => {
                    const items   = order.items || [];
                    const first2  = items.slice(0, 2).map((i) => i.name).join(", ");
                    const extra   = items.length > 2 ? ` & ${items.length - 2} more` : "";
                    const summary = first2 + extra;
                    return (
                      <tr
                        key={order.firebaseKey}
                        style={{
                          background: idx % 2 === 0 ? "#221A0F" : "#1A1208",
                          borderBottom: "1px solid rgba(255,255,255,0.03)",
                        }}
                      >
                        <td style={{ padding: "12px 16px" }}>
                          <span
                            style={{
                              fontFamily: "Georgia, serif",
                              fontWeight: 700,
                              color: "#C9A84C",
                              fontSize: "0.95rem",
                            }}
                          >
                            #{order.firebaseKey?.slice(-6).toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", color: "#E8DDD0", fontWeight: 600 }}>
                          {order.table}
                        </td>
                        <td style={{ padding: "12px 16px", color: "rgba(232,221,208,0.6)", maxWidth: 260 }}>
                          {summary || "—"}
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            fontFamily: "Georgia, serif",
                            fontWeight: 700,
                            color: "#5A9E6A",
                          }}
                        >
                          ₹{order.total}
                        </td>
                        <td style={{ padding: "12px 16px", color: "rgba(232,221,208,0.4)", fontVariantNumeric: "tabular-nums" }}>
                          {fmt(order.timestamp || order.placedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>

      {/* responsive KPI grid on mobile */}
      <style>{`
        @media (max-width: 640px) {
          .kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}

// ── tiny helpers ──────────────────────────────────────────────────────────────
function SectionTitle({ children }) {
  return (
    <h2
      style={{
        fontFamily: "Georgia, serif",
        fontSize: "1.2rem",
        fontWeight: 700,
        color: "#C9A84C",
        marginBottom: 16,
        marginTop: 0,
      }}
    >
      {children}
    </h2>
  );
}

function EmptyState({ children }) {
  return (
    <div
      style={{
        padding: "48px 24px",
        textAlign: "center",
        color: "rgba(232,221,208,0.25)",
        fontStyle: "italic",
        fontFamily: "Georgia, serif",
      }}
    >
      {children}
    </div>
  );
}
