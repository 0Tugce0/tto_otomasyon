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
      {label && <label className="block text-xs font-medium text-custom-primary mb-1.5">{label}</label>}
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
          className="w-full px-3 py-2.5 bg-custom-primary/5 border border-custom-primary/25 rounded-xl text-custom-text text-sm focus:outline-none focus:border-custom-primary disabled:opacity-50"
        />
        {allowClear && value && (
          <button
            type="button"
            onClick={handleClear}
            title="Temizle"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-custom-primary/60 hover:text-custom-text text-xs px-1"
          >
            ✕
          </button>
        )}
      </div>

      {open && !disabled && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-custom-primary/20 rounded-xl shadow-xl">
          {filtered.length === 0 && !showCreateOption && (
            <div className="px-3 py-2 text-xs text-custom-primary/60">Sonuç yok</div>
          )}
          {filtered.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => selectItem(item)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-custom-primary/10 transition-colors ${
                String(item.id) === String(value) ? "text-custom-accent" : "text-custom-text"
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
              className="w-full text-left px-3 py-2 text-sm text-green-600 hover:bg-custom-primary/10 border-t border-custom-primary/15 transition-colors disabled:opacity-50"
            >
              {creating ? "Oluşturuluyor…" : `+ '${trimmedQuery}' olarak yeni ekle`}
            </button>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
