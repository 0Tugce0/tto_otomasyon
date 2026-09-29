/**
 * SearchableCreatableSelect.jsx — Aranabilir + "yeni ekle" combobox.
 *
 * items:  [{ id, label }]
 * value:  seçili id (veya "")
 * onChange: (id) => void — id "" ise seçim temizlenir
 * onCreate: async (trimmedName) => { id, label } — yeni kayıt oluşturur
 *
 * Mevcut isimlerle TAM eşleşme (case-insensitive, trim'lenmiş) varsa
 * "+ yeni ekle" seçeneği gösterilmez — mevcut kayıt filtrelenmiş
 * listede zaten görünür ve seçilebilir (mükerrer oluşturmayı önler).
 */

import { useState, useRef, useEffect } from "react";

const INSET = "shadow-[inset_3px_3px_6px_rgba(0,0,0,0.06),inset_-3px_-3px_6px_rgba(255,255,255,0.6)]";

export default function SearchableCreatableSelect({
  id,
  label,
  items,
  value,
  onChange,
  onCreate,
  placeholder = "Ara veya yeni ekle…",
  allowClear = false,
  disabled = false,
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const wrapRef = useRef(null);

  const selected = items.find((i) => String(i.id) === String(value));

  // Dışarıdan value değiştiğinde (örn. edit modunda kayıt yüklenince)
  // input metnini seçili öğenin label'ı ile senkronize et.
  useEffect(() => {
    if (!open) setQuery(selected ? selected.label : "");
  }, [selected?.id, selected?.label, open]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setQuery(selected ? selected.label : "");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selected]);

  const trimmedQuery = query.trim();
  const filtered = trimmedQuery
    ? items.filter((i) => i.label.toLowerCase().includes(trimmedQuery.toLowerCase()))
    : items;
  const exactMatch = items.find(
    (i) => i.label.trim().toLowerCase() === trimmedQuery.toLowerCase()
  );
  const showCreateOption = trimmedQuery.length > 0 && !exactMatch;

  function selectItem(item) {
    onChange(item.id);
    setQuery(item.label);
    setOpen(false);
    setError("");
  }

  function handleClear(e) {
    e.stopPropagation();
    onChange("");
    setQuery("");
    setError("");
  }

  async function handleCreateClick() {
    if (creating) return;
    setCreating(true);
    setError("");
    try {
      const created = await onCreate(trimmedQuery);
      selectItem(created);
    } catch (e) {
      setError(e?.message || "Oluşturulamadı. Lütfen tekrar deneyin.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      {label && <label className="block text-xs font-semibold text-on-surface mb-1.5">{label}</label>}
      <div className="relative">
        <input
          id={id}
          type="text"
          disabled={disabled}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (value) onChange("");
          }}
          placeholder={placeholder}
          autoComplete="off"
          className={`w-full px-3.5 py-3 rounded-xl bg-surface text-xs font-medium text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none disabled:opacity-50 ${INSET}`}
        />
        {allowClear && value && (
          <button
            type="button"
            onClick={handleClear}
            title="Temizle"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface text-xs px-1"
          >
            ✕
          </button>
        )}
      </div>

      {open && !disabled && (
        <div className="absolute z-20 mt-2 w-full max-h-56 overflow-y-auto rounded-xl bg-surface p-2 shadow-[8px_8px_16px_rgba(0,0,0,0.08),-8px_-8px_16px_rgba(255,255,255,0.7)]">
          {filtered.length === 0 && !showCreateOption && (
            <div className="px-3 py-2 text-xs text-on-surface-variant">Sonuç yok</div>
          )}
          {filtered.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => selectItem(item)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-surface-variant/40 transition-colors ${
                String(item.id) === String(value) ? "text-primary font-medium" : "text-on-surface"
              }`}
            >
              {item.label}
            </button>
          ))}
          {showCreateOption && (
            <button
              type="button"
              onClick={handleCreateClick}
              disabled={creating}
              className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-primary hover:bg-surface-variant/40 transition-colors disabled:opacity-50"
            >
              {creating ? "Oluşturuluyor…" : `+ '${trimmedQuery}' olarak yeni ekle`}
            </button>
          )}
        </div>
      )}

      {error && <p className="text-xs text-error mt-1">{error}</p>}
    </div>
  );
}
