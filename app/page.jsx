"use client";

import { useState, useEffect } from "react";
import { menuItems, CATEGORY_COLORS } from "@/lib/menuItems";
import { db } from "@/lib/firebase";
import { ref, push, serverTimestamp } from "firebase/database";

export default function CustomerMenu() {
  const [tableNumber, setTableNumber] = useState("");
  const [tableEntered, setTableEntered] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderNote, setOrderNote] = useState("");
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [isMounted, setIsMounted] = useState(false);
  
  // To avoid hydration mismatch due to empty state renders 
  useEffect(() => { setIsMounted(true) }, []);

  const handleTableSubmit = (e) => {
    e.preventDefault();
    if (tableNumber.trim()) {
      setTableEntered(true);
    }
  };

  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const updateQty = (id, delta) => {
    setCart((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0)
    );
  };

  const placeOrder = async () => {
    if (cart.length === 0) return;
    try {
      const ordersRef = ref(db, "orders");
      const orderData = {
        table: tableNumber,
        items: cart.map(({ name, emoji, qty, price, id }) => ({ name, emoji, qty, price, id })),
        total: cart.reduce((sum, item) => sum + item.price * item.qty, 0),
        status: "new",
        note: orderNote,
        timestamp: serverTimestamp(),
        placedAt: new Date().toISOString()
      };
      
      const newOrderInfo = await push(ordersRef, orderData);
      
      setOrderSuccess(newOrderInfo.key.substring(newOrderInfo.key.length - 6).toUpperCase());
      setCart([]);
      setOrderNote("");
      setIsCartOpen(false);
    } catch (error) {
      console.error("Failed to place order:", error);
      alert("Failed to place order. Please try again.");
    }
  };

  const filteredItems =
    activeCategory === "All"
      ? menuItems
      : menuItems.filter(
          (item) => item.category.toLowerCase() === activeCategory.split(" ")[1]?.toLowerCase() || 
                    item.category.toLowerCase() === activeCategory.toLowerCase()
        );

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.qty, 0);

  if (!isMounted) return null;

  if (!tableEntered) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#F7F2EA] p-4 text-[#2C1810]">
        <div className="bg-[#FDFAF5] p-12 rounded-3xl shadow-xl max-w-md w-full text-center border border-[#7A6E65]/10 font-[family-name:var(--font-cormorant)]">
          <h1 className="text-4xl font-bold mb-2">Welcome to</h1>
          <h2 className="text-3xl italic text-[#C9A84C] mb-8">Lumière Café</h2>
          <form onSubmit={handleTableSubmit} className="space-y-6">
            <div>
              <label htmlFor="table" className="block text-xl mb-3 text-[#7A6E65]">
                Please enter your table number
              </label>
              <input
                id="table"
                type="number"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                required
                className="w-full text-center text-4xl p-4 bg-transparent border-b-2 border-[#C9A84C] focus:outline-none focus:border-[#2C1810] transition-colors"
                placeholder="0"
                min="1"
                max="99"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-[#C9A84C] text-[#FDFAF5] py-4 rounded-full text-xl font-bold hover:bg-[#b09038] transition-colors shadow-lg shadow-[#C9A84C]/30"
            >
              View Menu
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F2EA] text-[#2C1810] font-[family-name:var(--font-dm-sans)] pb-24">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-[#F7F2EA]/80 backdrop-blur-md border-b border-[#7A6E65]/10">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-[family-name:var(--font-cormorant)] font-bold">
              Lumière <span className="italic text-[#C9A84C]">Café</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-[#FDFAF5] px-4 py-2 rounded-full text-sm font-semibold shadow-sm border border-[#7A6E65]/10">
              Table {tableNumber}
            </div>
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-3 bg-[#FDFAF5] rounded-full shadow-sm hover:shadow-md transition-shadow border border-[#7A6E65]/10"
            >
              🛒
              {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#C9A84C] text-[#FDFAF5] text-xs font-bold h-6 w-6 rounded-full flex items-center justify-center">
                  {cartItemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-12">
        {/* HERO */}
        <div className="text-center mb-16 px-4">
          <h2 className="text-[clamp(3rem,6vw,6rem)] leading-none font-bold font-[family-name:var(--font-cormorant)] mb-6 text-[#2C1810]">
            A Menu Made with{" "}
            <span className="italic text-[#7A6E65]">Love</span>
          </h2>
          <div className="h-px w-24 bg-[#C9A84C] mx-auto"></div>
        </div>

        {/* CATEGORY FILTERS */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {["All", "☕ Coffee", "🍵 Tea", "🥐 Food", "🍰 Sweet"].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-6 py-3 rounded-full text-lg transition-all duration-300 ${
                activeCategory === cat
                  ? "bg-[#2C1810] text-[#FDFAF5] shadow-lg shadow-[#2C1810]/20 font-bold"
                  : "bg-transparent text-[#7A6E65] border border-[#7A6E65]/30 hover:border-[#2C1810] hover:text-[#2C1810]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* MENU GRID */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-8">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="group bg-[#FDFAF5] rounded-[2rem] overflow-hidden shadow-sm hover:translate-y-[-10px] hover:scale-[1.02] hover:shadow-xl transition-all duration-300 border border-transparent hover:border-[#C9A84C]/50 relative"
            >
              {/* Shimmer Effect */}
              <div className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-[150%] skew-x-[-20deg] group-hover:animate-[shimmer_1.5s_ease-in-out_infinite]" />

              <div
                className="h-[200px] flex items-center justify-center relative overflow-hidden z-10"
                style={{ backgroundColor: CATEGORY_COLORS[item.category] }}
              >
                <span className="text-[5rem] drop-shadow-lg transition-transform duration-500 group-hover:scale-[1.25] group-hover:-rotate-6 inline-block">
                  {item.emoji}
                </span>
                {item.special && (
                  <span className="absolute top-4 right-4 bg-rose-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                    Chef&apos;s Pick
                  </span>
                )}
              </div>

              <div className="p-6 pb-8 relative z-10 bg-[#FDFAF5]">
                <p className="text-[#C9A84C] text-[0.75rem] font-bold uppercase tracking-widest mb-2">
                  {item.tag}
                </p>
                <h3 className="text-[1.6rem] font-bold font-[family-name:var(--font-cormorant)] mb-2 text-[#2C1810] leading-tight group-hover:text-[#C9A84C] transition-colors">
                  {item.name}
                </h3>
                <p className="text-[#7A6E65] text-sm mb-6 min-h-[40px] leading-relaxed">
                  {item.desc}
                </p>

                <div className="flex justify-between items-end mt-auto">
                  <span className="text-[1.8rem] font-bold font-[family-name:var(--font-cormorant)]">
                    ₹{item.price}
                  </span>
                  <button
                    onClick={() => addToCart(item)}
                    className="w-[42px] h-[42px] rounded-full bg-[#F7F2EA] flex items-center justify-center text-xl text-[#2C1810] shadow-sm group-hover:rotate-90 group-hover:bg-[#C9A84C] group-hover:text-white transition-all duration-300 border border-[#7A6E65]/10"
                    aria-label={`Add ${item.name} to cart`}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* CART PANEL */}
      <div
        className={`fixed inset-y-0 right-0 w-full md:w-[380px] bg-[#FDFAF5] shadow-2xl z-50 transform transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] flex flex-col ${
          isCartOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="bg-[#2C1810] text-[#FDFAF5] p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold font-[family-name:var(--font-cormorant)]">
            Your Order
          </h2>
          <button
            onClick={() => setIsCartOpen(false)}
            className="text-white/70 hover:text-white p-2 text-xl transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-[#FDFAF5]">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col justify-center items-center text-center opacity-50 space-y-4">
              <span className="text-6xl grayscale opacity-30">🍽️</span>
              <p className="text-xl font-[family-name:var(--font-cormorant)] italic pb-20">Your cart awaits your cravings...</p>
            </div>
          ) : (
            <ul className="space-y-6">
              {cart.map((item) => (
                <li key={item.id} className="flex gap-4 items-center bg-white p-3 rounded-2xl border border-[#F7F2EA] shadow-sm">
                  <div
                    className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl"
                    style={{ backgroundColor: CATEGORY_COLORS[item.category] }}
                  >
                    {item.emoji}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-[#2C1810] leading-tight">{item.name}</h4>
                    <span className="text-[#7A6E65] font-bold">₹{item.price}</span>
                  </div>
                  <div className="flex items-center gap-3 bg-[#F7F2EA] rounded-full px-2 py-1">
                    <button
                      onClick={() => updateQty(item.id, -1)}
                      className="w-8 h-8 flex items-center justify-center text-[#2C1810] font-bold hover:bg-[#FDFAF5] rounded-full transition-colors"
                    >
                      -
                    </button>
                    <span className="w-4 text-center font-bold text-[#2C1810]">{item.qty}</span>
                    <button
                      onClick={() => updateQty(item.id, 1)}
                      className="w-8 h-8 flex items-center justify-center text-[#2C1810] font-bold hover:bg-[#FDFAF5] rounded-full transition-colors"
                    >
                      +
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-6 bg-white border-t border-[#7A6E65]/10 shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
          <textarea
            value={orderNote}
            onChange={(e) => setOrderNote(e.target.value)}
            placeholder="Special instructions or allergies..."
            className="w-full bg-[#F7F2EA] border border-[#7A6E65]/10 rounded-xl p-3 mb-4 focus:outline-none focus:border-[#C9A84C] text-sm resize-none h-20 placeholder:text-[#7A6E65]/50 text-[#2C1810]"
          />
          <div className="flex justify-between items-end mb-6 text-[#2C1810]">
            <span className="text-lg text-[#7A6E65]">Total</span>
            <span className="text-3xl font-bold font-[family-name:var(--font-cormorant)]">
              ₹{cartTotal}
            </span>
          </div>
          <button
            onClick={placeOrder}
            disabled={cart.length === 0}
            className="w-full bg-[#C9A84C] text-[#FDFAF5] py-4 rounded-xl text-lg font-bold hover:bg-[#b09038] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#C9A84C]/20 active:scale-[0.98]"
          >
            Place Order
          </button>
        </div>
      </div>

      {/* OVERLAY */}
      {isCartOpen && (
        <div
          className="fixed inset-0 bg-[#2C1810]/20 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsCartOpen(false)}
        />
      )}

      {/* SUCCESS MODAL */}
      {orderSuccess && (
        <div className="fixed inset-0 bg-[#2C1810]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-[#FDFAF5] rounded-[2rem] p-10 max-w-sm w-full text-center shadow-2xl animate-[dropIn_0.5s_cubic-bezier(0.175,0.885,0.32,1.275)]">
            <div className="w-20 h-20 bg-[#C9A84C]/10 rounded-full mx-auto flex items-center justify-center mb-6">
               <span className="text-4xl">✨</span>
            </div>
            <h2 className="text-3xl font-bold font-[family-name:var(--font-cormorant)] text-[#2C1810] mb-2">
              Order Sent!
            </h2>
            <p className="text-[#7A6E65] mb-8">
              Your amazing treats will arrive shortly.
            </p>
            
            <div className="bg-[#F7F2EA] rounded-xl p-4 mb-8 border border-[#7A6E65]/10">
              <span className="block text-xs uppercase tracking-widest text-[#7A6E65] font-bold mb-1">
                Order ID
              </span>
              <span className="text-2xl font-bold text-[#C9A84C] tracking-wide">
                {orderSuccess}
              </span>
            </div>
            
            <button
              onClick={() => setOrderSuccess(null)}
              className="w-full bg-[#2C1810] text-[#FDFAF5] py-4 rounded-full font-bold hover:bg-black transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
