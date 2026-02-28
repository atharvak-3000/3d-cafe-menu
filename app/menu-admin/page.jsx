"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import PinPad from "@/components/PinPad";
import { db } from "@/lib/firebase";
import { ref, onValue, set, push, update, remove } from "firebase/database";
import { menuItems as DEFAULT_ITEMS, CATEGORY_COLORS } from "@/lib/menuItems";

const CLOUDINARY_CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN || "0000";

/* ── category meta ─────────────────────────────────────────────────────────── */
const CATEGORIES = [
  { key: "coffee", label: "Coffee",  emoji: "☕" },
  { key: "tea",    label: "Tea",     emoji: "🍵" },
  { key: "food",   label: "Food",    emoji: "🥐" },
  { key: "sweet",  label: "Sweets",  emoji: "🍰" },
];

/* ── blank form template ────────────────────────────────────────────────────── */
const BLANK = {
  name: "", category: "coffee", emoji: "☕",
  tag: "", desc: "", price: "",
  special: false, available: true,
  imageUrl: "",
};

/* ── tiny Toggle switch ─────────────────────────────────────────────────────── */
function Toggle({ checked, onChange, green = false }) {
  const on = green ? "#5A9E6A" : "#C9A84C";
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: 40, height: 22, borderRadius: 11,
        background: checked ? on : "#D5CBBF",
        border: "none", cursor: "pointer", position: "relative",
        transition: "background 0.25s", flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute", top: 3,
        left: checked ? 21 : 3,
        width: 16, height: 16, borderRadius: "50%",
        background: "#fff",
        transition: "left 0.25s",
        boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
      }} />
    </button>
  );
}

/* ── Success toast ──────────────────────────────────────────────────────────── */
function SuccessToast({ msg }) {
  return (
    <div style={{
      position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
      zIndex: 600, background: "#2C1810", borderRadius: 50,
      padding: "10px 22px", display: "flex", alignItems: "center", gap: 10,
      border: "1px solid rgba(201,168,76,0.35)",
      boxShadow: "0 8px 32px rgba(44,24,16,0.35)",
      fontFamily: "Georgia, serif", fontSize: "0.9rem", color: "#F5EDD6",
      animation: "toastIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both",
      whiteSpace: "nowrap",
    }}>
      <span style={{ color: "#5A9E6A", fontWeight: 700, fontSize: "1rem" }}>✓</span>
      <span style={{ color: "#C9A84C", fontWeight: 700 }}>{msg}</span>
      <style>{`@keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(16px) scale(0.9)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}`}</style>
    </div>
  );
}

/* ── Mini card preview ──────────────────────────────────────────────────────── */
function CardPreview({ form, imageUrl }) {
  const bg = CATEGORY_COLORS[form.category] || "#E8D5A3";
  const displayImageUrl = imageUrl || form.imageUrl || "";
  return (
    <div style={{
      background: "#FDFAF5", borderRadius: 24, overflow: "hidden",
      boxShadow: "0 4px 20px rgba(44,24,16,0.10)",
      border: "1px solid rgba(201,168,76,0.25)", width: "100%", maxWidth: 280,
    }}>
      <div style={{
        height: 120, background: bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "3rem", position: "relative", overflow: "hidden",
      }}>
        {displayImageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={displayImageUrl}
            alt={form.name || "Preview"}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          form.emoji || "🍽️"
        )}
        {form.special && (
          <span style={{
            position: "absolute", top: 8, right: 8,
            background: "#ef4444", color: "#fff",
            fontSize: "0.65rem", fontWeight: 700,
            padding: "3px 8px", borderRadius: 999,
            zIndex: 2,
          }}>Chef&apos;s Pick</span>
        )}
      </div>
      <div style={{ padding: "14px 16px" }}>
        <p style={{ color: "#C9A84C", fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 4 }}>
          {form.tag || "TAG"}
        </p>
        <h3 style={{ fontFamily: "Georgia, serif", fontSize: "1.15rem", fontWeight: 700, color: "#2C1810", marginBottom: 4, lineHeight: 1.2 }}>
          {form.name || "Item Name"}
        </h3>
        <p style={{ color: "#7A6E65", fontSize: "0.78rem", marginBottom: 10, lineHeight: 1.4 }}>
          {form.desc || "Item description..."}
        </p>
        <p style={{ fontFamily: "Georgia, serif", fontSize: "1.3rem", fontWeight: 700, color: "#2C1810" }}>
          ₹{form.price || "0"}
        </p>
      </div>
    </div>
  );
}

/* ── Image Upload Box ───────────────────────────────────────────────────────── */
function ImageUploadBox({ previewUrl, onFileSelected, onRemove, uploadProgress, uploadError, isDragging, onDragOver, onDragLeave, onDrop }) {
  const inputRef = useRef(null);

  return (
    <div>
      <label style={{
        display: "block", fontSize: "0.72rem", fontWeight: 700,
        textTransform: "uppercase", letterSpacing: "0.1em",
        color: "#7A6E65", marginBottom: 5,
      }}>
        Item Image
      </label>

      {/* Drop zone */}
      <div
        onClick={() => !previewUrl && inputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={{
          position: "relative",
          height: 160,
          borderRadius: 16,
          border: isDragging
            ? "2px solid #C9A84C"
            : "2px dashed rgba(201,168,76,0.4)",
          background: isDragging ? "rgba(201,168,76,0.05)" : "#F7F2EA",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column", gap: 8,
          cursor: previewUrl ? "default" : "pointer",
          overflow: "hidden",
          transition: "border-color 0.2s, background 0.2s",
        }}
      >
        {previewUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Preview"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
            {/* Remove button */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              style={{
                position: "absolute", top: 8, right: 8,
                background: "#2C1810", color: "#fff",
                border: "none", borderRadius: 8,
                padding: "4px 10px", fontSize: "0.72rem",
                fontWeight: 700, cursor: "pointer",
                zIndex: 2,
              }}
            >✕ Remove</button>

            {/* Upload progress bar */}
            {uploadProgress !== null && (
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                height: 4, background: "rgba(0,0,0,0.2)",
              }}>
                <div style={{
                  height: "100%", background: "#C9A84C",
                  width: `${uploadProgress}%`,
                  transition: "width 0.3s ease",
                }} />
              </div>
            )}
          </>
        ) : (
          <>
            <span style={{ fontSize: "2rem", lineHeight: 1 }}>📷</span>
            <span style={{ color: "#7A6E65", fontSize: "0.82rem", fontWeight: 600, textAlign: "center", paddingInline: 16 }}>
              Drop image here or click to upload
            </span>
            <span style={{ color: "#B0A89E", fontSize: "0.7rem" }}>
              JPG, PNG, WEBP · Max 2MB
            </span>
          </>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => onFileSelected(e.target.files[0])}
      />

      {/* Validation error */}
      {uploadError && (
        <p style={{ color: "#DC2626", fontSize: "0.75rem", marginTop: 5, fontWeight: 600 }}>
          {uploadError}
        </p>
      )}
    </div>
  );
}

/* ── Add/Edit Modal ─────────────────────────────────────────────────────────── */
function ItemModal({ item, onClose, onSaved }) {
  const isEdit = !!item?.firebaseKey;
  const [form, setForm] = useState(item ? {
    name: item.name || "", category: item.category || "coffee",
    emoji: item.emoji || "☕", tag: item.tag || "",
    desc: item.desc || "", price: item.price || "",
    special: item.special || false, available: item.available !== false,
    imageUrl: item.imageUrl || "",
  } : { ...BLANK });
  const [saving, setSaving] = useState(false);

  /* ── Image upload state ───────────────────────────────────────────────────── */
  const [imageFile, setImageFile]           = useState(null);   // new File to upload
  const [previewUrl, setPreviewUrl]         = useState(item?.imageUrl || ""); // local blob or existing URL
  const [uploadError, setUploadError]       = useState("");
  const [uploadProgress, setUploadProgress] = useState(null);   // 0-100 or null
  const [isDragging, setIsDragging]         = useState(false);
  const [imageRemoved, setImageRemoved]     = useState(false);  // admin clicked ✕ Remove

  const set_ = (k, v) => setForm(f => ({ ...f, [k]: v }));

  /* ── Validate & accept a file ─────────────────────────────────────────────── */
  const processFile = (file) => {
    if (!file) return;
    setUploadError("");
    if (!file.type.startsWith("image/")) {
      setUploadError("Please select a valid image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError("Image too large. Max 2MB.");
      return;
    }
    setImageFile(file);
    setImageRemoved(false);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  /* ── Drag & drop handlers ─────────────────────────────────────────────────── */
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    processFile(e.dataTransfer.files[0]);
  };

  /* ── Remove image ─────────────────────────────────────────────────────────── */
  const handleRemoveImage = () => {
    setImageFile(null);
    setPreviewUrl("");
    setImageRemoved(true);
    setUploadError("");
    setUploadProgress(null);
  };

  /* ── Save ─────────────────────────────────────────────────────────────────── */
  const handleSave = async () => {
    if (!form.name || !form.price) return;
    setSaving(true);
    setUploadError("");

    try {
      let finalImageUrl = form.imageUrl;

      if (imageRemoved) {
        // Admin clicked Remove — clear imageUrl
        finalImageUrl = "";
      } else if (imageFile) {
        // Upload to Cloudinary via unsigned upload preset
        finalImageUrl = await new Promise((resolve, reject) => {
          const formData = new FormData();
          formData.append("file", imageFile);
          formData.append("upload_preset", CLOUDINARY_PRESET);

          const xhr = new XMLHttpRequest();
          xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`);

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              setUploadProgress(Math.round((e.loaded / e.total) * 100));
            }
          };

          xhr.onload = () => {
            if (xhr.status === 200) {
              const data = JSON.parse(xhr.responseText);
              resolve(data.secure_url);
            } else {
              reject(new Error("Cloudinary upload failed"));
            }
          };

          xhr.onerror = () => reject(new Error("Network error during upload"));
          xhr.send(formData);
        });
      }

      const payload = {
        ...form,
        tag: form.tag.toUpperCase(),
        price: Number(form.price),
        available: form.available !== false,
        imageUrl: finalImageUrl,
      };

      if (isEdit) {
        await update(ref(db, `menu/${item.firebaseKey}`), payload);
      } else {
        await push(ref(db, "menu"), payload);
      }

      onSaved(isEdit ? "Item updated" : "Item added");
      onClose();
    } catch {
      setUploadError("Upload failed. Try again.");
      setSaving(false);
      setUploadProgress(null);
    }
  };

  const inputStyle = {
    width: "100%", padding: "9px 12px", borderRadius: 10,
    border: "1.5px solid rgba(122,110,101,0.2)",
    background: "#F7F2EA", color: "#2C1810",
    fontSize: "0.9rem", outline: "none", boxSizing: "border-box",
    fontFamily: "DM Sans, sans-serif",
  };
  const labelStyle = {
    display: "block", fontSize: "0.72rem", fontWeight: 700,
    textTransform: "uppercase", letterSpacing: "0.1em",
    color: "#7A6E65", marginBottom: 5,
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(44,24,16,0.45)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "#FDFAF5", borderRadius: 24, width: "100%",
        maxWidth: 860, maxHeight: "92vh", overflow: "auto",
        boxShadow: "0 24px 80px rgba(44,24,16,0.25)",
        display: "flex", flexDirection: "row", flexWrap: "wrap",
      }}>

        {/* ── Form side ── */}
        <div style={{ flex: "1 1 340px", padding: "32px 28px", minWidth: 300 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: "1.4rem", fontWeight: 700, color: "#2C1810", margin: 0 }}>
              {isEdit ? "Edit Item" : "Add New Item"}
            </h2>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.3rem", cursor: "pointer", color: "#7A6E65", padding: 4 }}>✕</button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Name */}
            <div>
              <label style={labelStyle}>Item Name *</label>
              <input style={inputStyle} value={form.name} onChange={e => set_("name", e.target.value)} placeholder="e.g. Saffron Latte" />
            </div>

            {/* Category */}
            <div>
              <label style={labelStyle}>Category *</label>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={form.category} onChange={e => set_("category", e.target.value)}>
                {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>)}
              </select>
            </div>

            {/* Emoji */}
            <div>
              <label style={labelStyle}>Emoji (fallback when no image)</label>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input style={{ ...inputStyle, flex: 1 }} value={form.emoji} onChange={e => set_("emoji", e.target.value)} placeholder="☕" maxLength={4} />
                <span style={{ fontSize: "2.2rem", lineHeight: 1 }}>{form.emoji}</span>
              </div>
            </div>

            {/* Image Upload */}
            <ImageUploadBox
              previewUrl={previewUrl}
              onFileSelected={processFile}
              onRemove={handleRemoveImage}
              uploadProgress={uploadProgress}
              uploadError={uploadError}
              isDragging={isDragging}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            />

            {/* Tag */}
            <div>
              <label style={labelStyle}>Tag</label>
              <input style={inputStyle} value={form.tag} onChange={e => set_("tag", e.target.value.toUpperCase())} placeholder="e.g. POPULAR" maxLength={20} />
            </div>

            {/* Description */}
            <div>
              <label style={labelStyle}>Description (max 120 chars)</label>
              <textarea
                style={{ ...inputStyle, height: 72, resize: "none" }}
                value={form.desc}
                onChange={e => set_("desc", e.target.value.slice(0, 120))}
                placeholder="A short description of the item..."
              />
              <p style={{ fontSize: "0.7rem", color: "#7A6E65", textAlign: "right", marginTop: 3 }}>{form.desc.length}/120</p>
            </div>

            {/* Price */}
            <div>
              <label style={labelStyle}>Price *</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#C9A84C", fontWeight: 700, fontFamily: "Georgia, serif" }}>₹</span>
                <input style={{ ...inputStyle, paddingLeft: 28 }} type="number" value={form.price} onChange={e => set_("price", e.target.value)} placeholder="280" min={0} />
              </div>
            </div>

            {/* Toggles */}
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Toggle checked={form.special} onChange={v => set_("special", v)} />
                <span style={{ fontSize: "0.85rem", color: "#2C1810", fontWeight: 600 }}>Chef&apos;s Pick</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Toggle checked={form.available} onChange={v => set_("available", v)} green />
                <span style={{ fontSize: "0.85rem", color: "#2C1810", fontWeight: 600 }}>Available</span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button onClick={onClose} style={{
                flex: 1, padding: "11px 0", borderRadius: 12,
                border: "1.5px solid rgba(122,110,101,0.2)",
                background: "transparent", color: "#7A6E65",
                fontWeight: 700, fontSize: "0.9rem", cursor: "pointer",
              }}>Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.name || !form.price} style={{
                flex: 2, padding: "11px 0", borderRadius: 12,
                background: saving ? "#b09038" : "#C9A84C",
                border: "none", color: "#FDFAF5",
                fontWeight: 700, fontSize: "0.9rem", cursor: saving ? "not-allowed" : "pointer",
                transition: "background 0.2s",
              }}>
                {saving ? (uploadProgress !== null ? `Uploading… ${uploadProgress}%` : "Saving…") : isEdit ? "Save Changes" : "Add Item"}
              </button>
            </div>
          </div>
        </div>

        {/* ── Preview side ── */}
        <div style={{
          flex: "0 0 280px", background: "#F7F2EA", borderLeft: "1px solid rgba(122,110,101,0.1)",
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: "32px 24px", gap: 16,
        }}>
          <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "#7A6E65", marginBottom: 4 }}>
            Live Preview
          </p>
          <CardPreview form={form} imageUrl={imageRemoved ? "" : previewUrl} />
        </div>
      </div>
    </div>
  );
}

/* ── Delete confirm inline ──────────────────────────────────────────────────── */
function DeleteConfirm({ itemName, onCancel, onConfirm }) {
  return (
    <div style={{
      background: "#FFF5F5", border: "1px solid #FECACA",
      borderRadius: 12, padding: "12px 16px", marginTop: 8,
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <p style={{ color: "#991B1B", fontSize: "0.82rem", fontWeight: 600, margin: 0 }}>
        Delete &ldquo;{itemName}&rdquo;? This cannot be undone.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onCancel} style={{
          flex: 1, padding: "7px 0", borderRadius: 8,
          border: "1px solid rgba(0,0,0,0.1)", background: "#fff",
          color: "#2C1810", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
        }}>Cancel</button>
        <button onClick={onConfirm} style={{
          flex: 1, padding: "7px 0", borderRadius: 8,
          background: "#DC2626", border: "none",
          color: "#fff", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer",
        }}>Confirm Delete</button>
      </div>
    </div>
  );
}

/* ── Item row ───────────────────────────────────────────────────────────────── */
function ItemRow({ item, onEdit, onDelete, onToggleAvailable, onToggleSpecial }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const bg = CATEGORY_COLORS[item.category] || "#E8D5A3";
  const muted = !item.available;

  return (
    <div style={{
      background: "#FDFAF5", borderRadius: 16, border: "1px solid rgba(122,110,101,0.1)",
      padding: "14px 16px", display: "flex", alignItems: "center", gap: 14,
      opacity: muted ? 0.55 : 1, transition: "opacity 0.2s",
    }}>
      {/* drag handle (visual) */}
      <span style={{ color: "#D5CBBF", fontSize: "1rem", cursor: "grab", flexShrink: 0 }}>⠿</span>

      {/* image/emoji circle */}
      <div style={{
        width: 52, height: 52, borderRadius: "50%",
        background: bg, display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: "1.5rem", flexShrink: 0,
        overflow: "hidden",
      }}>
        {item.imageUrl
          /* eslint-disable-next-line @next/next/no-img-element */
          ? <img src={item.imageUrl} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : item.emoji
        }
      </div>

      {/* info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <h3 style={{ fontFamily: "Georgia, serif", fontWeight: 700, fontSize: "1rem", color: "#2C1810", margin: 0 }}>
            {item.name}
          </h3>
          {item.tag && (
            <span style={{
              fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.12em", padding: "2px 7px", borderRadius: 999,
              background: "rgba(201,168,76,0.12)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.3)",
            }}>{item.tag}</span>
          )}
        </div>
        <p style={{ color: "#7A6E65", fontSize: "0.78rem", margin: "3px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 300 }}>
          {item.desc}
        </p>
        <p style={{ fontFamily: "Georgia, serif", fontWeight: 700, color: "#C9A84C", fontSize: "0.95rem", margin: "4px 0 0" }}>
          ₹{item.price}
        </p>
      </div>

      {/* actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, flexWrap: "wrap" }}>
        {/* available toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Toggle checked={item.available !== false} onChange={() => onToggleAvailable(item)} green />
          <span style={{ fontSize: "0.7rem", color: "#7A6E65", fontWeight: 600 }}>
            {item.available !== false ? "On" : "Off"}
          </span>
        </div>

        {/* chef's pick star */}
        <button onClick={() => onToggleSpecial(item)} title="Chef's Pick" style={{
          background: "none", border: "none", fontSize: "1.1rem",
          cursor: "pointer", padding: 4, lineHeight: 1,
          filter: item.special ? "none" : "grayscale(1) opacity(0.35)",
          transition: "filter 0.2s",
        }}>⭐</button>

        {/* edit */}
        <button onClick={() => onEdit(item)} style={{
          padding: "6px 14px", borderRadius: 8,
          border: "1.5px solid rgba(122,110,101,0.2)",
          background: "transparent", color: "#2C1810",
          fontSize: "0.78rem", fontWeight: 700, cursor: "pointer",
        }}>Edit</button>

        {/* delete */}
        <button onClick={() => setConfirmDelete(true)} style={{
          padding: "6px 14px", borderRadius: 8,
          border: "1.5px solid rgba(220,38,38,0.25)",
          background: "rgba(220,38,38,0.06)", color: "#DC2626",
          fontSize: "0.78rem", fontWeight: 700, cursor: "pointer",
        }}>Delete</button>
      </div>

      {/* confirm delete */}
      {confirmDelete && (
        <div style={{ position: "absolute", left: 0, right: 0, top: "100%", zIndex: 10, padding: "0 16px" }}>
          <DeleteConfirm
            itemName={item.name}
            onCancel={() => setConfirmDelete(false)}
            onConfirm={() => { setConfirmDelete(false); onDelete(item.firebaseKey); }}
          />
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════════════ */
export default function MenuAdminPage() {
  const [authed, setAuthed]     = useState(false);
  const [items, setItems]       = useState([]);
  const [seeded, setSeeded]     = useState(false);
  const [modal, setModal]       = useState(null);   // null | "add" | item object
  const [toast, setToast]       = useState("");
  const [collapsed, setCollapsed] = useState({});

  /* ── Firebase subscription + seeding ─────────────────────────────────────── */
  useEffect(() => {
    if (!authed) return;
    const menuRef = ref(db, "menu");
    const unsub = onValue(menuRef, async (snap) => {
      const data = snap.val();
      if (!data && !seeded) {
        // Seed defaults
        const seed = {};
        DEFAULT_ITEMS.forEach((item) => {
          const { id, ...rest } = item;
          seed[id] = { ...rest, available: true, imageUrl: "" };
        });
        await set(menuRef, seed);
        setSeeded(true);
        return;
      }
      if (data) {
        const arr = Object.entries(data).map(([key, val]) => ({ ...val, firebaseKey: key }));
        setItems(arr);
      }
    });
    return () => unsub();
  }, [authed, seeded]);

  /* ── Handlers ─────────────────────────────────────────────────────────────── */
  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }, []);

  const handleToggleAvailable = useCallback((item) => {
    update(ref(db, `menu/${item.firebaseKey}`), { available: !(item.available !== false) });
  }, []);

  const handleToggleSpecial = useCallback((item) => {
    update(ref(db, `menu/${item.firebaseKey}`), { special: !item.special });
  }, []);

  const handleDelete = useCallback((key) => {
    remove(ref(db, `menu/${key}`));
    showToast("Item deleted");
  }, [showToast]);

  const toggleCollapse = (cat) => setCollapsed(c => ({ ...c, [cat]: !c[cat] }));

  /* ── PIN WALL ──────────────────────────────────────────────────────────────── */
  if (!authed) {
    return <PinPad role="Menu Manager" pin={ADMIN_PIN} onSuccess={() => setAuthed(true)} dark={false} />;
  }

  /* ── Grouped items ────────────────────────────────────────────────────────── */
  const grouped = {};
  CATEGORIES.forEach(c => { grouped[c.key] = []; });
  items.forEach(item => {
    if (grouped[item.category] !== undefined) grouped[item.category].push(item);
  });

  /* ── Category overview stats ─────────────────────────────────────────────── */
  const catStats = CATEGORIES.map(c => ({
    ...c,
    total:     grouped[c.key].length,
    available: grouped[c.key].filter(i => i.available !== false).length,
  }));

  /* ── DASHBOARD ─────────────────────────────────────────────────────────────── */
  return (
    <div style={{ minHeight: "100vh", background: "#F7F2EA", color: "#2C1810", fontFamily: "DM Sans, sans-serif", paddingBottom: 64 }}>

      {/* ── TOPBAR ──────────────────────────────────────────────────────────────── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(247,242,234,0.9)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(122,110,101,0.12)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 24px", flexWrap: "wrap", gap: 12,
      }}>
        {/* Left */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: "1.5rem", fontWeight: 700, color: "#2C1810", margin: 0 }}>
            Lumière <span style={{ color: "#C9A84C", fontStyle: "italic" }}>Café</span>
          </h1>
          <span style={{
            fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.2em", padding: "4px 10px", borderRadius: 999,
            border: "1px solid rgba(201,168,76,0.5)", color: "#C9A84C",
          }}>Menu Manager</span>
        </div>

        {/* Right */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{
            background: "#F7F2EA", border: "1px solid rgba(122,110,101,0.15)",
            borderRadius: 999, padding: "5px 14px",
            fontSize: "0.82rem", fontWeight: 700, color: "#7A6E65",
          }}>
            {items.length} items
          </span>

          <button onClick={() => setModal("add")} style={{
            padding: "8px 18px", borderRadius: 12,
            background: "#C9A84C", border: "none",
            color: "#FDFAF5", fontWeight: 700, fontSize: "0.88rem",
            cursor: "pointer", boxShadow: "0 4px 14px rgba(201,168,76,0.35)",
          }}>+ Add Item</button>

          <button onClick={() => setAuthed(false)} style={{
            padding: "8px 14px", borderRadius: 10,
            border: "1px solid rgba(122,110,101,0.2)", background: "transparent",
            color: "#7A6E65", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer",
          }}>Logout</button>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 16px", display: "flex", flexDirection: "column", gap: 36 }}>

        {/* ── ITEM LIST grouped by category ─────────────────────────────────── */}
        {CATEGORIES.map(cat => {
          const catItems = grouped[cat.key] || [];
          const isOpen = !collapsed[cat.key];
          return (
            <section key={cat.key}>
              {/* Category header */}
              <button
                onClick={() => toggleCollapse(cat.key)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  background: "none", border: "none", cursor: "pointer",
                  padding: "0 0 12px", color: "#2C1810",
                }}
              >
                <span style={{ fontSize: "1.3rem" }}>{cat.emoji}</span>
                <h2 style={{ fontFamily: "Georgia, serif", fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>
                  {cat.label}
                </h2>
                <span style={{
                  background: "rgba(201,168,76,0.12)", color: "#C9A84C",
                  border: "1px solid rgba(201,168,76,0.3)",
                  borderRadius: 999, padding: "2px 10px",
                  fontSize: "0.72rem", fontWeight: 700,
                }}>{catItems.length}</span>
                <span style={{ marginLeft: "auto", color: "#7A6E65", fontSize: "1rem", transition: "transform 0.2s", transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}>▼</span>
              </button>

              {isOpen && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {catItems.length === 0 ? (
                    <p style={{ color: "#7A6E65", opacity: 0.5, fontStyle: "italic", padding: "8px 0" }}>No items in this category.</p>
                  ) : (
                    catItems.map(item => (
                      <div key={item.firebaseKey} style={{ position: "relative" }}>
                        <ItemRow
                          item={item}
                          onEdit={setModal}
                          onDelete={handleDelete}
                          onToggleAvailable={handleToggleAvailable}
                          onToggleSpecial={handleToggleSpecial}
                        />
                      </div>
                    ))
                  )}
                </div>
              )}
            </section>
          );
        })}

        {/* ── CATEGORY OVERVIEW ─────────────────────────────────────────────── */}
        <section>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "1.2rem", fontWeight: 700, color: "#C9A84C", marginBottom: 16 }}>
            Category Overview
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px,1fr))", gap: 14 }}>
            {catStats.map(c => (
              <div key={c.key} style={{
                background: "#FDFAF5", borderRadius: 16,
                border: "1px solid rgba(122,110,101,0.1)",
                borderLeft: `3px solid ${CATEGORY_COLORS[c.key] || "#C9A84C"}`,
                padding: "18px 20px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: "1.4rem" }}>{c.emoji}</span>
                  <span style={{ fontFamily: "Georgia, serif", fontWeight: 700, color: "#2C1810", fontSize: "1rem" }}>{c.label}</span>
                </div>
                <p style={{ margin: 0, fontSize: "2rem", fontFamily: "Georgia, serif", fontWeight: 700, color: "#2C1810" }}>{c.total}</p>
                <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "#7A6E65" }}>
                  <span style={{ color: "#5A9E6A", fontWeight: 700 }}>{c.available}</span> available
                  {" · "}
                  <span style={{ color: "#C4807A", fontWeight: 700 }}>{c.total - c.available}</span> off
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* ── MODAL ─────────────────────────────────────────────────────────────── */}
      {modal && (
        <ItemModal
          item={modal === "add" ? null : modal}
          onClose={() => setModal(null)}
          onSaved={showToast}
        />
      )}

      {/* ── SUCCESS TOAST ──────────────────────────────────────────────────────── */}
      {toast && <SuccessToast msg={toast} />}
    </div>
  );
}
