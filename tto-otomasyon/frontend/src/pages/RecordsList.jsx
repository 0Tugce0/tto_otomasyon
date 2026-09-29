/**
 * RecordsList.jsx — İş Kayıtları (Stitch tasarımı — modül 3/6)
 *
 * Tasarımdan bilinçli sapmalar (raporda açıklandı, sessizce yapılmadı):
 * - Kayıt No formatı "#TR-2025-084" yerine mevcut "{yıl}/{sıra no}" formatı
 *   korundu — uygulamanın geri kalanıyla (Ayarlar, Akademisyen/Firma detay)
 *   tutarlı olması için.
 * - Ödeme durumu SADECE "Ödendi" / "Ödenmedi" — "Gecikmede" ve
 *   "Fatura Kesildi" veritabanında karşılığı olmayan, tasarımda icat
 *   edilmiş durumlar; CLAUDE.md'de "Bekliyor" için zaten aynı gerekçeyle
 *   alınmış bir karar var (gerçek Excel verisinde yok).
 * - "Dekont" (makbuz) butonu YOK — sözleşme/dosya özellikleri modül 2'de
 *   ertelenmişti, aynı kararla tutarlı.
 * - "Detay" (👁) butonu zaten yüklü satır verisiyle salt-okunur bir modal açar
 *   (ekstra network isteği yok).
 * - Kullanıcı profil fotoğrafı / "Finans Koordinatörü" rolü yok —
 *   AppShell zaten gerçek kullanıcıyı gösteriyor (modül 1/2 kararı).
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";
import AppShell from "../components/AppShell";
import {
  PlusCircleIcon, DownloadIcon, WalletIcon, ApartmentIcon, ReceiptIcon,
  CalculatorIcon, CoinsIcon, SearchIcon, ChevronDownIcon, XIcon,
  ChevronLeftIcon, ChevronRightIcon, EyeIcon, EditIcon,
} from "../components/icons";

const CARD = "rounded-xl p-5 bg-surface shadow-[6px_6px_12px_rgba(0,0,0,0.08),-6px_-6px_12px_rgba(255,255,255,0.6)]";
const INSET = "shadow-[inset_4px_4px_8px_rgba(0,0,0,0.06),inset_-4px_-4px_8px_rgba(255,255,255,0.5)]";
const INSET_SM = "shadow-[inset_2px_2px_4px_rgba(0,0,0,0.06),inset_-2px_-2px_4px_rgba(255,255,255,0.6)]";
const RAISED = "shadow-[3px_3px_6px_rgba(0,0,0,0.06),-3px_-3px_6px_rgba(255,255,255,0.6)]";

const CURRENT_YEAR = 2026;
const PAGE_SIZE = 25;

function formatTL(v) {
  const n = Number(v);
  if (!isFinite(n)) return "—";
  return "₺" + n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pageList(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, 2, total - 1, total, current - 1, current, current + 1]);
  return [...pages].filter(p => p >= 1 && p <= total).sort((a, b) => a - b);
}

export default function RecordsList({ showToast }) {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [firmId, setFirmId] = useState("");
  const [academicianId, setAcademicianId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [order, setOrder] = useState("desc");
  const [page, setPage] = useState(1);

  const [result, setResult] = useState({ total: 0, pages: 1, items: [] });
  const [summary, setSummary] = useState(null);
  const [firms, setFirms] = useState([]);
  const [academicians, setAcademicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [detailRecord, setDetailRecord] = useState(null);

  // Arama kutusunda yazarken 400ms bekleyip sonra ara (her tuşta istek atmamak için)
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/firms/"),
      apiFetch("/api/academicians/"),
    ]).then(([f, a]) => {
      setFirms(Array.isArray(f) ? f : []);
      setAcademicians(Array.isArray(a) ? a : []);
    }).catch(e => {
      if (e instanceof ApiError && e.status !== 401) showToast?.(e.message, "error");
    });
  }, []);

  const buildParams = useCallback((extra = {}) => {
    const params = new URLSearchParams({ order, ...extra });
    if (year) params.set("year", year);
    if (firmId) params.set("firm_id", firmId);
    if (academicianId) params.set("academician_id", academicianId);
    if (paymentStatus) params.set("payment_status", paymentStatus);
    if (search) params.set("search", search);
    return params;
  }, [year, firmId, academicianId, paymentStatus, search, order]);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildParams({ page, page_size: PAGE_SIZE });
      const [listData, summaryData] = await Promise.all([
        apiFetch(`/api/records/?${params}`),
        apiFetch(`/api/records/summary?${buildParams()}`),
      ]);
      setResult(listData ?? { total: 0, pages: 1, items: [] });
      setSummary(summaryData ?? null);
    } catch (e) {
      if (e instanceof ApiError && e.status !== 401) showToast?.(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [buildParams, page]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  function applyFilter(setter) {
    return (val) => { setter(val); setPage(1); };
  }

  function clearFilters() {
    setYear(""); setFirmId(""); setAcademicianId(""); setPaymentStatus("");
    setSearch(""); setSearchInput(""); setPage(1);
  }

  const activeChips = useMemo(() => {
    const chips = [];
    if (year) chips.push({ key: "year", label: `${year} Dönemi`, clear: () => applyFilter(setYear)("") });
    if (firmId) {
      const f = firms.find(x => String(x.id) === String(firmId));
      chips.push({ key: "firm", label: f?.name ?? "Firma", clear: () => applyFilter(setFirmId)("") });
    }
    if (academicianId) {
      const a = academicians.find(x => String(x.id) === String(academicianId));
      chips.push({ key: "academician", label: a?.full_name ?? "Akademisyen", clear: () => applyFilter(setAcademicianId)("") });
    }
    if (paymentStatus) chips.push({ key: "status", label: paymentStatus, clear: () => applyFilter(setPaymentStatus)("") });
    if (search) chips.push({ key: "search", label: `"${search}"`, clear: () => { setSearch(""); setSearchInput(""); setPage(1); } });
    return chips;
  }, [year, firmId, academicianId, paymentStatus, search, firms, academicians]);

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/records/${deleteTarget.id}`, { method: "DELETE" });
      showToast?.("Kayıt silindi.", "success");
      fetchRecords();
    } catch (e) {
      if (e instanceof ApiError && e.status !== 401) showToast?.(e.message, "error");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const params = buildParams();
      const res = await fetch(`/api/records/export?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Dışa aktarma başarısız.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = year ? `is_kayitlari_${year}.xlsx` : "is_kayitlari.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast?.("Rapor indirildi.", "success");
    } catch (e) {
      showToast?.(e.message || "Dışa aktarma başarısız.", "error");
    } finally {
      setExporting(false);
    }
  }

  const hasActiveFilter = activeChips.length > 0;

  const stats = summary ? [
    { label: "Fatura Tutarı", value: formatTL(summary.total_invoice_price), sub: "KDV Hariç", chip: `${summary.count} Kayıt`, Icon: WalletIcon, color: "text-on-surface" },
    { label: "TTO Payı Tutarı", value: formatTL(summary.total_tto_share_amount), sub: "Kurum Kesintisi", chip: "TTO Payı", Icon: ApartmentIcon, color: "text-tertiary" },
    { label: "Stopaj Tutarı", value: formatTL(summary.total_stopaj), sub: "Yasal Kesinti", chip: "Stopaj", Icon: ReceiptIcon, color: "text-secondary" },
    { label: "KDV Dahil Fatura", value: formatTL(summary.total_invoice_with_vat), sub: "Brüt Tahsilat", chip: "KDV Dahil", Icon: CoinsIcon, color: "text-on-surface" },
    { label: "Tevkifat Tutarı", value: formatTL(summary.total_withholding_tax), sub: "KDV × Tevkifat Oranı", chip: "Tevkifat", Icon: CalculatorIcon, color: "text-primary" },
  ] : [];

  const content = (
    <div className="flex flex-col w-full gap-8">
      {/* Başlık */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-on-surface-variant">Sözleşme &amp; Finans İzleme</span>
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span className="text-[11px] font-medium text-primary">Canlı Güncelleme</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-semibold text-on-surface tracking-tight">Tüm İş Kayıtları ve Ödemeler</h1>
          <p className="text-xs lg:text-sm text-on-surface-variant">Üniversite-Sanayi iş birliği kapsamındaki projeler, TTO kesintileri ve hakediş dağılımları.</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={handleExport} disabled={exporting}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface text-xs font-semibold text-on-surface ${RAISED} transition-all disabled:opacity-50`}>
            <DownloadIcon className="w-[18px] h-[18px] text-secondary" />
            <span>{exporting ? "Hazırlanıyor…" : "Rapor Dışa Aktar"}</span>
          </button>
          <Link to="/records/new"
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface text-xs font-semibold text-primary ${RAISED} transition-all`}>
            <PlusCircleIcon className="w-[18px] h-[18px]" />
            <span>Yeni Kayıt Oluştur</span>
          </Link>
        </div>
      </div>

      {/* Özet Kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {(loading && !summary ? Array.from({ length: 5 }) : stats).map((s, i) => (
          <div key={s?.label ?? i} className={`${CARD} flex flex-col justify-between`}>
            {s ? (
              <>
                <div className="flex items-start justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-on-surface-variant">{s.label}</span>
                    <span className={`text-xl font-semibold mt-1 ${s.color}`}>{s.value}</span>
                  </div>
                  <div className={`w-9 h-9 rounded-xl bg-surface flex items-center justify-center ${INSET_SM} ${s.color}`}>
                    <s.Icon className="w-[18px] h-[18px]" />
                  </div>
                </div>
                <div className="mt-3 pt-2 text-[11px] text-on-surface-variant flex items-center justify-between border-t border-surface-variant/40">
                  <span className="font-medium text-on-surface">{s.sub}</span>
                  <span className={`font-semibold ${s.color}`}>{s.chip}</span>
                </div>
              </>
            ) : (
              <div className="h-16 animate-pulse bg-surface-variant/30 rounded-lg" />
            )}
          </div>
        ))}
      </div>

      {/* Filtreler */}
      <div className={CARD}>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className={`md:col-span-5 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-surface ${INSET}`}>
            <SearchIcon className="text-on-surface-variant w-[18px] h-[18px]" />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="w-full bg-transparent text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none"
              placeholder="İş tanımı, firma veya akademisyen ara…"
            />
          </div>
          <div className="md:col-span-2">
            <div className={`relative w-full rounded-xl bg-surface ${INSET} px-3 py-2 flex items-center justify-between`}>
              <select value={year} onChange={e => applyFilter(setYear)(e.target.value)}
                className="w-full bg-transparent text-xs text-on-surface focus:outline-none appearance-none cursor-pointer pr-4">
                <option value="">Dönem: Tümü</option>
                {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y} Mali Yılı</option>)}
              </select>
              <ChevronDownIcon className="text-on-surface-variant w-4 h-4 pointer-events-none absolute right-2.5" />
            </div>
          </div>
          <div className="md:col-span-2">
            <div className={`relative w-full rounded-xl bg-surface ${INSET} px-3 py-2 flex items-center justify-between`}>
              <select value={firmId} onChange={e => applyFilter(setFirmId)(e.target.value)}
                className="w-full bg-transparent text-xs text-on-surface focus:outline-none appearance-none cursor-pointer pr-4">
                <option value="">Firma: Tümü</option>
                {firms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <ChevronDownIcon className="text-on-surface-variant w-4 h-4 pointer-events-none absolute right-2.5" />
            </div>
          </div>
          <div className="md:col-span-3">
            <div className={`relative w-full rounded-xl bg-surface ${INSET} px-3 py-2 flex items-center justify-between`}>
              <select value={paymentStatus} onChange={e => applyFilter(setPaymentStatus)(e.target.value)}
                className="w-full bg-transparent text-xs text-on-surface focus:outline-none appearance-none cursor-pointer pr-4">
                <option value="">Ödeme Durumu: Tümü</option>
                <option value="Ödendi">Ödendi</option>
                <option value="Ödenmedi">Ödenmedi</option>
              </select>
              <ChevronDownIcon className="text-on-surface-variant w-4 h-4 pointer-events-none absolute right-2.5" />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-on-surface-variant">Aktif Filtreler:</span>
            {activeChips.length === 0 && <span className="text-[11px] text-on-surface-variant/60">Yok</span>}
            {activeChips.map(chip => (
              <span key={chip.key}
                className={`px-2.5 py-1 rounded-lg bg-surface text-[10px] font-medium text-primary ${INSET_SM} flex items-center gap-1.5`}>
                {chip.label}
                <button type="button" onClick={chip.clear} className="hover:text-error">
                  <XIcon className="w-3 h-3" />
                </button>
              </span>
            ))}
            {hasActiveFilter && (
              <button type="button" onClick={clearFilters} className="text-[11px] font-medium text-secondary hover:text-on-surface transition-colors ml-1">
                Filtreleri Temizle
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-on-surface-variant">Sıralama:</span>
            <button type="button" onClick={() => setOrder(o => o === "desc" ? "asc" : "desc")}
              className={`px-3 py-1 rounded-xl bg-surface text-xs font-medium text-on-surface ${RAISED} flex items-center gap-1`}>
              <span>{order === "desc" ? "Tarihe Göre (En Yeni)" : "Tarihe Göre (En Eski)"}</span>
              <ChevronDownIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Tablo */}
      <div className={`rounded-xl bg-surface ${RAISED} overflow-hidden`}>
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-on-surface-variant text-sm">Kayıtlar yükleniyor…</p>
          </div>
        ) : result.items.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-on-surface font-medium">Kayıt bulunamadı</p>
            <p className="text-on-surface-variant text-sm mt-1">
              {hasActiveFilter ? "Filtrelerinizi değiştirmeyi deneyin." : "Henüz iş kaydı eklenmemiş."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant text-[11px] font-semibold uppercase tracking-wider">
                  <th className="py-4 px-4">Kayıt No / Firma &amp; Proje</th>
                  <th className="py-4 px-4 text-right">1. Fatura Tutarı</th>
                  <th className="py-4 px-4 text-right">2. TTO Payı</th>
                  <th className="py-4 px-4 text-right">3. Stopaj Tutarı</th>
                  <th className="py-4 px-4 text-right">4. KDV Dahil Fatura</th>
                  <th className="py-4 px-4 text-right">5. Tevkifat</th>
                  <th className="py-4 px-4 text-center">Durum</th>
                  <th className="py-4 px-4 text-center">İşlem</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {result.items.map(r => {
                  const stopaj = (parseFloat(r.amount_after_tto_share) || 0) - (parseFloat(r.amount_after_withholding) || 0);
                  const kdvDahil = (parseFloat(r.invoice_price) || 0) + (parseFloat(r.invoice_vat) || 0);
                  const paid = r.payment_status === "Ödendi";
                  return (
                    <tr key={r.id} className="hover:bg-surface-bright/50 transition-colors border-b border-surface-variant/30">
                      <td className="py-4 px-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-primary">#{r.year}/{r.sira_no}</span>
                            {r.is_manually_adjusted && <span className="text-yellow-500" title="Elle düzeltilmiş">✎</span>}
                          </div>
                          <Link to={`/firms/${r.firm_id}`} className="font-semibold text-on-surface truncate text-xs mt-0.5 hover:underline">
                            {r.firm?.name ?? `#${r.firm_id}`}
                          </Link>
                          <Link to={`/academicians/${r.academician_id}`} className="text-[10px] text-on-surface-variant truncate hover:underline">
                            {r.academician?.full_name ?? `#${r.academician_id}`}{r.project?.name ? ` • ${r.project.name}` : ""}
                          </Link>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="font-semibold text-on-surface">{formatTL(r.invoice_price)}</span>
                        <span className="block text-[10px] text-on-surface-variant">KDV Hariç</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="font-semibold text-tertiary">{formatTL(r.tto_share_amount)}</span>
                        <span className="block text-[10px] text-secondary">TTO Payı</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="font-semibold text-secondary">{formatTL(stopaj)}</span>
                        <span className="block text-[10px] text-secondary">Stopaj</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="font-semibold text-on-surface">{formatTL(kdvDahil)}</span>
                        <span className="block text-[10px] text-on-surface-variant">KDV Dahil</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="font-semibold text-primary">{formatTL(r.withholding_tax)}</span>
                        <span className="block text-[10px] text-primary">Tevkifat</span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-surface ${INSET_SM} ${paid ? "text-tertiary" : "text-primary"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${paid ? "bg-tertiary" : "bg-primary animate-pulse"}`} />
                          {r.payment_status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button type="button" onClick={() => setDetailRecord(r)} title="Detay"
                            className={`w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-on-surface-variant hover:text-primary ${RAISED} transition-all`}>
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          <Link to={`/records/${r.id}/edit`} title="Düzenle"
                            className={`w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-on-surface-variant hover:text-primary ${RAISED} transition-all`}>
                            <EditIcon className="w-4 h-4" />
                          </Link>
                          <button type="button" onClick={() => setDeleteTarget(r)} title="Sil"
                            className={`w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-on-surface-variant hover:text-error ${RAISED} transition-all`}>
                            <XIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {result.total > 0 && (
          <div className="px-6 py-4 bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-on-surface-variant">
              Toplam <span className="font-semibold text-on-surface">{result.total}</span> kayıttan{" "}
              <span className="font-semibold text-on-surface">{(page - 1) * PAGE_SIZE + 1} - {Math.min(page * PAGE_SIZE, result.total)}</span> arası gösteriliyor
            </div>
            <div className="flex items-center gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className={`w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-on-surface-variant ${RAISED} disabled:opacity-50 disabled:cursor-not-allowed`}>
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              {pageList(page, result.pages).map((p, i, arr) => (
                <span key={p} className="flex items-center gap-2">
                  {i > 0 && arr[i - 1] !== p - 1 && <span className="text-xs text-on-surface-variant px-1">…</span>}
                  <button type="button" onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg bg-surface text-xs flex items-center justify-center transition-all ${
                      p === page ? `text-primary font-semibold ${INSET_SM}` : `text-on-surface-variant hover:text-on-surface font-medium ${RAISED}`
                    }`}>
                    {p}
                  </button>
                </span>
              ))}
              <button type="button" disabled={page >= result.pages} onClick={() => setPage(p => p + 1)}
                className={`w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-on-surface-variant ${RAISED} disabled:opacity-50 disabled:cursor-not-allowed`}>
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detay modalı */}
      {detailRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/20 backdrop-blur-sm p-4" onClick={() => setDetailRecord(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-surface shadow-[10px_10px_30px_rgba(0,0,0,0.12),-10px_-10px_30px_rgba(255,255,255,0.8)] p-6 flex flex-col gap-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-on-surface">Kayıt Detayı — #{detailRecord.year}/{detailRecord.sira_no}</h3>
              <button type="button" onClick={() => setDetailRecord(null)} className={`w-8 h-8 rounded-xl bg-surface ${RAISED} flex items-center justify-center text-on-surface-variant hover:text-on-surface`}>
                <XIcon className="w-[18px] h-[18px]" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <DetailField label="Firma" value={detailRecord.firm?.name} />
              <DetailField label="Akademisyen" value={detailRecord.academician?.full_name} />
              <DetailField label="Proje" value={detailRecord.project?.name ?? "—"} />
              <DetailField label="Yapılan İş" value={detailRecord.work_done} span2 />
              <DetailField label="Fatura Tutarı" value={formatTL(detailRecord.invoice_price)} />
              <DetailField label="KDV" value={formatTL(detailRecord.invoice_vat)} />
              <DetailField label="Tevkifat" value={formatTL(detailRecord.withholding_tax)} />
              <DetailField label="TTO Payı" value={formatTL(detailRecord.tto_share_amount)} />
              <DetailField label="TTO Payı Sonrası" value={formatTL(detailRecord.amount_after_tto_share)} />
              <DetailField label="Stopaj Sonrası (Net)" value={formatTL(detailRecord.amount_after_withholding)} />
              <DetailField label="Diğer Fon & Harçlar" value={formatTL(detailRecord.other_funds)} />
              <DetailField label="Nihai Net Ödeme" value={formatTL(detailRecord.final_net_payable)} />
              <DetailField label="Firma Tahsilat Durumu" value={detailRecord.firm_collection_status ?? "—"} />
              <DetailField label="Ödeme Durumu" value={detailRecord.payment_status} />
              <DetailField label="Talep Tarihi" value={detailRecord.request_date ?? "—"} />
              <DetailField label="Ödeme Tarihi" value={detailRecord.paid_date ?? "—"} />
              <DetailField label="Notlar" value={detailRecord.notes || "—"} span2 />
            </div>
            <div className="flex justify-end pt-2">
              <Link to={`/records/${detailRecord.id}/edit`}
                className={`px-4 py-2 rounded-xl bg-surface ${RAISED} text-xs font-semibold text-primary`}>
                Düzenle
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Silme onay modalı */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-surface shadow-[10px_10px_30px_rgba(0,0,0,0.12),-10px_-10px_30px_rgba(255,255,255,0.8)] p-6 flex flex-col gap-4">
            <h3 className="text-base font-semibold text-on-surface">Kaydı sil</h3>
            <p className="text-on-surface-variant text-sm">
              Bu kaydı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting}
                className={`px-4 py-2 rounded-xl bg-surface ${RAISED} text-xs font-medium text-on-surface-variant hover:text-on-surface disabled:opacity-50`}>
                Vazgeç
              </button>
              <button type="button" onClick={handleConfirmDelete} disabled={deleting}
                className="px-4 py-2 rounded-xl bg-error text-on-error text-xs font-semibold disabled:opacity-50">
                {deleting ? "Siliniyor…" : "Evet, Sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return <AppShell activePath="is-kayitlari">{content}</AppShell>;
}

function DetailField({ label, value, span2 }) {
  return (
    <div className={span2 ? "col-span-2" : ""}>
      <div className="text-[10px] uppercase tracking-wide text-on-surface-variant">{label}</div>
      <div className="text-on-surface font-medium mt-0.5">{value ?? "—"}</div>
    </div>
  );
}
