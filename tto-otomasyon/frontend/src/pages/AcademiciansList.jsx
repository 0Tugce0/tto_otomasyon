/**
 * AcademiciansList.jsx — Akademisyenler listesi.
 *
 * Sidebar'daki "Akademisyenler" öğesi modül 4'te (Akademisyen Portföy Paneli)
 * kasıtlı olarak "Yakında" bırakılmıştı çünkü sadece TEK bir akademisyenin
 * detay sayfası vardı, bir LİSTE sayfası yoktu. Bu sayfa o eksiği kapatır —
 * Stitch'ten ayrı bir modül olarak gelmedi, İş Kayıtları (modül 3) ve
 * Akademisyen Detay (modül 4) ile aynı görsel dil kullanılarak, var olan
 * GET /api/academicians/ ve POST /api/academicians/ endpoint'leriyle kuruldu.
 */

import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";
import AppShell from "../components/AppShell";
import EditAcademicianModal from "../components/EditAcademicianModal";
import { PlusCircleIcon, SearchIcon, SchoolIcon, BankIcon } from "../components/icons";

const CARD = "rounded-xl p-5 bg-surface shadow-[6px_6px_12px_rgba(0,0,0,0.08),-6px_-6px_12px_rgba(255,255,255,0.6)]";
const INSET = "shadow-[inset_4px_4px_8px_rgba(0,0,0,0.06),inset_-4px_-4px_8px_rgba(255,255,255,0.5)]";
const RAISED = "shadow-[3px_3px_6px_rgba(0,0,0,0.06),-3px_-3px_6px_rgba(255,255,255,0.6)]";

function initials(name) {
  return (name || "?").trim().split(/\s+/).slice(-2).map(w => w[0]).join("").toUpperCase();
}

export default function AcademiciansList({ showToast }) {
  const [academicians, setAcademicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  function load() {
    setLoading(true);
    apiFetch("/api/academicians/")
      .then(a => setAcademicians(Array.isArray(a) ? a : []))
      .catch(e => {
        if (e instanceof ApiError && e.status !== 401) showToast?.(e.message, "error");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return academicians;
    return academicians.filter(a =>
      a.full_name.toLowerCase().includes(q) ||
      (a.faculty || "").toLowerCase().includes(q) ||
      (a.department || "").toLowerCase().includes(q)
    );
  }, [academicians, search]);

  async function handleCreate(payload) {
    const created = await apiFetch("/api/academicians/", { method: "POST", body: JSON.stringify(payload) });
    showToast?.(`Akademisyen eklendi: ${created.full_name}`, "success");
    load();
  }

  const content = (
    <div className="flex flex-col w-full gap-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-on-surface-variant">Akademik Portföy</span>
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          </div>
          <h1 className="text-2xl lg:text-3xl font-semibold text-on-surface tracking-tight">Akademisyenler</h1>
          <p className="text-xs lg:text-sm text-on-surface-variant">Sisteme kayıtlı tüm akademisyenler — detay için bir satıra tıklayın.</p>
        </div>
        <button type="button" onClick={() => setCreateOpen(true)}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface text-xs font-semibold text-primary ${RAISED} transition-all self-start`}>
          <PlusCircleIcon className="w-[18px] h-[18px]" />
          <span>Yeni Akademisyen</span>
        </button>
      </div>

      <div className={CARD}>
        <div className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-surface ${INSET}`}>
          <SearchIcon className="text-on-surface-variant w-[18px] h-[18px]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-transparent text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none"
            placeholder="İsim, fakülte veya bölüme göre ara…"
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
          <p className="text-on-surface font-medium">Akademisyen bulunamadı</p>
          <p className="text-on-surface-variant text-sm mt-1">{search ? "Aramanızı değiştirmeyi deneyin." : "Henüz akademisyen eklenmemiş."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(a => (
            <Link key={a.id} to={`/academicians/${a.id}`}
              className={`${CARD} flex flex-col gap-4 hover:text-primary transition-all group`}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                  {initials(a.full_name)}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-on-surface group-hover:text-primary truncate">{a.full_name}</div>
                  {(a.faculty || a.department) && (
                    <div className="text-[11px] text-on-surface-variant truncate">
                      {[a.faculty, a.department].filter(Boolean).join(" • ")}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-on-surface-variant pt-3 border-t border-surface-variant/40">
                <span className="flex items-center gap-1.5">
                  <BankIcon className="w-3.5 h-3.5" />
                  {a.iban ? "IBAN kayıtlı" : "IBAN yok"}
                </span>
                <span className="flex items-center gap-1.5 text-primary font-medium">
                  <SchoolIcon className="w-3.5 h-3.5" />
                  Portföyü Gör
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <EditAcademicianModal open={createOpen} academician={null} onClose={() => setCreateOpen(false)} onSave={handleCreate} />
    </div>
  );

  return <AppShell activePath="akademisyenler">{content}</AppShell>;
}
