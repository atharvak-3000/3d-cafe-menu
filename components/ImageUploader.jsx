"use client";

import { useState, useRef } from "react";

const CLOUDINARY_CLOUD  = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

const CHECKERBOARD = {
  background:
    "linear-gradient(45deg,#ccc 25%,transparent 25%)," +
    "linear-gradient(-45deg,#ccc 25%,transparent 25%)," +
    "linear-gradient(45deg,transparent 75%,#ccc 75%)," +
    "linear-gradient(-45deg,transparent 75%,#ccc 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0,0 8px,8px -8px,-8px 0px",
};

/**
 * ImageUploader
 * Props:
 *   initialImageUrl  – existing Cloudinary URL (shows preview state on mount)
 *   categoryColor    – hex string for the "on menu" preview background
 *   onConfirm(url)   – called when admin clicks "Use This Image"
 *   onRemoveImage()  – called when admin wants to revert to emoji fallback
 */
export default function ImageUploader({
  initialImageUrl = "",
  categoryColor   = "#E8D5A3",
  onConfirm,
  onRemoveImage,
}) {
  const isInitiallySet          = !!(initialImageUrl && initialImageUrl.trim());
  const [uiState, setUiState]   = useState(isInitiallySet ? "preview" : "idle");
  const [previewUrl, setPreview] = useState(initialImageUrl);
  const [bgRemoved, setBgRem]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError]       = useState("");
  const [isDragging, setDragging] = useState(false);
  const inputRef                = useRef(null);

  /* ── Upload a file ────────────────────────────────────────────────────────── */
  const upload = async (file) => {
    if (!file) return;
    setError("");

    if (!file.type.startsWith("image/")) {
      setError("Invalid file type — use JPG, PNG or WEBP");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("File too large — max 8MB");
      return;
    }

    // Show local thumbnail while uploading
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setUiState("loading");
    setProgress(0);

    /* Try server route first (bg removal) */
    try {
      const fd = new FormData();
      fd.append("image_file", file);
      const res = await fetch("/api/cloudinary-upload", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        setPreview(data.imageUrl);
        setBgRem(data.bgRemoved);
        setUiState("preview");
        URL.revokeObjectURL(localUrl);
        return;
      }
    } catch (_) { /* fall through to direct upload */ }

    /* Fallback: direct unsigned upload to Cloudinary */
    try {
      await new Promise((resolve, reject) => {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("upload_preset", CLOUDINARY_PRESET);
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status === 200) {
            const data = JSON.parse(xhr.responseText);
            setPreview(data.secure_url);
            setBgRem(false);
            setUiState("preview");
            URL.revokeObjectURL(localUrl);
            resolve();
          } else {
            reject(new Error("Upload failed — check your connection"));
          }
        };
        xhr.onerror = () => reject(new Error("Upload failed — check your connection"));
        xhr.send(fd);
      });
    } catch (err) {
      setError(err.message);
      setUiState("error");
      URL.revokeObjectURL(localUrl);
    }
  };

  const reset = () => {
    setUiState("idle");
    setPreview("");
    setBgRem(false);
    setError("");
    setProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  /* ── Drag handlers ────────────────────────────────────────────────────────── */
  const onDragOver  = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop      = (e) => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files[0]); };

  /* ═══ STATE 1 / 4: Idle & Error ════════════════════════════════════════════ */
  if (uiState === "idle" || uiState === "error") {
    return (
      <div>
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          style={{
            border: isDragging ? "2px solid #C9A84C" : "2px dashed rgba(201,168,76,0.4)",
            borderRadius: 16, padding: 32, textAlign: "center",
            cursor: "pointer",
            background: isDragging ? "rgba(201,168,76,0.05)" : "#F7F2EA",
            transition: "border-color 0.2s, background 0.2s",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>📤</div>
          <p style={{ fontFamily: "Georgia, serif", color: "#2C1810", fontSize: "0.9rem", marginBottom: 4 }}>
            Drop your product photo here
          </p>
          <p style={{ color: "#7A6E65", fontSize: "0.78rem", marginBottom: 6 }}>or click to browse</p>
          <p style={{ color: "#C9A84C", fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            JPG · PNG · WEBP up to 8MB
          </p>
        </div>
        {uiState === "error" && (
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
            <p style={{ color: "#DC2626", fontSize: "0.78rem", fontWeight: 600, flex: 1 }}>{error}</p>
            <button onClick={reset} style={{ padding: "4px 12px", borderRadius: 8, background: "#2C1810", color: "#fff", fontSize: "0.72rem", fontWeight: 700, border: "none", cursor: "pointer" }}>
              Try Again
            </button>
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={(e) => upload(e.target.files[0])} />
      </div>
    );
  }

  /* ═══ STATE 2: Loading ══════════════════════════════════════════════════════ */
  if (uiState === "loading") {
    return (
      <div style={{ position: "relative", height: 180, borderRadius: 16, overflow: "hidden", background: "#F7F2EA", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
        {previewUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={previewUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.3, filter: "grayscale(1)" }} />
        )}
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ width: 36, height: 36, border: "3px solid #C9A84C", borderTopColor: "transparent", borderRadius: "50%", animation: "imgUploaderSpin 0.8s linear infinite" }} />
        </div>
        <p style={{ color: "#C9A84C", fontSize: "0.82rem", fontWeight: 700, position: "relative", zIndex: 1 }}>
          Uploading to Cloudinary{progress > 0 ? ` ${progress}%` : "…"}
        </p>
        <style>{`@keyframes imgUploaderSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  /* ═══ STATE 3: Preview ══════════════════════════════════════════════════════ */
  return (
    <div>
      {/* Dual preview */}
      <div style={{ display: "flex", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
        {/* Checkerboard — transparency check */}
        <div style={{ flex: 1, minWidth: 120 }}>
          <p style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#5A9E6A", marginBottom: 5 }}>
            Background removed ✓
          </p>
          <div style={{ height: 130, borderRadius: 12, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", ...CHECKERBOARD }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="check" style={{ height: "80%", width: "auto", maxWidth: "80%", objectFit: "contain" }} />
          </div>
        </div>

        {/* Category color — on-menu look */}
        <div style={{ flex: 1, minWidth: 120 }}>
          <p style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C9A84C", marginBottom: 5 }}>
            Preview on menu
          </p>
          <div style={{ height: 130, borderRadius: 12, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: categoryColor }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="preview" style={{ height: "72%", width: "auto", maxWidth: "72%", objectFit: "contain", mixBlendMode: "multiply", filter: "drop-shadow(0px 8px 14px rgba(44,24,16,0.22))" }} />
          </div>
          <p style={{ fontSize: "0.6rem", color: "#5A9E6A", fontWeight: 600, marginTop: 3 }}>✓ White bg blended out</p>
        </div>
      </div>

      {/* Status badge */}
      <p style={{ fontSize: "0.72rem", fontWeight: 600, marginBottom: 8, color: bgRemoved ? "#5A9E6A" : "#C9A84C" }}>
        {bgRemoved ? "✓ Background removed automatically" : "✓ Uploaded — CSS blend mode active"}
      </p>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={reset} style={{ flex: 1, padding: "8px", borderRadius: 10, border: "1.5px solid rgba(122,110,101,0.2)", background: "transparent", color: "#7A6E65", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer" }}>
          ↺ Retake
        </button>
        <button onClick={() => onConfirm(previewUrl)} style={{ flex: 2, padding: "8px", borderRadius: 10, background: "#2C1810", color: "#FDFAF5", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", border: "none" }}>
          ✓ Use This Image
        </button>
        {onRemoveImage && (
          <button onClick={onRemoveImage} style={{ padding: "8px 12px", borderRadius: 10, border: "1.5px solid rgba(220,38,38,0.25)", background: "rgba(220,38,38,0.06)", color: "#DC2626", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer" }}>
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
