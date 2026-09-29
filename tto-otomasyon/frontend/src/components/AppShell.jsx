/**
 * AppShell.jsx — Sidebar + header uygulama kabuğu (Stitch tasarımı — modül 2).
 *
 * "Yeni Kayıt Ekle" modülüyle birlikte geldi; ileride diğer modüller
 * (İş Kayıtları, Akademisyenler, Firmalar, Ayarlar) geldikçe o sayfalar da
 * bu kabuğa taşınacak, kendi eski navbar'ları kaldırılacak.
 *
 * Notlar (tasarımdan bilinçli sapmalar — sessizce yapılmadı, modül 2
 * raporunda açıklandı):
 *   - "Elif Yılmaz / TTO Yönetici" sabit kodlanmış kullanıcı bilgisi yerine
 *     GET /api/auth/me'den gelen gerçek kullanıcı gösterilir.
 *   - Çıkış (logout) butonu eklendi — Stitch tasarımında yoktu ama var olan
 *     bir özellik, kaldırılmadı.
 *   - Akademisyenler ve Firmalar artık ikisi de gerçek liste sayfalarına
 *     bağlı (AcademiciansList.jsx, FirmsList.jsx) — "Yakında" etiketi kalktı.
 *   - Arama kutusu ve "Dönem" seçici şimdilik görsel/etkisiz (henüz hangi
 *     modülün bu işlevleri üstleneceği netleşmedi).
 */

import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import {
  ListIcon, PlusCircleIcon, SchoolIcon, ApartmentIcon, TuneIcon,
  SearchIcon, CalendarIcon, ChevronDownIcon, BellIcon, ShieldCheckIcon,
} from "./icons";

const RAISED = "shadow-[4px_4px_10px_rgba(0,0,0,0.04),-4px_-4px_10px_rgba(255,255,255,0.6)]";
const INSET = "shadow-[inset_4px_4px_8px_rgba(0,0,0,0.06),inset_-4px_-4px_8px_rgba(255,255,255,0.7)]";

const NAV_ITEMS = [
  { path: "is-kayitlari", label: "İş Kayıtları", to: "/", Icon: ListIcon },
  { path: "yeni-kayit-ekle", label: "Yeni Kayıt Ekle", to: "/records/new", Icon: PlusCircleIcon },
  { path: "akademisyenler", label: "Akademisyenler", to: "/academicians", Icon: SchoolIcon },
  { path: "firmalar", label: "Firmalar", to: "/firms", Icon: ApartmentIcon },
  { path: "ayarlar", label: "Ayarlar", to: "/settings", Icon: TuneIcon },
];

export default function AppShell({ activePath, children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);

  useEffect(() => {
    apiFetch("/api/auth/me").then(setUser).catch(() => {});
  }, []);

  async function handleLogout() {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      navigate("/login", { replace: true });
    }
  }

  const resolvedActive = activePath ?? NAV_ITEMS.find((i) => i.to === location.pathname)?.path;

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-72 bg-surface z-50 flex flex-col p-6 shadow-[6px_0_16px_rgba(0,0,0,0.04),-2px_0_8px_rgba(255,255,255,0.7)]">
        <div className="flex items-center gap-3 px-2 mb-10">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <ShieldCheckIcon className="w-4 h-4 text-on-primary" />
          </div>
          <span className="font-semibold text-on-surface text-sm">TTO Otomasyonu</span>
        </div>

        <div className="mb-6 px-2">
          <span className="text-[11px] font-semibold tracking-wider uppercase text-on-surface-variant">Ana Menü</span>
        </div>

        <nav className="flex-1 flex flex-col gap-3">
          {NAV_ITEMS.map(({ path, label, to, Icon }) => {
            const active = resolvedActive === path;
            if (!to) {
              return (
                <div key={path}
                  className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-on-surface-variant/50 cursor-not-allowed">
                  <span className="flex items-center gap-3">
                    <Icon className="w-5 h-5" />
                    <span className="text-sm">{label}</span>
                  </span>
                  <span className="text-[9px] font-semibold uppercase tracking-wide bg-surface-variant text-on-surface-variant px-1.5 py-0.5 rounded">Yakında</span>
                </div>
              );
            }
            return (
              <Link key={path} to={to}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  active ? `${INSET} text-primary font-semibold` : `text-on-surface-variant hover:text-on-surface ${RAISED}`
                }`}>
                <Icon className="w-5 h-5" />
                <span className="text-sm">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={`mt-auto p-4 rounded-xl bg-surface ${INSET}`}>
          <div className="flex items-center gap-3">
            <ShieldCheckIcon className="text-primary w-[22px] h-[22px]" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-on-surface">TTO Otomasyonu</span>
              <span className="text-[10px] text-on-surface-variant">v1.0 · Aktif</span>
            </div>
          </div>
        </div>
      </aside>

      {/* İçerik */}
      <div className="pl-72">
        <header className="fixed top-0 left-72 right-0 h-20 bg-surface z-40 flex items-center justify-between px-8 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
          <div className="flex items-center gap-4 w-96">
            <div className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-surface ${INSET}`}>
              <SearchIcon className="text-on-surface-variant w-[18px] h-[18px]" />
              <input
                className="w-full bg-transparent text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none"
                placeholder="Kayıt, akademisyen veya firma ara…"
                disabled
                title="Arama, İş Kayıtları modülü eklenince aktif olacak"
              />
            </div>
          </div>
          <div className="flex items-center gap-5">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface ${RAISED} text-xs text-on-surface`}>
              <CalendarIcon className="text-primary w-[18px] h-[18px]" />
              <span className="font-medium">Dönem: 2026 / 2027</span>
              <ChevronDownIcon className="text-on-surface-variant w-4 h-4" />
            </div>
            <button type="button" disabled
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-on-surface-variant/60 bg-surface ${RAISED} cursor-not-allowed`}
              title="Bildirimler henüz aktif değil">
              <BellIcon className="w-5 h-5" />
            </button>
            <div className="h-6 w-px bg-surface-variant" />
            <div className="flex items-center gap-3 pl-1">
              <div className="flex flex-col text-right">
                <span className="text-xs font-semibold text-on-surface">{user?.full_name ?? "…"}</span>
                <span className="text-[11px] text-on-surface-variant">{user?.username ?? ""}</span>
              </div>
              <button type="button" onClick={handleLogout} title="Çıkış Yap"
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-on-surface-variant hover:text-error transition-colors bg-surface ${RAISED}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0110.5 3h6a2.25 2.25 0 012.25 2.25v13.5A2.25 2.25 0 0116.5 21h-6a2.25 2.25 0 01-2.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        <main className="relative w-full pt-20 bg-surface min-h-screen px-8 pb-12">
          {children}
        </main>
      </div>
    </div>
  );
}
