"use client";

import { useState, useEffect, useRef } from "react";
import { menuItems as DEFAULT_ITEMS, CATEGORY_COLORS } from "@/lib/menuItems";
import { db } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";

const KEYFRAMES = `
@keyframes toastIn {
  from { opacity: 0; transform: translateY(16px) scale(0.9); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes cartGlow {
  0%,100% { box-shadow:0 0 8px rgba(201,168,76,.4),0 0 20px rgba(201,168,76,.2),0 4px 15px rgba(44,24,16,.3); }
  50%      { box-shadow:0 0 16px rgba(201,168,76,.8),0 0 40px rgba(201,168,76,.4),0 4px 20px rgba(44,24,16,.4); }
}
@keyframes badgePulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }
@keyframes cartBump   { 0%{transform:scale(1)} 50%{transform:scale(1.08)} 100%{transform:scale(1)} }
@keyframes shimmer    {
  0%   { background-position: -200% 0; transform: translateX(-150%) skewX(-20deg); }
  100% { background-position:  200% 0; transform: translateX(250%)  skewX(-20deg); }
}
@keyframes dropIn     { 0%{opacity:0;transform:scale(.7) translateY(-40px)} 100%{opacity:1;transform:scale(1) translateY(0)} }
@keyframes skelPulse  { 0%,100%{opacity:.5} 50%{opacity:1} }
@keyframes popularityFill { from { width: 0%; } to { width: 100%; } }
`;

function SkeletonCard() {
  return (
    <div style={{ background:"#FDFAF5",borderRadius:32,overflow:"hidden",animation:"skelPulse 1.4s ease-in-out infinite" }}>
      <div style={{ height:160,background:"#EDE8E0" }} />
      <div style={{ padding:"22px 22px 28px" }}>
        {[["40%",10],["80%",22],["90%",12],["60%",12]].map(([w,h],i)=>(
          <div key={i} style={{ height:h,width:w,background:"#EDE8E0",borderRadius:6,marginBottom:i===1?8:i===2?4:16 }} />
        ))}
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div style={{ height:28,width:60,background:"#EDE8E0",borderRadius:6 }} />
          <div style={{ height:42,width:42,borderRadius:"50%",background:"#EDE8E0" }} />
        </div>
      </div>
    </div>
  );
}
/* ─── Cloudinary URL helper ──────────────────────────────────────────────────
   Injects e_background_removal + category colour so white bg is fully removed
   even if the server-side transformation wasn't run at upload time.
────────────────────────────────────────────────────────────────────────────── */
const CAT_HEX = {
  coffee: "E8D5A3",
  tea:    "C8DCCA",
  food:   "F0D5C5",
  sweet:  "F0C8C8",
};
function getCloudinaryUrl(url, category) {
  if (!url?.includes("cloudinary.com")) return url;
  const hex = CAT_HEX[category] || "F7F2EA";
  // Only inject if not already transformed
  if (url.includes("/upload/e_background_removal")) return url;
  return url.replace(
    "/upload/",
    `/upload/e_background_removal,b_rgb:${hex},c_pad,ar_1:1,w_500,q_auto,f_webp/`
  );
}

function MenuCard({ item, inCart, onAdd, isMostOrdered }) {
  const hasImg = !!(item.imageUrl?.trim());
  const catBg  = CATEGORY_COLORS[item.category] || "#E8D5A3";

  const imgSrc = hasImg ? getCloudinaryUrl(item.imageUrl, item.category) : "";

  return (
    /* IMPORTANT: no overflow-hidden on outer card — it breaks blend mode stacking context */
    <div
      className="group bg-[#FDFAF5] rounded-[2rem] shadow-sm hover:translate-y-[-10px] hover:scale-[1.025] hover:shadow-xl transition-all duration-300 border border-transparent hover:border-[#C9A84C]/50 relative"
      style={{ overflow: "visible" }}
    >
      {/* shimmer sweep */}
      <div className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-[150%] skew-x-[-20deg] group-hover:animate-[shimmer_1.5s_ease-in-out_infinite] pointer-events-none" />

      {/* IMAGE AREA — isolation:isolate creates fresh blend-mode stacking context */}
      <div
        className="relative z-10 overflow-hidden"
        style={{
          height: "clamp(140px,25vw,180px)",
          backgroundColor: catBg,
          backgroundImage: "radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.2) 0%, transparent 70%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          isolation: "isolate",
          borderRadius: "22px 22px 0 0",
        }}
      >
        {hasImg ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imgSrc}
            alt={item.name}
            className="menu-image"
            style={{
              width: "86%",
              height: "86%",
              objectFit: "contain",
              mixBlendMode: "multiply",
              WebkitMixBlendMode: "multiply",
              display: "block",
              position: "relative",
              zIndex: 2,
              filter: "drop-shadow(0 10px 24px rgba(44,24,16,0.15))",
              transition: "transform 0.45s cubic-bezier(0.34,1.56,0.64,1), filter 0.3s ease",
              backgroundColor: "transparent",
              border: "none",
              outline: "none",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = "scale(1.12) translateY(-4px)";
              e.currentTarget.style.filter    = "drop-shadow(0 18px 36px rgba(44,24,16,0.28))";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = "";
              e.currentTarget.style.filter    = "drop-shadow(0 10px 24px rgba(44,24,16,0.15))";
            }}
          />
        ) : (
          <span className="text-[4.5rem] sm:text-[5rem] drop-shadow-lg transition-transform duration-500 group-hover:scale-[1.25] group-hover:-rotate-6 inline-block">{item.emoji}</span>
        )}

        {item.special && (
          <span className="absolute top-3 right-3 sm:top-4 sm:right-4 bg-rose-500 text-white text-[0.6rem] sm:text-xs font-bold px-2.5 py-1 rounded-full shadow-lg z-10">
            Chef&apos;s Pick
          </span>
        )}

        {/* Most Ordered badge on matching grid card */}
        {isMostOrdered && (
          <span style={{
            position: "absolute", bottom: 0, left: 0,
            background: "rgba(232,93,32,0.92)",
            color: "#fff", fontSize: "0.58rem", fontWeight: 700,
            padding: "3px 10px", borderRadius: "0 8px 0 0", zIndex: 10,
            letterSpacing: "0.05em",
          }}>🔥 Most Ordered</span>
        )}
      </div>

      {/* CARD BODY */}
      <div
        className="p-4 sm:p-6 pb-6 sm:pb-8 relative z-10 bg-[#FDFAF5]"
        style={{ borderRadius: "0 0 22px 22px" }}
      >
        <p className="text-[#C9A84C] text-[0.7rem] font-bold uppercase tracking-widest mb-1.5">{item.tag}</p>
        <h3 className="text-[1.3rem] sm:text-[1.6rem] font-bold font-[family-name:var(--font-cormorant)] mb-1.5 text-[#2C1810] leading-tight group-hover:text-[#C9A84C] transition-colors">{item.name}</h3>
        <p className="text-[#7A6E65] text-xs sm:text-sm mb-4 sm:mb-6 min-h-[36px] leading-relaxed">{item.desc}</p>
        <div className="flex justify-between items-end mt-auto">
          <span className="text-[1.5rem] sm:text-[1.8rem] font-bold font-[family-name:var(--font-cormorant)]">₹{item.price}</span>
          <div className="relative">
            {inCart && <span className="absolute -top-0.5 -right-0.5 w-[9px] h-[9px] rounded-full z-20 ring-2 ring-[#FDFAF5] bg-[#8A9E8A]" />}
            <button
              onClick={() => onAdd(item)}
              className="w-[42px] h-[42px] rounded-full bg-[#F7F2EA] flex items-center justify-center text-xl text-[#2C1810] shadow-sm group-hover:rotate-90 group-hover:bg-[#C9A84C] group-hover:text-white transition-all duration-300 border border-[#7A6E65]/10"
              aria-label={`Add ${item.name}`}
            >+</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Most Ordered Hero Card ──────────────────────────────────────────────── */
function MostOrderedCard({ item, inCart, onAdd }) {
  const [added, setAdded]     = useState(false);
  const [hovered, setHovered] = useState(false);
  const catBg  = CATEGORY_COLORS[item.category] || "#E8D5A3";
  const hasImg = !!(item.imageUrl?.trim());
  const imgSrc = hasImg ? getCloudinaryUrl(item.imageUrl, item.category) : "";

  const handleAdd = () => {
    onAdd(item);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        flexDirection: "row",
        background: "linear-gradient(135deg, #2C1810 0%, #4A2810 100%)",
        borderRadius: 24,
        border: `1.5px solid ${hovered ? "rgba(201,168,76,0.7)" : "rgba(201,168,76,0.35)"}`,
        boxShadow: hovered
          ? "0 24px 80px rgba(44,24,16,0.4), 0 0 0 1px rgba(201,168,76,0.15)"
          : "0 16px 60px rgba(44,24,16,0.25), 0 0 0 1px rgba(201,168,76,0.1)",
        overflow: "hidden",
        transform: hovered ? "translateY(-6px)" : "translateY(0)",
        transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.35s ease, border-color 0.35s ease",
        flexWrap: "wrap",
      }}
    >
      {/* LEFT — image */}
      <div style={{
        position: "relative",
        width: "min(200px, 100%)",
        minHeight: 200,
        background: catBg,
        backgroundImage: "radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.15) 0%, transparent 70%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        isolation: "isolate",
        overflow: "hidden",
        flexShrink: 0,
      }}>
        {/* dark overlay on top of category color */}
        <div style={{ position:"absolute",inset:0,background:"rgba(44,24,16,0.22)",zIndex:1,pointerEvents:"none" }}/>

        {/* 🔥 MOST ORDERED badge */}
        <div style={{
          position: "absolute", top: 0, left: 0, zIndex: 10,
          background: "linear-gradient(135deg, #C9784C, #E85D20)",
          color: "#fff",
          fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.15em",
          padding: "6px 14px", borderRadius: "0 0 14px 0",
          boxShadow: "0 4px 12px rgba(232,93,32,0.4)",
          whiteSpace: "nowrap",
        }}>🔥 MOST ORDERED</div>

        {/* order count badge */}
        <div style={{
          position: "absolute", top: 8, right: 8, zIndex: 10,
          background: "rgba(201,168,76,0.15)",
          border: "1px solid rgba(201,168,76,0.3)",
          color: "#C9A84C", fontSize: "0.7rem", fontWeight: 600,
          padding: "4px 10px", borderRadius: 50,
          backdropFilter: "blur(4px)",
        }}>{item.totalOrdered} ordered</div>

        {hasImg ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imgSrc}
            alt={item.name}
            className="menu-image"
            style={{
              width: "80%", height: "80%", objectFit: "contain",
              mixBlendMode: "multiply", WebkitMixBlendMode: "multiply",
              position: "relative", zIndex: 2,
              filter: "drop-shadow(0 10px 24px rgba(44,24,16,0.25))",
              transform: hovered ? "scale(1.06)" : "scale(1)",
              transition: "transform 0.4s cubic-bezier(0.34,1.56,0.64,1)",
              backgroundColor: "transparent",
            }}
          />
        ) : (
          <span style={{
            fontSize: "6rem", zIndex: 2, position: "relative",
            transform: hovered ? "scale(1.1)" : "scale(1)",
            transition: "transform 0.4s cubic-bezier(0.34,1.56,0.64,1)",
            display: "inline-block",
          }}>{item.emoji}</span>
        )}
      </div>

      {/* RIGHT — content */}
      <div style={{
        flex: 1,
        padding: "clamp(18px,4vw,28px)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 10,
        minWidth: 180,
      }}>
        {/* label */}
        <p style={{ fontSize: "0.6rem", fontWeight: 600, letterSpacing: "0.25em", color: "#C9A84C", margin: 0, textTransform: "uppercase" }}>
          ✶ Today’s Crowd Favourite
        </p>

        {/* name */}
        <h3 style={{
          fontFamily: "Georgia, serif",
          fontSize: "clamp(1.6rem,5vw,2.2rem)",
          fontWeight: 300, color: "#F7F2EA",
          lineHeight: 1.1, margin: 0,
        }}>{item.name}</h3>

        {/* category tag */}
        <span style={{
          alignSelf: "flex-start",
          background: "rgba(201,168,76,0.1)",
          border: "1px solid rgba(201,168,76,0.4)",
          color: "#C9A84C",
          fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.15em",
          padding: "3px 10px", borderRadius: 50,
        }}>{item.category}</span>

        {/* description */}
        {item.desc && (
          <p style={{
            fontSize: "0.85rem", color: "rgba(247,242,234,0.65)",
            lineHeight: 1.65, margin: 0,
            display: "-webkit-box", WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>{item.desc}</p>
        )}

        {/* popularity bar */}
        <div>
          <p style={{ fontSize: "0.6rem", color: "rgba(247,242,234,0.35)", margin: "0 0 5px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Popularity</p>
          <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 2,
              background: "linear-gradient(90deg, #C9A84C, #E8D5A3)",
              animation: "popularityFill 1s ease 0.3s both",
            }}/>
          </div>
        </div>

        {/* price + add button */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ fontFamily: "Georgia, serif", fontSize: "2rem", fontWeight: 600, color: "#F7F2EA" }}>
            ₹{item.price}
          </span>
          <button
            onClick={handleAdd}
            style={{
              width: 44, height: 44, borderRadius: "50%",
              background: added ? "#8A9E8A" : "#C9A84C",
              color: "#2C1810",
              border: "none", cursor: "pointer", fontSize: added ? "1.1rem" : "1.5rem",
              fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              transform: hovered && !added ? "scale(1.08)" : "scale(1)",
              transition: "background 0.25s ease, transform 0.25s ease",
              boxShadow: "0 4px 16px rgba(201,168,76,0.35)",
            }}
            aria-label={`Add ${item.name}`}
          >{added ? "✓" : "+"}</button>
        </div>
      </div>
    </div>
  );
}

function ItemThumb({ item, size=44, imgPct="80%" }) {
  const hasImg = !!(item.imageUrl?.trim());
  const catBg  = CATEGORY_COLORS[item.category] || "#E8D5A3";
  return (
    <div style={{ width:size,height:size,borderRadius:Math.round(size*.22),background:catBg,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0 }}>
      {hasImg
        ? /* eslint-disable-next-line @next/next/no-img-element */
          <img src={item.imageUrl} alt={item.name} style={{ height:imgPct,width:"auto",maxWidth:imgPct,objectFit:"contain",mixBlendMode:"multiply",filter:"drop-shadow(0 2px 6px rgba(44,24,16,0.2))" }} />
        : <span style={{ fontSize:size*.45 }}>{item.emoji}</span>
      }
    </div>
  );
}

export default function CustomerMenu() {
  const [tableNumber, setTableNumber]     = useState("");
  const [tableEntered, setTableEntered]   = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [cart, setCart]                   = useState([]);
  const [isCartOpen, setIsCartOpen]       = useState(false);
  const [orderNote, setOrderNote]         = useState("");
  const [orderSuccess, setOrderSuccess]   = useState(null);
  const [isMounted, setIsMounted]         = useState(false);
  const [menuItems, setMenuItems]         = useState([]);
  const [menuLoading, setMenuLoading]     = useState(true);
  const [toasts, setToasts]               = useState([]);
  const [cartBumping, setCartBumping]     = useState(false);
  const [mostOrdered, setMostOrdered]     = useState(null);
  const prevCartCount                     = useRef(0);

  useEffect(()=>{ setIsMounted(true); },[]);

  useEffect(()=>{
    const menuRef = ref(db,"menu");
    const unsub = onValue(menuRef,(snap)=>{
      const data = snap.val();
      if (data) {
        const arr = Object.entries(data).map(([k,v])=>({...v,id:k,firebaseKey:k})).filter(i=>i.available!==false);
        setMenuItems(arr.length ? arr : DEFAULT_ITEMS);
      } else setMenuItems(DEFAULT_ITEMS);
      setMenuLoading(false);
    },()=>{ setMenuItems(DEFAULT_ITEMS); setMenuLoading(false); });
    return ()=>unsub();
  },[]);
  // Subscribe to orders ? compute most-ordered item in real-time
  useEffect(()=>{
    const unsub = onValue(ref(db,"orders"),(snap)=>{
      const data = snap.val();
      if (!data) return;
      const totalOrders = Object.keys(data).length;
      if (totalOrders < 3) return;
      const counts = {};
      Object.values(data).forEach(order=>{
        order.items?.forEach(item=>{
          counts[item.name] = (counts[item.name]||0) + (item.qty||1);
        });
      });
      const sorted = Object.entries(counts)
        .sort((a,b)=> b[1]!==a[1] ? b[1]-a[1] : a[0].localeCompare(b[0]));
      const [topName, topCount] = sorted[0] || [];
      if (!topName || topCount < 3) return;
      setMenuItems(prev=>{
        const menuItem = prev.find(m=>m.name===topName);
        if (menuItem) setMostOrdered({...menuItem, totalOrdered: topCount});
        return prev;
      });
    });
    return ()=>unsub();
  },[]);

  // Subscribe to orders → compute most-ordered item in real-time
  useEffect(()=>{
    const unsub = onValue(ref(db,"orders"),(snap)=>{
      const data = snap.val();
      if (!data) return;
      const totalOrders = Object.keys(data).length;
      if (totalOrders < 3) return;
      const counts = {};
      Object.values(data).forEach(order=>{
        order.items?.forEach(item=>{
          counts[item.name] = (counts[item.name]||0) + (item.qty||1);
        });
      });
      const sorted = Object.entries(counts)
        .sort((a,b)=> b[1]!==a[1] ? b[1]-a[1] : a[0].localeCompare(b[0]));
      const [topName, topCount] = sorted[0] || [];
      if (!topName || topCount < 3) return;
      setMenuItems(prev=>{
        const menuItem = prev.find(m=>m.name===topName);
        if (menuItem) setMostOrdered({...menuItem, totalOrdered: topCount});
        return prev;
      });
    });
    return ()=>unsub();
  },[]);

  const totalItems = cart.reduce((s,i)=>s+i.qty,0);
  useEffect(()=>{
    if(totalItems>prevCartCount.current){ setCartBumping(true); setTimeout(()=>setCartBumping(false),300); }
    prevCartCount.current = totalItems;
  },[totalItems]);

  const showToast = (item)=>{
    const id = Date.now()+Math.random();
    setToasts(p=>[...p,{id,...item}].slice(-3));
    setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),2500);
  };

  const addToCart = (item)=>{
    setCart(p=>{ const ex=p.find(i=>i.id===item.id); return ex ? p.map(i=>i.id===item.id?{...i,qty:i.qty+1}:i) : [...p,{...item,qty:1}]; });
    showToast(item);
  };
  const updateQty = (id,d)=>setCart(p=>p.map(i=>i.id===id?{...i,qty:i.qty+d}:i).filter(i=>i.qty>0));

  const placeOrder = async ()=>{
    if(!cart.length) return;
    try {
      const { ref:fbRef, push } = await import("firebase/database");
      await push(fbRef(db,"orders"),{
        table:tableNumber,
        items:cart.map(({name,emoji,imageUrl,category,qty,price,id})=>({name,emoji,imageUrl:imageUrl||"",category:category||"",qty,price,id})),
        total:cart.reduce((s,i)=>s+i.price*i.qty,0),
        status:"new", note:orderNote, placedAt:new Date().toISOString(), timestamp:Date.now(),
      });
      setOrderSuccess(Date.now().toString().slice(-6).toUpperCase());
      setCart([]); setOrderNote(""); setIsCartOpen(false);
    } catch(e) { console.error(e); alert("Failed to place order. Please try again."); }
  };

  const TABS = ["All","☕ Coffee","🍵 Tea","🥐 Food","🍰 Sweet"];
  const filteredItems = activeCategory==="All" ? menuItems
    : menuItems.filter(i=>i.category.toLowerCase()===activeCategory.split(" ")[1]?.toLowerCase()||i.category.toLowerCase()===activeCategory.toLowerCase());

  const cartTotal = cart.reduce((s,i)=>s+i.price*i.qty,0);
  const cartCount = cart.reduce((s,i)=>s+i.qty,0);
  const cartHas   = cartCount>0;

  if(!isMounted) return null;

  /* TABLE ENTRY */
  if(!tableEntered) return (
    <main className="min-h-screen flex items-center justify-center bg-[#F7F2EA] p-4 text-[#2C1810]">
      <style>{KEYFRAMES}</style>
      <div className="bg-[#FDFAF5] p-8 sm:p-12 rounded-3xl shadow-xl w-full text-center border border-[#7A6E65]/10 font-[family-name:var(--font-cormorant)]" style={{ maxWidth:"min(430px,95vw)" }}>
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Welcome to</h1>
        <h2 className="text-2xl sm:text-3xl italic text-[#C9A84C] mb-8">Lumière Café</h2>
        <form onSubmit={e=>{e.preventDefault();if(tableNumber.trim())setTableEntered(true)}} className="space-y-6">
          <div>
            <label htmlFor="table" className="block text-lg sm:text-xl mb-3 text-[#7A6E65]">Enter your table number</label>
            <input id="table" type="number" value={tableNumber} onChange={e=>setTableNumber(e.target.value)}
              required className="w-full text-center text-4xl p-4 bg-transparent border-b-2 border-[#C9A84C] focus:outline-none min-h-[56px]" placeholder="0" min="1" max="99"/>
          </div>
          <button type="submit" className="w-full bg-[#C9A84C] text-[#FDFAF5] py-4 rounded-full text-xl font-bold hover:bg-[#b09038] transition-colors shadow-lg">View Menu</button>
        </form>
      </div>
    </main>
  );

  /* MAIN MENU */
  return (
    <div className="min-h-screen bg-[#F7F2EA] text-[#2C1810] font-[family-name:var(--font-dm-sans)] pb-24">
      <style>{KEYFRAMES}</style>

      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-[#F7F2EA]/80 backdrop-blur-md border-b border-[#7A6E65]/10" style={{ height:52 }}>
        <div className="h-full max-w-7xl mx-auto px-3 sm:px-8 flex justify-between items-center">
          <h1 className="font-[family-name:var(--font-cormorant)] font-bold" style={{ fontSize:"clamp(1.2rem,4vw,1.5rem)" }}>
            Lumière <span className="italic text-[#C9A84C]">Café</span>
          </h1>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="bg-[#FDFAF5] px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold shadow-sm border border-[#7A6E65]/10">
              <span className="hidden sm:inline">Table </span>T{tableNumber}
            </div>
            <button onClick={()=>setIsCartOpen(true)}
              className="relative p-2.5 sm:p-3 bg-[#FDFAF5] rounded-full shadow-sm border border-[#7A6E65]/10 min-w-[44px] min-h-[44px] flex items-center justify-center"
              style={ cartHas ? { animation:`cartGlow 2s ease-in-out infinite${cartBumping?",cartBump .3s ease":""}`,border:"1.5px solid rgba(201,168,76,.6)" } : {} }>
              🛒
              {cartCount>0 && (
                <span className="absolute -top-1 -right-1 text-xs h-5 w-5 rounded-full flex items-center justify-center"
                  style={{ animation:"badgePulse 1.5s ease-in-out infinite",background:"#C9A84C",color:"#2C1810",fontWeight:700 }}>{cartCount}</span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-8 py-8 sm:py-12">
        {/* HERO */}
        <div className="text-center mb-10 sm:mb-16 px-2">
          <h2 className="leading-none font-bold font-[family-name:var(--font-cormorant)] mb-4 text-[#2C1810]"
            style={{ fontSize:"clamp(2.2rem,7vw,5rem)" }}>
            A Menu Made with{" "}<span className="italic text-[#7A6E65]">Love</span>
          </h2>
          <div className="h-px w-20 bg-[#C9A84C] mx-auto" />
        </div>

        {/* MOST ORDERED SECTION — only shown when data is available */}
        {mostOrdered && (
          <div style={{ maxWidth: 700, margin: "0 auto", marginBottom: 40, padding: "0 0" }}>
            {/* divider label */}
            <p style={{
              textAlign: "center", fontSize: "0.65rem", color: "#7A6E65",
              letterSpacing: "0.15em", textTransform: "uppercase",
              marginBottom: 14, display: "flex", alignItems: "center",
              justifyContent: "center", gap: 8,
            }}>
              <span style={{ color: "#C9A84C" }}>·</span>
              Based on real orders
              <span style={{ color: "#C9A84C" }}>·</span>
            </p>
            <MostOrderedCard
              item={mostOrdered}
              inCart={!!cart.find(c=>c.id===mostOrdered.id)}
              onAdd={addToCart}
            />
          </div>
        )}

        {/* CATEGORY TABS — horizontally scrollable on mobile */}
        <div className="flex gap-2 sm:gap-3 mb-8 sm:mb-12 overflow-x-auto scroll-hide pb-1">
          {TABS.map(cat=>(
            <button key={cat} onClick={()=>setActiveCategory(cat)}
              className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-full text-sm sm:text-lg transition-all duration-300 whitespace-nowrap flex-shrink-0 ${
                activeCategory===cat
                  ? "bg-[#2C1810] text-[#FDFAF5] shadow-lg font-bold"
                  : "bg-transparent text-[#7A6E65] border border-[#7A6E65]/30 hover:border-[#2C1810] hover:text-[#2C1810]"
              }`}>{cat}</button>
          ))}
        </div>

        {/* MENU GRID */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(300px,100%),1fr))",gap:"clamp(16px,3vw,32px)" }}>
          {menuLoading
            ? Array.from({length:6}).map((_,i)=><SkeletonCard key={i}/>)
            : filteredItems.map(item=>(
                <MenuCard
                  key={item.id||item.firebaseKey}
                  item={item}
                  inCart={!!cart.find(c=>c.id===item.id)}
                  onAdd={addToCart}
                  isMostOrdered={mostOrdered?.name===item.name}
                />
              ))
          }
        </div>
      </main>

      {/* TOASTS */}
      {toasts.length>0 && (
        <div style={{ position:"fixed",bottom:28,left:"50%",transform:"translateX(-50%)",zIndex:500,display:"flex",flexDirection:"column-reverse",alignItems:"center",gap:8,pointerEvents:"none",width:"90vw",maxWidth:400 }}>
          {toasts.map(t=>(
            <div key={t.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 18px 10px 12px",borderRadius:50,background:"#2C1810",border:"1px solid rgba(201,168,76,.35)",boxShadow:"0 8px 32px rgba(44,24,16,.35)",animation:"toastIn .45s cubic-bezier(.34,1.56,.64,1) both",fontFamily:"Georgia,serif",fontSize:"clamp(0.78rem,3vw,0.9rem)",color:"#F5EDD6",whiteSpace:"nowrap",overflow:"hidden" }}>
              <span style={{ width:32,height:32,borderRadius:"50%",background:CATEGORY_COLORS[t.category]||"rgba(201,168,76,.18)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.1rem",flexShrink:0 }}>{t.emoji}</span>
              <span style={{ fontWeight:700,color:"#C9A84C",overflow:"hidden",textOverflow:"ellipsis" }}>{t.name}</span>
              <span style={{ opacity:.85 }}>added</span>
              <span style={{ background:"#4A7C59",color:"#fff",borderRadius:"50%",width:22,height:22,display:"flex",alignItems:"center",justifyContent:"center",fontSize:".75rem",fontWeight:700,flexShrink:0 }}>✓</span>
            </div>
          ))}
        </div>
      )}

      {/* CART PANEL */}
      <div className={`fixed inset-y-0 right-0 bg-[#FDFAF5] shadow-2xl z-50 flex flex-col transform transition-transform duration-500 ease-[cubic-bezier(.25,1,.5,1)] ${isCartOpen?"translate-x-0":"translate-x-full"}`}
        style={{ width:"min(100vw,420px)" }}>
        <div className="bg-[#2C1810] text-[#FDFAF5] px-5 py-4 flex justify-between items-center">
          <h2 className="text-xl sm:text-2xl font-bold font-[family-name:var(--font-cormorant)]">Your Order</h2>
          <button onClick={()=>setIsCartOpen(false)} className="text-white/70 hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center text-xl rounded-full">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#FDFAF5]">
          {cart.length===0 ? (
            <div className="h-full flex flex-col justify-center items-center text-center opacity-50 space-y-4">
              <span className="text-6xl grayscale opacity-30">🍽️</span>
              <p className="text-xl font-[family-name:var(--font-cormorant)] italic pb-20">Your cart awaits...</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {cart.map(item=>(
                <li key={item.id} className="flex gap-3 items-center bg-white p-3 rounded-2xl border border-[#F7F2EA] shadow-sm">
                  <ItemThumb item={item} size={44} imgPct="80%"/>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-[#2C1810] leading-tight text-sm truncate">{item.name}</h4>
                    <span className="text-[#7A6E65] font-bold text-sm">₹{item.price}</span>
                  </div>
                  <div className="flex items-center gap-1 bg-[#F7F2EA] rounded-full px-1.5 py-1">
                    <button onClick={()=>updateQty(item.id,-1)} className="w-8 h-8 flex items-center justify-center text-[#2C1810] font-bold hover:bg-[#FDFAF5] rounded-full">-</button>
                    <span className="w-5 text-center font-bold text-[#2C1810] text-sm">{item.qty}</span>
                    <button onClick={()=>updateQty(item.id,1)} className="w-8 h-8 flex items-center justify-center text-[#2C1810] font-bold hover:bg-[#FDFAF5] rounded-full">+</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="p-4 sm:p-6 bg-white border-t border-[#7A6E65]/10 safe-bottom">
          <textarea value={orderNote} onChange={e=>setOrderNote(e.target.value)} placeholder="Special instructions..." className="w-full bg-[#F7F2EA] border border-[#7A6E65]/10 rounded-xl p-3 mb-4 focus:outline-none focus:border-[#C9A84C] text-sm resize-none h-16 sm:h-20 placeholder:text-[#7A6E65]/50 text-[#2C1810]"/>
          <div className="flex justify-between items-center mb-4 text-[#2C1810]">
            <span className="text-base sm:text-lg text-[#7A6E65]">Total</span>
            <span className="text-2xl sm:text-3xl font-bold font-[family-name:var(--font-cormorant)]">₹{cartTotal}</span>
          </div>
          <button onClick={placeOrder} disabled={!cart.length} className="w-full bg-[#C9A84C] text-[#FDFAF5] py-4 rounded-xl text-base sm:text-lg font-bold hover:bg-[#b09038] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg active:scale-[.98] min-h-[52px]">
            Place Order
          </button>
        </div>
      </div>
      {isCartOpen && <div className="fixed inset-0 bg-[#2C1810]/20 backdrop-blur-sm z-40" onClick={()=>setIsCartOpen(false)}/>}

      {/* SUCCESS MODAL */}
      {orderSuccess && (
        <div className="fixed inset-0 bg-[#2C1810]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-[#FDFAF5] rounded-[2rem] p-8 sm:p-10 text-center shadow-2xl animate-[dropIn_.5s_cubic-bezier(.175,.885,.32,1.275)]" style={{ width:"min(440px,94vw)",maxHeight:"92vh",overflowY:"auto" }}>
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#C9A84C]/10 rounded-full mx-auto flex items-center justify-center mb-5 sm:mb-6">
              <span className="text-3xl sm:text-4xl">✨</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold font-[family-name:var(--font-cormorant)] text-[#2C1810] mb-2">Order Sent!</h2>
            <p className="text-[#7A6E65] mb-6 sm:mb-8 text-sm sm:text-base">Your treats will arrive shortly.</p>
            <div className="bg-[#F7F2EA] rounded-xl p-4 mb-6 sm:mb-8 border border-[#7A6E65]/10">
              <span className="block text-xs uppercase tracking-widest text-[#7A6E65] font-bold mb-1">Order ID</span>
              <span className="text-2xl font-bold text-[#C9A84C] tracking-wide">{orderSuccess}</span>
            </div>
            <button onClick={()=>setOrderSuccess(null)} className="w-full bg-[#2C1810] text-[#FDFAF5] py-4 rounded-full font-bold hover:bg-black transition-colors min-h-[52px]">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
