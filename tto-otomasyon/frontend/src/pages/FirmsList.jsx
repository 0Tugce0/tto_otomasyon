/**
 * FirmsList.jsx — Firmalar listesi.
 *
 * AcademiciansList.jsx ile aynı gerekçeyle: sidebar'daki "Firmalar" öğesi
 * "Yakında" olarak bırakılmıştı çünkü bir liste sayfası yoktu (sadece
 * tek bir firmanın detay sayfası — modül 5). Aynı eksiği Akademisyenler'de
 * yaşadık, burada baştan kapatıyoruz.
 */

import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";
import AppShell from "../components/AppShell";
import QuickAddFirmModal from "../components/QuickAddFirmModal";
import { PlusCircleIcon, SearchIcon, ApartmentIcon, BankIcon, MailIcon } from "../components/icons";

const CARD = "rounded-xl p-5 bg-surface shadow-[6px_6px_12px_rgba(0,0,0,0.08),-6px_-6px_12px_rgba(255,255,255,0.6)]";
const INSET = "shadow-[inset_4px_4px_8px_rgba(0,0,0,0.06),inset_-4px_-4px_8px_rgba(255,255,255,0.5)]";
const RAISED = "shadow-[3px_3px_6px_rgba(0,0,0,0.06),-3px_-3px_6px_rgba(255,255,255,0.6)]";

export default function FirmsList({ showToast }) {
  const [firms, setFirms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  function load() {
    setLoading(true);
    apiFetch("/api/firms/")
      .then(f => setFirms(Array.isArray(f) ? f : []))
      .catch(e => {
        if (e instanceof ApiError && e.status !== 401) showToast?.(e.message, "error");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return firms;
    return firms.filter(f =>
      f.name.toLowerCase().includes(q) ||
      (f.tax_office || "").toLowerCase().includes(q) ||
      (f.contact_email || "").toLowerCase().includes(q)
    );
  }, [firms, search]);

  async function handleCreate(payload) {
    const created = await apiFetch("/api/firms/", { method: "POST", body: JSON.stringify(payload) });
    showToast?.(`Firma eklendi: ${created.name}`, "success");
    load();
  }

  const content = (
    <div className="flex flex-col w-full gap-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-on-surface-variant">Kurumsal Portföy</span>
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          </div>
          <h1 className="text-2xl lg:text-3xl font-semibold text-on-surface tracking-tight">Firmalar</h1>
          <p className="text-xs lg:text-sm text-on-surface-variant">Sözleşme yapılan tüm firmalar — detay için bir karta tıklayın.</p>
        </div>
        <button type="button" onClick={() => setCreateOpen(true)}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface text-xs font-semibold text-primary ${RAISED} transition-all self-start`}>
          <PlusCircleIcon className="w-[18px] h-[18px]" />
          <span>Yeni Firma</span>
        </button>
      </div>

      <div className={CARD}>
        <div className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-surface ${INSET}`}>
          <SearchIcon className="text-on-surface-variant w-[18px] h-[18px]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-transparent text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none"
            placeholder="İsim, vergi dairesi veya e-postaya göre ara…"
          />
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-on-surface-variant text-sm">Yükleniyor…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className={`${CARD} text-center py-12`}>
          <p className="text-on-surface font-medium">Firma bulunamadı</p>
          <p className="text-on-surface-variant text-sm mt-1">{search ? "Aramanızı değiştirmeyi deneyin." : "Henüz firma eklenmemiş."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(f => (
            <Link key={f.id} to={`/firms/${f.id}`}
              className={`${CARD} flex flex-col gap-4 hover:text-primary transition-all group`}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <ApartmentIcon className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-on-surface group-hover:text-primary truncate">{f.name}</div>
                  {f.tax_office && <div className="text-[11px] text-on-surface-variant truncate">{f.tax_office}</div>}
                </div>
              </div>
              <div className="flex flex-col gap-1.5 pt-3 border-t border-surface-variant/40 text-[11px] text-on-surface-variant">
                <span className="flex items-center gap-1.5">
                  <BankIcon className="w-3.5 h-3.5" />
                  {tax_no_or(f)}
                </span>
                <span className="flex items-center gap-1.5">
                  <MailIcon className="w-3.5 h-3.5" />
                  {f.contact_email || "E-posta yok"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <QuickAddFirmModal open={createOpen} firm={null} onClose={() => setCreateOpen(false)} onSave={handleCreate} />
    </div>
  );

  return <AppShell activePath="firmalar">{content}</AppShell>;
}

function tax_no_or(f) {
  return f.tax_no ? `VKN: ${f.tax_no}` : "Vergi no yok";
}
