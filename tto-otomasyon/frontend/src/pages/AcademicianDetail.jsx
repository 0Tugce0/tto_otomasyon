/**
 * AcademicianDetail.jsx — Akademisyen Portföy Paneli (Stitch tasarımı — modül 4/6)
 *
 * Tasarımdan bilinçli sapmalar (raporda açıklandı, sessizce yapılmadı):
 * - "Sicil: #AK-2041" → gerçek "#{id}" (FirmDetail.jsx'teki "ID #" deseniyle tutarlı).
 * - E-posta, dahili telefon, ofis/oda no, "TTO Danışmanı" rozeti, "Bölüm
 *   Başkanı" gibi unvanlar, banka adı, "%35 Vergi Dilimi", "Aktif
 *   Akademisyen" durumu, "10 Rapor"/"2 Proje" sayaçları — hiçbiri
 *   academicians şemasında YOK, tasarımın kurgusal örnek verisi. Uydurma
 *   değer göstermek yerine kaldırıldı.
 * - "Ödeme Emri Oluştur" butonu YOK — böyle bir belge/iş akışı sistemde
 *   yok (dosya/belge üretimi modül 2'den beri erteleniyor).
 * - "Düzenle" butonu GERÇEK: PUT /api/academicians/{id} zaten vardı,
 *   sadece arayüzü yoktu — şimdi eklendi.
 * - Uyarı bandı, tahsilat oranı donut'u ve 4 özet kart GERÇEK: hepsi
 *   work_records.firm_collection_status (modül 2) + payment_status
 *   üzerinden backend'de SQL SUM() ile hesaplanıyor (routers/academicians.py).
 * - "WR-2025-089" kayıt kodu yerine uygulama genelinde kullanılan
 *   "{yıl}/{sıra no}" formatı korundu.
 * - "Öde" hızlı aksiyonu GERÇEK: PUT /api/records/{id} ile payment_status
 *   "Ödendi" yapar (mevcut endpoint, yeni bir şey icat edilmedi).
 */

import { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";
import AppShell from "../components/AppShell";
import EditAcademicianModal from "../components/EditAcademicianModal";
import {
  ArrowLeftIcon, EditIcon, BankIcon, CopyIcon, WarningIcon, ApartmentIcon,
  WalletIcon, ShieldCheckIcon, PendingIcon, AssignmentIcon, EyeIcon,
  XIcon, ChevronLeftIcon, ChevronRightIcon,
} from "../components/icons";

const CARD = "bg-surface rounded-2xl p-6 shadow-[6px_6px_14px_rgba(0,0,0,0.06),-6px_-6px_14px_rgba(255,255,255,0.7)]";
const INSET = "shadow-[inset_3px_3px_6px_rgba(0,0,0,0.05),inset_-3px_-3px_6px_rgba(255,255,255,0.7)]";
const INSET_SM = "shadow-[inset_2px_2px_5px_rgba(0,0,0,0.04),inset_-2px_-2px_5px_rgba(255,255,255,0.6)]";
const RAISED = "shadow-[5px_5px_10px_rgba(0,0,0,0.06),-5px_-5px_10px_rgba(255,255,255,0.7)]";
const PAGE_SIZE = 5;

function formatTL(v) {
  const n = Number(v);
  if (!isFinite(n)) return "₺0,00";
  return "₺" + n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function initials(name) {
  return (name || "?").trim().split(/\s+/).slice(-2).map(w => w[0]).join("").toUpperCase();
}

export default function AcademicianDetail({ showToast }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState(null);
  const [yearFilter, setYearFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  function load() {
    setLoading(true);
    apiFetch(`/api/academicians/${id}/detail`)
      .then(setDetail)
      .catch(e => {
        const msg = e instanceof ApiError ? e.message : "Yüklenemedi.";
        if (e?.status !== 401) setError(msg);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [id]);

  const years = useMemo(() => {
    if (!detail) return [];
    return [...new Set(detail.work_records.map(r => r.year))].sort((a, b) => b - a);
  }, [detail]);

  const filteredRecords = useMemo(() => {
    if (!detail) return [];
    return detail.work_records.filter(r => {
      if (yearFilter !== "all" && r.year !== yearFilter) return false;
      if (statusFilter !== "all" && r.payment_status !== statusFilter) return false;
      return true;
    });
  }, [detail, yearFilter, statusFilter]);

  const pages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const pageItems = filteredRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function handleSaveEdit(payload) {
    const updated = await apiFetch(`/api/academicians/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    showToast?.("Akademisyen bilgileri güncellendi.", "success");
    setDetail(d => ({ ...d, ...updated }));
  }

  async function handleMarkPaid(record) {
    try {
      await apiFetch(`/api/records/${record.id}`, { method: "PUT", body: JSON.stringify({ payment_status: "Ödendi" }) });
      showToast?.("Kayıt ödendi olarak işaretlendi.", "success");
      load();
    } catch (e) {
      if (e instanceof ApiError && e.status !== 401) showToast?.(e.message, "error");
    }
  }

  async function copyIban(iban) {
    try {
      await navigator.clipboard.writeText(iban.replace(/\s/g, ""));
      showToast?.("IBAN panoya kopyalandı.", "success");
    } catch {
      showToast?.("IBAN kopyalanamadı.", "error");
    }
  }

  if (loading) {
    return (
      <AppShell activePath="akademisyenler">
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell activePath="akademisyenler">
        <div className="flex items-center justify-center py-24">
          <div className="text-center max-w-sm">
            <p className="text-error font-semibold mb-2">Hata</p>
            <p className="text-on-surface-variant text-sm mb-4">{error}</p>
            <Link to="/" className="text-primary hover:underline text-sm">← Kayıtlara dön</Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const { full_name, iban, department, faculty, work_records, summary } = detail;
  const collectionRate = parseFloat(summary.total_invoice_price) > 0
    ? Math.round((parseFloat(summary.total_collected) / parseFloat(summary.total_invoice_price)) * 100)
    : 0;
  const circumference = 251.2;
  const paidCount = work_records.filter(r => r.payment_status === "Ödendi").length;
  const pendingCount = work_records.filter(r => r.payment_status === "Ödenmedi").length;

  const content = (
    <div className="flex flex-col w-full gap-8">
      {/* Başlık */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate("/")}
            className={`w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-on-surface-variant hover:text-primary transition-all ${RAISED}`}>
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">Akademik Portföy / Detay</span>
              <span className="w-1.5 h-1.5 rounded-full bg-outline-variant" />
              <span className="text-[11px] font-medium text-on-surface-variant">Akademisyen #{id}</span>
            </div>
            <h1 className="text-xl font-semibold text-on-surface tracking-tight">Akademisyen Portföy Paneli</h1>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" onClick={() => setEditOpen(true)}
            className={`px-4 py-2.5 rounded-xl bg-surface text-xs font-semibold text-on-surface flex items-center gap-2 ${RAISED} hover:text-primary transition-all`}>
            <EditIcon className="w-[18px] h-[18px]" />
            <span>Düzenle</span>
          </button>
        </div>
      </div>

      {/* Profil + Tahsilat oranı */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className={`lg:col-span-8 ${CARD} flex flex-col justify-between`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pb-6">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-2xl font-bold shadow-[4px_4px_10px_rgba(0,0,0,0.1),-4px_-4px_10px_rgba(255,255,255,0.8)]">
              {initials(full_name)}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold text-on-surface truncate">{full_name}</h2>
              {(faculty || department) && (
                <p className="text-xs font-medium text-on-surface-variant mt-1 leading-relaxed">
                  {[faculty, department].filter(Boolean).join(" • ")}
                </p>
              )}
            </div>
          </div>

          {iban ? (
            <div className={`pt-5 flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl p-4 bg-surface ${INSET}`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl bg-surface flex items-center justify-center text-primary ${RAISED}`}>
                  <BankIcon className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-semibold text-on-surface-variant tracking-wider">Hakediş Banka Hesabı</span>
                  <span className="text-xs font-mono font-medium text-on-surface tracking-wide">{iban}</span>
                </div>
              </div>
              <button type="button" onClick={() => copyIban(iban)}
                className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 self-end md:self-center">
                <CopyIcon className="w-[15px] h-[15px]" />
                <span>Kopyala</span>
              </button>
            </div>
          ) : (
            <div className={`pt-5 rounded-xl p-4 bg-surface ${INSET} text-xs text-on-surface-variant`}>
              IBAN kayıtlı değil.
            </div>
          )}
        </div>

        <div className={`lg:col-span-4 ${CARD} flex flex-col justify-between`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Tahsilat Performansı</span>
          </div>
          <div className="flex items-center justify-center py-2">
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle className="text-surface-variant" fill="none" cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" />
                <circle className="text-primary transition-all duration-1000" fill="none" cx="50" cy="50" r="40" stroke="currentColor"
                  strokeDasharray={circumference} strokeDashoffset={circumference * (1 - collectionRate / 100)}
                  strokeLinecap="round" strokeWidth="8" />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-xl font-bold text-on-surface">%{collectionRate}</span>
                <span className="text-[9px] uppercase tracking-wider text-on-surface-variant">Tahsilat Oranı</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2 text-center">
            <div className={`p-2 rounded-xl bg-surface ${INSET_SM}`}>
              <div className="text-[10px] text-on-surface-variant">Ödenen</div>
              <div className="text-xs font-semibold text-on-surface mt-0.5">{paidCount} Kayıt</div>
            </div>
            <div className={`p-2 rounded-xl bg-surface ${INSET_SM}`}>
              <div className="text-[10px] text-on-surface-variant">Bekleyen</div>
              <div className="text-xs font-semibold text-on-surface mt-0.5">{pendingCount} Kayıt</div>
            </div>
          </div>
        </div>
      </div>

      {/* Uyarı bandı — sadece gerçekten varsa gösterilir */}
      {summary.collected_pending_count > 0 && (
        <div className={`p-4 rounded-2xl bg-surface ${CARD.includes("shadow") ? "" : ""} shadow-[6px_6px_14px_rgba(0,0,0,0.06),-6px_-6px_14px_rgba(255,255,255,0.7)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shadow-[inset_2px_2px_4px_rgba(0,0,0,0.06),inset_-2px_-2px_4px_rgba(255,255,255,0.6)]">
              <WarningIcon className="w-[22px] h-[22px]" />
            </div>
            <div>
              <div className="text-xs font-semibold text-on-surface">Bekleyen Hakediş Uyarısı: Tahsilat Yapılmış İş Bulunuyor</div>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                Fatura tahsilatı yapılmış, ödeme onayı bekleyen {summary.collected_pending_count} kayıt bulunuyor
                ({formatTL(summary.collected_pending_amount)} Net Dağıtım).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Özet Kartlar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard label="Toplam İş Hacmi" value={formatTL(summary.total_invoice_price)} Icon={ApartmentIcon} color="text-primary"
          sub={<><span className="font-semibold text-on-surface">{work_records.length} Kayıt</span> <span>toplam</span></>} />
        <StatCard label="Tahsil Edilen Tutar" value={formatTL(summary.total_collected)} Icon={WalletIcon} color="text-emerald-600"
          sub={<span className="font-medium flex items-center gap-1"><span>%{collectionRate} Tahsilat Oranı</span></span>} />
        <StatCard label="Akademisyene Ödenen" value={formatTL(summary.total_paid)} Icon={ShieldCheckIcon} color="text-tertiary"
          sub="Net Hakediş (Vergi Kesintisi + Diğer Fon Sonrası)" />
        <StatCard label="Ödenmemiş / Bekleyen" value={formatTL(summary.pending_amount)} Icon={PendingIcon} color="text-amber-600"
          sub={<><span className="font-semibold text-on-surface">{summary.pending_count} İşlem</span> <span>ödeme bekliyor</span></>} />
      </div>

      {/* İş Kayıtları */}
      <div className={`${CARD} flex flex-col gap-6`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <AssignmentIcon className="text-primary w-5 h-5" />
              <h3 className="text-base font-semibold text-on-surface">İş ve Hizmet Kayıtları</h3>
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">Bu akademisyene ait tüm sözleşme kapsamındaki iş kayıtları</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className={`flex items-center gap-1 p-1 rounded-xl bg-surface ${INSET}`}>
              <button type="button" onClick={() => { setYearFilter("all"); setPage(1); }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${yearFilter === "all" ? `text-primary bg-surface ${RAISED}` : "text-on-surface-variant hover:text-on-surface"}`}>Tümü</button>
              {years.map(y => (
                <button key={y} type="button" onClick={() => { setYearFilter(y); setPage(1); }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${yearFilter === y ? `text-primary bg-surface ${RAISED}` : "text-on-surface-variant hover:text-on-surface"}`}>{y}</button>
              ))}
            </div>
            <div className={`flex items-center gap-1 p-1 rounded-xl bg-surface ${INSET}`}>
              {["all", "Ödenmedi", "Ödendi"].map(s => (
                <button key={s} type="button" onClick={() => { setStatusFilter(s); setPage(1); }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${statusFilter === s ? `text-primary bg-surface ${RAISED}` : "text-on-surface-variant hover:text-on-surface"}`}>
                  {s === "all" ? "Tümü Durumlar" : s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {pageItems.length === 0 ? (
          <div className="text-center py-10 text-on-surface-variant text-sm">Kayıt yok.</div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[11px] uppercase font-semibold text-on-surface-variant tracking-wider">
                  <th className="pb-3 px-3">İş Tanımı &amp; Kod</th>
                  <th className="pb-3 px-3">Firma</th>
                  <th className="pb-3 px-3 text-right">Fatura Tutarı</th>
                  <th className="pb-3 px-3 text-right">Akademisyen Net</th>
                  <th className="pb-3 px-3">Durum</th>
                  <th className="pb-3 px-3">Tarih</th>
                  <th className="pb-3 px-3 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {pageItems.map(r => {
                  const net = (parseFloat(r.amount_after_withholding) || 0) - (parseFloat(r.other_funds) || 0);
                  const collectedButUnpaid = r.firm_collection_status === "Tahsil Edildi" && r.payment_status === "Ödenmedi";
                  const paid = r.payment_status === "Ödendi";
                  return (
                    <tr key={r.id} className={collectedButUnpaid
                      ? "bg-amber-500/5 shadow-[inset_2px_2px_5px_rgba(245,158,11,0.04),inset_-2px_-2px_5px_rgba(255,255,255,0.6)]"
                      : "hover:bg-surface-bright/40 transition-colors"}>
                      <td className="py-4 px-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl bg-surface flex items-center justify-center ${RAISED} ${collectedButUnpaid ? "text-amber-600" : "text-primary"}`}>
                            <AssignmentIcon className="w-[18px] h-[18px]" />
                          </div>
                          <div>
                            <div className="font-semibold text-on-surface flex items-center gap-2">
                              <span>{r.work_done}</span>
                              {collectedButUnpaid && (
                                <span className="text-[10px] font-bold text-amber-700 px-1.5 py-0.5 rounded bg-amber-500/20">Fatura Tahsil Edildi</span>
                              )}
                            </div>
                            <div className="text-[11px] text-on-surface-variant">Kayıt: #{r.year}/{r.sira_no}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-3"><span className="font-medium text-on-surface">{r.firm?.name ?? "—"}</span></td>
                      <td className="py-4 px-3 text-right font-medium text-on-surface">{formatTL(r.invoice_price)}</td>
                      <td className={`py-4 px-3 text-right font-semibold ${collectedButUnpaid ? "text-amber-700" : "text-primary"}`}>{formatTL(net)}</td>
                      <td className="py-4 px-3">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold ${
                          paid ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/15 text-amber-800"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${paid ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`} />
                          {r.payment_status}
                        </span>
                      </td>
                      <td className="py-4 px-3 text-on-surface-variant font-medium">{r.paid_date ?? r.request_date ?? "—"}</td>
                      <td className="py-4 px-3 text-right">
                        {collectedButUnpaid ? (
                          <button type="button" onClick={() => handleMarkPaid(r)}
                            className="px-3 py-1.5 rounded-xl bg-primary text-on-primary text-[11px] font-semibold shadow-[3px_3px_6px_rgba(99,102,241,0.25)] hover:bg-primary-container transition-all">
                            Öde
                          </button>
                        ) : (
                          <button type="button" onClick={() => setDetailRecord(r)} title="Detay"
                            className={`w-8 h-8 rounded-xl bg-surface inline-flex items-center justify-center text-on-surface-variant hover:text-primary ${RAISED} transition-all`}>
                            <EyeIcon className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3">
          <span className="text-xs text-on-surface-variant">Toplam {filteredRecords.length} kayıt gösteriliyor (Filtrelenmiş)</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className={`w-8 h-8 rounded-xl bg-surface text-on-surface-variant flex items-center justify-center ${RAISED} disabled:opacity-40`}>
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            <span className={`px-3 py-1 rounded-lg text-xs font-semibold bg-surface ${INSET_SM} text-primary`}>{page}</span>
            <button type="button" disabled={page >= pages} onClick={() => setPage(p => p + 1)}
              className={`w-8 h-8 rounded-xl bg-surface text-on-surface-variant flex items-center justify-center ${RAISED} disabled:opacity-40`}>
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Kayıt detay modalı */}
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
              <DetailField label="Proje" value={detailRecord.project?.name ?? "—"} />
              <DetailField label="Yapılan İş" value={detailRecord.work_done} span2 />
              <DetailField label="Fatura Tutarı" value={formatTL(detailRecord.invoice_price)} />
              <DetailField label="KDV" value={formatTL(detailRecord.invoice_vat)} />
              <DetailField label="Tevkifat" value={formatTL(detailRecord.withholding_tax)} />
              <DetailField label="TTO Payı" value={formatTL(detailRecord.tto_share_amount)} />
              <DetailField label="Stopaj Sonrası (Net)" value={formatTL(detailRecord.amount_after_withholding)} />
              <DetailField label="Diğer Fon & Harçlar" value={formatTL(detailRecord.other_funds)} />
              <DetailField label="Firma Tahsilat Durumu" value={detailRecord.firm_collection_status ?? "—"} />
              <DetailField label="Ödeme Durumu" value={detailRecord.payment_status} />
              <DetailField label="Ödeme Tarihi" value={detailRecord.paid_date ?? "—"} />
              <DetailField label="Notlar" value={detailRecord.notes || "—"} span2 />
            </div>
            <div className="flex justify-end pt-2">
              <Link to={`/records/${detailRecord.id}/edit`} className={`px-4 py-2 rounded-xl bg-surface ${RAISED} text-xs font-semibold text-primary`}>
                Düzenle
              </Link>
            </div>
          </div>
        </div>
      )}

      <EditAcademicianModal open={editOpen} academician={detail} onClose={() => setEditOpen(false)} onSave={handleSaveEdit} />
    </div>
  );

  return <AppShell activePath="akademisyenler">{content}</AppShell>;
}

function StatCard({ label, value, sub, Icon, color }) {
  return (
    <div className="p-5 rounded-2xl bg-surface shadow-[6px_6px_12px_rgba(0,0,0,0.06),-6px_-6px_12px_rgba(255,255,255,0.7)] flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">{label}</span>
        <span className={`w-8 h-8 rounded-xl bg-surface shadow-[3px_3px_6px_rgba(0,0,0,0.05),-3px_-3px_6px_rgba(255,255,255,0.7)] flex items-center justify-center ${color}`}>
          <Icon className="w-[18px] h-[18px]" />
        </span>
      </div>
      <div className="mt-4">
        <div className={`text-2xl font-bold tracking-tight ${color === "text-amber-600" ? color : "text-on-surface"}`}>{value}</div>
        <div className="flex items-center gap-1.5 mt-1 text-xs text-on-surface-variant">{sub}</div>
      </div>
    </div>
  );
}

function DetailField({ label, value, span2 }) {
  return (
    <div className={span2 ? "col-span-2" : ""}>
      <div className="text-[10px] uppercase tracking-wide text-on-surface-variant">{label}</div>
      <div className="text-on-surface font-medium mt-0.5">{value ?? "—"}</div>
    </div>
  );
}
