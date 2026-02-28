"use client";

import { useState, useEffect } from "react";
import PinPad from "@/components/PinPad";
import { db } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import { menuItems } from "@/lib/menuItems";

const ANALYTICS_PIN = process.env.NEXT_PUBLIC_ANALYTICS_PIN || "9999";

function isToday(ts) {
  if (!ts) return false;
  const d = new Date(ts), n = new Date();
  return d.getDate()===n.getDate() && d.getMonth()===n.getMonth() && d.getFullYear()===n.getFullYear();
}
function fmt(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});
}
function exportCsv(orders) {
  const header = ["Order ID","Table","Status","Items","Total","Placed At"];
  const rows = orders.map(o=>[
    o.firebaseKey?.slice(-6).toUpperCase()??"", o.table??"", o.status??"",
    `"${(o.items||[]).map(i=>`${i.name} x${i.qty}`).join("; ")}"`,
    o.total??0, o.placedAt??""
  ]);
  const csv=[header,...rows].map(r=>r.join(",")).join("\n");
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
  a.download="lumiere-orders.csv"; a.click();
}

const STATUS_COLOR = {
  new:      {dot:"#3B82F6",label:"New",      bg:"rgba(59,130,246,.10)"},
  preparing:{dot:"#F97316",label:"Preparing",bg:"rgba(249,115,22,.10)"},
  ready:    {dot:"#5A9E6A",label:"Ready",    bg:"rgba(90,158,106,.10)"},
  paid:     {dot:"#C9A84C",label:"Paid",     bg:"rgba(201,168,76,.10)"},
};

function KpiCard({label,value,sub,color}) {
  return (
    <div style={{background:"#221A0F",borderRadius:16,borderLeft:`3px solid ${color}`,padding:"16px 18px"}}>
      <p style={{fontSize:"clamp(0.6rem,1.5vw,0.7rem)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.15em",color:"rgba(232,221,208,.45)",marginBottom:6}}>{label}</p>
      <p style={{fontFamily:"Georgia,serif",fontSize:"clamp(1.2rem,4vw,2rem)",fontWeight:700,color,lineHeight:1,marginBottom:4}}>{value}</p>
      <p style={{fontSize:"0.72rem",color:"rgba(232,221,208,.4)"}}>{sub}</p>
    </div>
  );
}

function SectionTitle({children}) {
  return <h2 style={{fontFamily:"Georgia,serif",fontSize:"clamp(1rem,3vw,1.2rem)",fontWeight:700,color:"#C9A84C",marginBottom:16,marginTop:0}}>{children}</h2>;
}
function EmptyState({children}) {
  return <div style={{padding:"48px 24px",textAlign:"center",color:"rgba(232,221,208,.25)",fontStyle:"italic",fontFamily:"Georgia,serif"}}>{children}</div>;
}
function RankBadge({rank}) {
  if(rank===1) return <span>🥇</span>;
  if(rank===2) return <span>🥈</span>;
  if(rank===3) return <span>🥉</span>;
  return <span style={{fontFamily:"Georgia,serif",color:"rgba(232,221,208,.4)",fontSize:"0.9rem"}}>{rank}</span>;
}

export default function AnalyticsPage() {
  const [authed,setAuthed] = useState(false);
  const [orders,setOrders] = useState([]);

  useEffect(()=>{
    if(!authed) return;
    const unsub=onValue(ref(db,"orders"),(snap)=>{
      const data=snap.val()||{};
      setOrders(Object.entries(data).map(([k,v])=>({...v,firebaseKey:k})).sort((a,b)=>(b.timestamp||0)-(a.timestamp||0)));
    });
    return()=>unsub();
  },[authed]);

  const paidOrders   = orders.filter(o=>o.status==="paid");
  const totalRevenue = paidOrders.reduce((s,o)=>s+(o.total||0),0);
  const avgOrder     = paidOrders.length ? Math.round(totalRevenue/paidOrders.length) : 0;
  const ordersToday  = orders.filter(o=>isToday(o.timestamp||o.placedAt));
  const revToday     = paidOrders.filter(o=>isToday(o.timestamp||o.placedAt)).reduce((s,o)=>s+(o.total||0),0);

  const itemQtyMap={};
  orders.forEach(o=>(o.items||[]).forEach(it=>{ itemQtyMap[it.name]=(itemQtyMap[it.name]||0)+(it.qty||1); }));
  const topItemName=Object.entries(itemQtyMap).sort((a,b)=>b[1]-a[1])[0]?.[0]??"—";

  const statusCounts={new:0,preparing:0,ready:0,paid:0};
  orders.forEach(o=>{ if(statusCounts[o.status]!==undefined) statusCounts[o.status]++; });

  const itemStats={};
  orders.forEach(o=>(o.items||[]).forEach(it=>{
    if(!itemStats[it.name]){ const m=menuItems.find(x=>x.name===it.name); itemStats[it.name]={emoji:it.emoji||"🍽️",qty:0,orders:0,price:it.price||m?.price||0}; }
    itemStats[it.name].qty+=it.qty||1; itemStats[it.name].orders+=1;
  }));
  const topItems=Object.entries(itemStats).map(([name,s])=>({name,...s})).sort((a,b)=>b.qty-a.qty).slice(0,8);
  const recentPaid=paidOrders.slice(0,10);

  if(!authed) return <PinPad role="Analytics" pin={ANALYTICS_PIN} onSuccess={()=>setAuthed(true)} dark={false}/>;

  return (
    <div style={{minHeight:"100vh",background:"#0F0A07",color:"#E8DDD0",fontFamily:"DM Sans,sans-serif",paddingBottom:64}}>

      {/* TOPBAR */}
      <header style={{position:"sticky",top:0,zIndex:40,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderBottom:"1px solid rgba(255,255,255,.06)",background:"rgba(15,10,7,.88)",backdropFilter:"blur(14px)",gap:12,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
          <h1 style={{fontFamily:"Georgia,serif",fontSize:"clamp(1.1rem,3vw,1.5rem)",fontWeight:700,color:"#E8DDD0",margin:0,whiteSpace:"nowrap"}}>
            Lumière <span style={{color:"#C9A84C",fontStyle:"italic"}}>Café</span>
          </h1>
          <span style={{fontSize:"0.6rem",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.2em",padding:"4px 10px",borderRadius:999,border:"1px solid rgba(201,168,76,.5)",color:"#C9A84C",whiteSpace:"nowrap"}}>Analytics</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <button onClick={()=>setAuthed(false)} style={{padding:"8px 14px",borderRadius:10,border:"1px solid rgba(255,255,255,.1)",background:"transparent",color:"rgba(232,221,208,.5)",fontSize:"0.82rem",fontWeight:600,cursor:"pointer",minHeight:44}}>Logout</button>
        </div>
      </header>

      <main style={{maxWidth:1200,margin:"0 auto",padding:"clamp(20px,4vw,36px) clamp(12px,4vw,20px)",display:"flex",flexDirection:"column",gap:"clamp(28px,5vw,40px)"}}>

        {/* KPI CARDS */}
        <section>
          <SectionTitle>Key Metrics</SectionTitle>
          {/* Export CSV on mobile goes below KPI cards */}
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
            <button onClick={()=>exportCsv(orders)} style={{padding:"8px 16px",borderRadius:10,border:"1px solid rgba(201,168,76,.4)",background:"rgba(201,168,76,.08)",color:"#C9A84C",fontSize:"0.82rem",fontWeight:700,cursor:"pointer",minHeight:44}}>↓ Export CSV</button>
          </div>
          <div className="kpi-grid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"clamp(10px,2vw,16px)"}}>
            <KpiCard label="Total Revenue"  value={`₹${totalRevenue.toLocaleString("en-IN")}`} sub="from paid orders"   color="#C9A84C"/>
            <KpiCard label="Total Orders"   value={orders.length}                                sub={`${paidOrders.length} paid`} color="#E8DDD0"/>
            <KpiCard label="Avg Order"      value={`₹${avgOrder}`}                              sub="per paid order"    color="#C9A84C"/>
            <KpiCard label="Orders Today"   value={ordersToday.length}                          sub="since midnight"    color="#5A9E6A"/>
            <KpiCard label="Revenue Today"  value={`₹${revToday.toLocaleString("en-IN")}`}      sub="today's earnings"  color="#5A9E6A"/>
            <KpiCard label="Top Seller"     value={topItemName}                                 sub="most ordered"       color="#C4807A"/>
          </div>
        </section>

        {/* TOP ITEMS TABLE */}
        <section>
          <SectionTitle>Top Selling Items</SectionTitle>
          <div style={{background:"#1A1208",borderRadius:16,overflow:"hidden",border:"1px solid rgba(255,255,255,.05)"}}>
            {topItems.length===0 ? <EmptyState>No order data yet</EmptyState> : (
              <div className="table-scroll">
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:"clamp(0.78rem,2vw,0.87rem)"}}>
                  <thead>
                    <tr style={{borderBottom:"1px solid rgba(255,255,255,.07)"}}>
                      {["Rank","","Item","Orders","Qty","Revenue (₹)"].map(h=>(
                        <th key={h} style={{padding:"10px 14px",textAlign:h==="Rank"||h===""?"center":"left",color:"rgba(232,221,208,.4)",fontWeight:700,fontSize:"0.68rem",textTransform:"uppercase",letterSpacing:"0.12em",whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topItems.map((item,idx)=>(
                      <tr key={item.name} style={{background:idx%2===0?"#221A0F":"#1A1208",borderBottom:"1px solid rgba(255,255,255,.03)"}}>
                        <td style={{padding:"10px 14px",textAlign:"center"}}><RankBadge rank={idx+1}/></td>
                        <td style={{padding:"10px 14px",textAlign:"center",fontSize:"1.1rem"}}>{item.emoji}</td>
                        <td style={{padding:"10px 14px",fontWeight:600,color:"#E8DDD0",whiteSpace:"nowrap"}}>{item.name}</td>
                        <td style={{padding:"10px 14px",color:"rgba(232,221,208,.55)"}}>{item.orders}</td>
                        <td style={{padding:"10px 14px",fontFamily:"Georgia,serif",fontWeight:700,color:"#C9A84C"}}>{item.qty}</td>
                        <td style={{padding:"10px 14px",fontFamily:"Georgia,serif",color:"#5A9E6A",fontWeight:700}}>₹{(item.qty*item.price).toLocaleString("en-IN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* STATUS BREAKDOWN */}
        <section>
          <SectionTitle>Orders by Status</SectionTitle>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:10}}>
            {Object.entries(STATUS_COLOR).map(([key,meta])=>{
              const count=statusCounts[key]||0;
              const pct=orders.length ? Math.round((count/orders.length)*100) : 0;
              return (
                <div key={key} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",borderRadius:16,background:meta.bg,border:`1px solid ${meta.dot}30`,minHeight:52}}>
                  <span style={{width:9,height:9,borderRadius:"50%",background:meta.dot,flexShrink:0}}/>
                  <div>
                    <p style={{margin:0,fontWeight:600,color:"#E8DDD0",fontSize:"0.82rem"}}>{meta.label}</p>
                    <p style={{margin:0,fontFamily:"Georgia,serif",fontWeight:700,color:meta.dot,fontSize:"1rem"}}>{count} <span style={{color:"rgba(232,221,208,.35)",fontSize:"0.75rem"}}>({pct}%)</span></p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* RECENT PAID ORDERS */}
        <section>
          <SectionTitle>Recent Paid Orders</SectionTitle>
          <div style={{background:"#1A1208",borderRadius:16,overflow:"hidden",border:"1px solid rgba(255,255,255,.05)"}}>
            {recentPaid.length===0 ? <EmptyState>No paid orders yet</EmptyState> : (
              <div className="table-scroll">
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:"clamp(0.78rem,2vw,0.87rem)"}}>
                  <thead>
                    <tr style={{borderBottom:"1px solid rgba(255,255,255,.07)"}}>
                      {["Order ID","Table","Items","Total","Time"].map(h=>(
                        <th key={h} style={{padding:"10px 14px",textAlign:"left",color:"rgba(232,221,208,.4)",fontWeight:700,fontSize:"0.68rem",textTransform:"uppercase",letterSpacing:"0.12em",whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentPaid.map((order,idx)=>{
                      const items=order.items||[];
                      const summary=items.slice(0,2).map(i=>i.name).join(", ")+(items.length>2?` & ${items.length-2} more`:"");
                      return (
                        <tr key={order.firebaseKey} style={{background:idx%2===0?"#221A0F":"#1A1208",borderBottom:"1px solid rgba(255,255,255,.03)"}}>
                          <td style={{padding:"10px 14px"}}><span style={{fontFamily:"Georgia,serif",fontWeight:700,color:"#C9A84C",fontSize:"0.92rem"}}>#{order.firebaseKey?.slice(-6).toUpperCase()}</span></td>
                          <td style={{padding:"10px 14px",color:"#E8DDD0",fontWeight:600}}>{order.table}</td>
                          <td style={{padding:"10px 14px",color:"rgba(232,221,208,.6)",maxWidth:200,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{summary||"—"}</td>
                          <td style={{padding:"10px 14px",fontFamily:"Georgia,serif",fontWeight:700,color:"#5A9E6A"}}>₹{order.total}</td>
                          <td style={{padding:"10px 14px",color:"rgba(232,221,208,.4)",whiteSpace:"nowrap"}}>{fmt(order.timestamp||order.placedAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
