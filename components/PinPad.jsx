"use client";

import { useState, useEffect } from "react";

export default function PinPad({ role = "Staff", pin: correctPin, onSuccess, dark = false }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (input.length === 4) {
      if (input === correctPin) {
        onSuccess();
      } else {
        setError(true);
        setShake(true);
        setTimeout(() => {
          setInput("");
          setError(false);
          setShake(false);
        }, 700);
      }
    }
  }, [input, correctPin, onSuccess]);

  const handleKey = (val) => {
    if (input.length < 4 && !shake) setInput((prev) => prev + val);
  };
  const handleDelete = () => {
    if (!shake) setInput((prev) => prev.slice(0, -1));
  };

  const t = dark
    ? {
        bg: "#080B0A", card: "#1A1208", text: "#E8DDD0", subText: "#5A9E6A",
        subFont: "font-mono",
        dotEmpty: "border-2 border-[#3A4A3E]",
        dotFilled: "bg-[#5A9E6A] shadow-[0_0_12px_3px_rgba(90,158,106,0.6)]",
        keyBg: "bg-[#221A0F]", keyHover: "hover:bg-[rgba(90,158,106,0.15)] hover:text-[#5A9E6A]",
        keyText: "text-[#E8DDD0]", keyBorder: "border border-[#2E2518]",
        errorText: "text-[#5A9E6A]", hintText: "text-[#3A4A3E]",
        logoText: "text-[#E8DDD0]", logoCafe: "text-[#C9A84C]",
        shadow: "shadow-2xl shadow-black/60", cardBorder: "border border-[#2E2518]",
      }
    : {
        bg: "#F7F2EA", card: "#FDFAF5", text: "#2C1810", subText: "#C9A84C",
        subFont: "",
        dotEmpty: "border-2 border-[#D5CBBF]",
        dotFilled: "bg-[#2C1810] shadow-[0_0_10px_2px_rgba(201,168,76,0.5)]",
        keyBg: "bg-[#F7F2EA]", keyHover: "hover:bg-[#C9A84C] hover:text-[#FDFAF5]",
        keyText: "text-[#2C1810]", keyBorder: "border border-[#7A6E65]/15",
        errorText: "text-rose-500", hintText: "text-[#7A6E65]/40",
        logoText: "text-[#2C1810]", logoCafe: "text-[#C9A84C]",
        shadow: "shadow-xl shadow-[#2C1810]/10", cardBorder: "border border-[#7A6E65]/10",
      };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: t.bg }}>
      <div
        className={`w-full rounded-[24px] p-8 sm:p-10 flex flex-col items-center gap-7 sm:gap-8 ${t.shadow} ${t.cardBorder}`}
        style={{ backgroundColor: t.card, maxWidth: "min(340px, 92vw)" }}
      >
        {/* Logo */}
        <div className="text-center">
          <h1 className={`text-2xl sm:text-3xl font-bold ${t.logoText}`} style={{ fontFamily: "Georgia, serif" }}>
            Lumière{" "}
            <span className={`italic ${t.logoCafe}`} style={{ fontFamily: "Georgia, serif" }}>Café</span>
          </h1>
          <p className={`text-[0.7rem] font-bold uppercase tracking-[0.2em] mt-2 ${t.subFont}`} style={{ color: t.subText }}>
            {role} Access
          </p>
        </div>

        {/* PIN Dots */}
        <div className={`flex gap-5 transition-transform duration-100 ${shake ? "animate-[shake_0.4s_ease-in-out]" : ""}`}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`w-4 h-4 rounded-full transition-all duration-300 ${i < input.length ? t.dotFilled : t.dotEmpty}`} />
          ))}
        </div>

        {/* Number Pad — keys are min 56px tall on mobile */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button
              key={n}
              onClick={() => handleKey(String(n))}
              className={`h-14 sm:h-16 rounded-xl text-2xl font-semibold transition-all duration-200 active:scale-90 select-none ${t.keyBg} ${t.keyHover} ${t.keyText} ${t.keyBorder}`}
              style={{ fontFamily: "Georgia, serif", minHeight: 56 }}
            >
              {n}
            </button>
          ))}
          <div />
          <button
            onClick={() => handleKey("0")}
            className={`h-14 sm:h-16 rounded-xl text-2xl font-semibold transition-all duration-200 active:scale-90 select-none ${t.keyBg} ${t.keyHover} ${t.keyText} ${t.keyBorder}`}
            style={{ fontFamily: "Georgia, serif", minHeight: 56 }}
          >0</button>
          <button
            onClick={handleDelete}
            className={`h-14 sm:h-16 rounded-xl text-xl transition-all duration-200 active:scale-90 select-none ${t.keyBg} ${t.keyHover} ${t.keyText} ${t.keyBorder}`}
            style={{ minHeight: 56 }}
          >⌫</button>
        </div>

        {/* Error / Hint */}
        <div className="h-5 text-center">
          {error
            ? <p className={`text-sm font-semibold ${t.errorText}`}>Incorrect PIN — try again</p>
            : <p className={`text-xs ${t.hintText}`}>PIN: {correctPin}</p>
          }
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-8px); }
          40%       { transform: translateX(8px); }
          60%       { transform: translateX(-6px); }
          80%       { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
