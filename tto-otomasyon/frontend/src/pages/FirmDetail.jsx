/**
 * FirmDetail.jsx — Firma Portföy & Sözleşme Kartı (Stitch tasarımı — modül 5/6)
 *
 * Tasarımdan bilinçli sapmalar (raporda açıklandı, sessizce yapılmadı):
 * - "Stratejik Partner" rozeti, sektör açıklaması ("Savunma Sanayi &
 *   Otonom Havacılık…"), "Ar-Ge Direktörlüğü (Dr. Can Aksoy)" yetkili
 *   birim bilgisi — firms şemasında YOK, kaldırıldı.
 * - "Aktif TTO Sözleşmesi: 4 Yıl" → GERÇEK "İlişki Süresi" ile değiştirildi
 *   (firms.created_at'tan bu yana geçen süre — uydurma bir sözleşme süresi
 *   değil, sistemde kayıtlı olduğu süre).
 * - Orta bilgi kutusu (fabrikasyon "yetkili birim") → GERÇEK "İlk Kayıt
 *   Tarihi" ile değiştirildi.
 * - "Vadesi 15 gün içinde" / "Vadesi Gelmedi" gibi son ödeme tarihi
 *   ifadeleri YOK — work_records'ta bir "vade" (due date) alanı yok.
 * - "Ort. Hakediş Onay Süresi: 3.2 Gün" → kaldırıldı, güvenilir bir
 *   onay/tahakkuk zaman damgası sistemde yok.
 * - Aylık trend grafiği created_at bazlı (request_date/paid_date çoğu
 *   kayıtta boş olduğundan en güvenilir dolu tarih alanı budur).
 * - "Fatura Durumu" sütunu GERÇEK firm_collection_status (sadece "Tahsil
 *   Edildi"/"Tahsil Edilmedi" — "Vadesi Gelmedi" gibi icat durumlar yok).
 * - "···" (more_vert) menüsü yerine önceki modüllerle tutarlı "Detay" +
 *   "Düzenle" ikonları.
 * - "Cari Hesap Ekstresi Al" GERÇEK: modül 3'teki /api/records/export
 *   endpoint'i firm_id filtresiyle yeniden kullanılıyor.
 * - "Firma Bilgilerini Düzenle" GERÇEK: PUT /api/firms/{id} zaten vardı.
 * - "Bu Firmaya Yeni İş Kaydı Ekle" GERÇEK: RecordForm'a ?firm_id= ile
 *   yönlendirir, firma alanı otomatik seçili gelir.
 */

import { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";
import AppShell from "../components/AppShell";
import QuickAddFirmModal from "../components/QuickAddFirmModal";
import {
  ChevronRightIcon, ReceiptIcon, EditIcon, PlusCircleIcon, ApartmentIcon,
  BankIcon, MailIcon, WalletIcon, GroupIcon, PendingIcon, EyeIcon, XIcon,
} from "../components/icons";

const CARD = "rounded-xl bg-surface shadow-[6px_6px_14px_rgba(0,0,0,0.07),-6px_-6px_14px_rgba(255,255,255,0.7)]";
const INSET = "shadow-[inset_3px_3px_6px_rgba(0,0,0,0.05),inset_-3px_-3px_6px_rgba(255,255,255,0.6)]";
const INSET_SM = "shadow-[inset_2px_2px_4px_rgba(0,0,0,0.06),inset_-2px_-2px_4px_rgba(255,255,255,0.7)]";
const RAISED = "shadow-[5px_5px_10px_rgba(0,0,0,0.06),-5px_-5px_10px_rgba(255,255,255,0.7)]";
const PAGE_SIZE = 5;

function formatTL(v) {
  const n = Number(v);
  if (!isFinite(n)) return "₺0,00";
  return "₺" + n.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function initials(name) {
  return (name || "?").trim().split(/\s+/).slice(-2).map(w => w[0]).join("").toUpperCase();
}

function relationshipDuration(createdAt) {
  if (!createdAt) return null;
  const months = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
  if (months < 1) return "Bu ay eklendi";
  if (months < 12) return `${months} Ay`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years} Yıl ${rem} Ay` : `${years} Yıl`;
}

const MONTH_LABELS = { "01": "Oca", "02": "Şub", "03": "Mar", "04": "Nis", "05": "May", "06": "Haz", "07": "Tem", "08": "Ağu", "09": "Eyl", "10": "Eki", "11": "Kas", "12": "Ara" };

export default function FirmDetail({ showToast }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [detailRecord, setDetailRecord] = useState(null);
  const [page, setPage] = useState(1);

  function load() {
    setLoading(true);
    apiFetch(`/api/firms/${id}/detail`)
      .then(setDetail)
      .catch(e => {
        const msg = e instanceof ApiError ? e.message : "Yüklenemedi.";
        if (e?.status !== 401) setError(msg);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [id]);

  const pages = detail ? Math.max(1, Math.ceil(detail.work_records.length / PAGE_SIZE)) : 1;
  const pageItems = detail ? detail.work_records.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : [];

  async function handleSaveEdit(payload) {
    const updated = await apiFetch(`/api/firms/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    showToast?.("Firma bilgileri güncellendi.", "success");
    setDetail(d => ({ ...d, ...updated }));
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch(`/api/records/export?firm_id=${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Dışa aktarma başarısız.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cari_hesap_${detail?.name?.replace(/\s+/g, "_") ?? id}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast?.("Cari hesap ekstresi indirildi.", "success");
    } catch (e) {
      showToast?.(e.message || "Dışa aktarma başarısız.", "error");
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <AppShell activePath="firmalar">
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell activePath="firmalar">
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

  const { name, tax_no, tax_office, contact_email, created_at, summary, work_records } = detail;
  const ttoPct = parseFloat(summary.total_invoice_price) > 0
    ? Math.round((parseFloat(summary.total_tto_share_amount) / parseFloat(summary.total_invoice_price)) * 100)
    : 0;
  const academicianPct = 100 - ttoPct;
  const circumference = 100;
  const maxMonthly = Math.max(1, ...summary.monthly_trend.map(m => parseFloat(m.total)));

  const content = (
    <div className="flex flex-col w-full gap-8">
      {/* Breadcrumb + aksiyonlar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-on-surface-variant">
          <Link to="/firms" className="hover:text-primary transition-colors">Firmalar</Link>
          <ChevronRightIcon className="w-4 h-4" />
          <span className="font-medium text-on-surface">Firma Portföy &amp; Sözleşme Kartı</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" onClick={handleExport} disabled={exporting}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface text-xs font-semibold text-on-surface ${RAISED} hover:text-primary transition-all disabled:opacity-50`}>
            <ReceiptIcon className="w-[18px] h-[18px]" />
            <span>{exporting ? "Hazırlanıyor…" : "Cari Hesap Ekstresi Al"}</span>
          </button>
          <button type="button" onClick={() => setEditOpen(true)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface text-xs font-semibold text-on-surface ${RAISED} hover:text-primary transition-all`}>
            <EditIcon className="w-[18px] h-[18px]" />
            <span>Firma Bilgilerini Düzenle</span>
          </button>
          <button type="button" onClick={() => navigate(`/records/new?firm_id=${id}`)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface text-xs font-semibold text-primary ${RAISED} transition-all`}>
            <PlusCircleIcon className="w-[18px] h-[18px]" />
            <span>Bu Firmaya Yeni İş Kaydı Ekle</span>
          </button>
        </div>
      </div>

      {/* Firma başlık kartı */}
      <div className={`p-6 md:p-8 ${CARD} flex flex-col gap-6`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start md:items-center gap-5">
            <div className={`w-16 h-16 rounded-xl bg-surface flex items-center justify-center shrink-0 ${INSET} text-primary`}>
              <ApartmentIcon className="w-8 h-8" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-on-surface">{name}</h1>
              {summary.record_count > 0 && (
                <p className="text-xs text-on-surface-variant mt-1">{summary.record_count} iş kaydı üzerinden portföy özeti</p>
              )}
            </div>
          </div>
          {relationshipDuration(created_at) && (
            <div className="flex items-center gap-2 self-start lg:self-center">
              <div className={`flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface ${INSET_SM} text-xs text-on-surface-variant`}>
                <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                <span>İlişki Süresi: <strong>{relationshipDuration(created_at)}</strong></span>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
          <InfoTile Icon={BankIcon} label="Vergi Dairesi & No"
            value={tax_office || tax_no ? [tax_office, tax_no].filter(Boolean).join(" • ") : "Kayıtlı değil"} />
          <InfoTile Icon={ReceiptIcon} label="İlk Kayıt Tarihi"
            value={summary.first_record_at ? new Date(summary.first_record_at).toLocaleDateString("tr-TR") : "—"} />
          <InfoTile Icon={MailIcon} label="Resmi E-Posta" value={contact_email || "Kayıtlı değil"} />
        </div>
      </div>

      {/* Özet Kartlar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Toplam Sözleşme" value={formatTL(summary.total_invoice_price)} Icon={WalletIcon} color="text-primary"
          sub={<><span className="text-primary font-semibold">• {summary.record_count} Kayıt</span> <span>(Kümülatif)</span></>} />
        <StatCard label="Danışman Havuzu" value={`${summary.distinct_academician_count} Danışman`} Icon={GroupIcon} color="text-primary"
          sub={summary.distinct_department_count > 0 ? `${summary.distinct_department_count} Farklı Bölüm` : "Bölüm bilgisi yok"} />
        <StatCard label="Açık Fatura Bakiyesi" value={formatTL(summary.open_balance)} Icon={PendingIcon}
          color={parseFloat(summary.open_balance) > 0 ? "text-error" : "text-on-surface"}
          sub={parseFloat(summary.open_balance) > 0 ? "Ödenmemiş kayıtlar var" : "Bekleyen bakiye yok"} />
        <StatCard label="Proje Çeşitliliği" value={`${summary.distinct_project_count} Proje`} Icon={ApartmentIcon} color="text-primary"
          sub="Farklı proje kapsamı" />
      </div>

      {/* Dağılım + Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`p-6 ${CARD} flex flex-col justify-between`}>
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-on-surface uppercase mb-4">Hakediş &amp; TTO Dağılımı</h2>
            <div className="flex items-center justify-center py-2">
              <div className="relative flex items-center justify-center">
                <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 36 36">
                  <path className="text-surface-container stroke-current" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeWidth="3.5" />
                  <path className="text-primary stroke-current" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none"
                    strokeDasharray={`${academicianPct}, ${circumference}`} strokeLinecap="round" strokeWidth="3.5" />
                  <path className="text-tertiary stroke-current" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none"
                    strokeDasharray={`${ttoPct}, ${circumference}`} strokeDashoffset={-academicianPct} strokeLinecap="round" strokeWidth="3.5" />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-lg font-bold text-on-surface">%{ttoPct}</span>
                  <span className="text-[10px] text-on-surface-variant font-medium">TTO Payı</span>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-3">
            <div className={`p-3 rounded-lg bg-surface ${INSET_SM} flex flex-col`}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-[11px] text-on-surface-variant">Akademisyen Hakedişi</span>
              </div>
              <span className="text-xs font-bold text-on-surface">{formatTL(summary.total_academician_gross)} (%{academicianPct})</span>
            </div>
            <div className={`p-3 rounded-lg bg-surface ${INSET_SM} flex flex-col`}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-tertiary" />
                <span className="text-[11px] text-on-surface-variant">TTO Kurum Kesintisi</span>
              </div>
              <span className="text-xs font-bold text-on-surface">{formatTL(summary.total_tto_share_amount)} (%{ttoPct})</span>
            </div>
          </div>
        </div>

        <div className={`lg:col-span-2 p-6 ${CARD} flex flex-col justify-between`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col">
              <h2 className="text-sm font-semibold tracking-wide text-on-surface uppercase">Aylık Fatura Trendi</h2>
              <span className="text-xs text-on-surface-variant">Kayıt oluşturulma tarihine göre son {summary.monthly_trend.length || 0} ay</span>
            </div>
          </div>
          {summary.monthly_trend.length === 0 ? (
            <div className="text-center py-10 text-on-surface-variant text-sm">Henüz veri yok.</div>
          ) : (
            <div className="h-36 w-full flex items-end justify-between gap-4 px-2 pt-4">
              {summary.monthly_trend.map((m, i) => {
                const [, mm] = m.month.split("-");
                const pct = Math.round((parseFloat(m.total) / maxMonthly) * 100);
                const isLast = i === summary.monthly_trend.length - 1;
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-2">
                    <div className={`w-full bg-surface-container rounded-t-lg relative flex items-end h-28 p-1 ${INSET_SM}`} title={formatTL(m.total)}>
                      <div className={`w-full rounded-t ${isLast ? "bg-primary shadow-[2px_2px_6px_rgba(99,102,241,0.3)]" : "bg-primary/50"}`} style={{ height: `${Math.max(pct, 4)}%` }} />
                    </div>
                    <span className={`text-[11px] ${isLast ? "font-semibold text-primary" : "text-on-surface-variant"}`}>{MONTH_LABELS[mm] ?? mm}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* İş kayıtları tablosu */}
      <div className={`p-6 md:p-8 ${CARD} flex flex-col gap-6`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-on-surface">Firmayla Yapılan Tüm İşler Listesi</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">Danışman atamaları ve hakediş/tahsilat durumu</p>
          </div>
        </div>

        {pageItems.length === 0 ? (
          <div className="text-center py-10 text-on-surface-variant text-sm">Bu firmaya ait kayıt yok.</div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left text-xs text-on-surface border-separate border-spacing-y-3">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold">
                  <th className="px-4 py-2">Kayıt No</th>
                  <th className="px-4 py-2">İş / Proje Tanımı</th>
                  <th className="px-4 py-2">Danışman Akademisyen</th>
                  <th className="px-4 py-2">Fatura Tutarı</th>
                  <th className="px-4 py-2">TTO Payı</th>
                  <th className="px-4 py-2">Fatura Durumu</th>
                  <th className="px-4 py-2">Ödeme Durumu</th>
                  <th className="px-4 py-2 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map(r => {
                  const collected = r.firm_collection_status === "Tahsil Edildi";
                  const paid = r.payment_status === "Ödendi";
                  return (
                    <tr key={r.id} className={`group rounded-xl bg-surface ${RAISED} hover:shadow-[6px_6px_12px_rgba(0,0,0,0.08),-6px_-6px_12px_rgba(255,255,255,0.7)] transition-all`}>
                      <td className="px-4 py-4 rounded-l-xl font-bold text-primary whitespace-nowrap">#{r.year}/{r.sira_no}</td>
                      <td className="px-4 py-4 min-w-[220px]">
                        <div className="flex flex-col">
                          <span className="font-semibold text-on-surface leading-tight">{r.work_done || "—"}</span>
                          {r.project?.name && <span className="text-[10px] text-on-surface-variant mt-0.5">{r.project.name}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full bg-surface ${INSET_SM} flex items-center justify-center text-[10px] text-primary font-bold`}>
                            {initials(r.academician?.full_name)}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium text-on-surface">{r.academician?.full_name ?? "—"}</span>
                            {r.academician?.department && <span className="text-[10px] text-on-surface-variant">{r.academician.department}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-bold text-on-surface whitespace-nowrap">{formatTL(r.invoice_price)}</td>
                      <td className="px-4 py-4 font-medium text-tertiary whitespace-nowrap">{formatTL(r.tto_share_amount)}</td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-surface ${INSET_SM} ${collected ? "text-primary" : "text-on-surface-variant"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${collected ? "bg-primary" : "bg-on-surface-variant"}`} />
                          {r.firm_collection_status ?? "Bilinmiyor"}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-surface ${RAISED} ${paid ? "text-emerald-700" : "text-on-surface-variant"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${paid ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`} />
                          {r.payment_status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right rounded-r-xl whitespace-nowrap">
                        <button type="button" onClick={() => setDetailRecord(r)} title="Detay"
                          className={`w-8 h-8 rounded-lg bg-surface inline-flex items-center justify-center text-on-surface-variant hover:text-primary ${RAISED} transition-all`}>
                          <EyeIcon className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <span className="text-xs text-on-surface-variant">Toplam {work_records.length} kayıt gösteriliyor</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className={`px-3 py-1.5 rounded-lg bg-surface text-xs font-medium text-on-surface-variant ${RAISED} disabled:opacity-40 transition-all`}>Önceki</button>
            <span className={`px-3 py-1.5 rounded-lg bg-surface text-xs font-semibold text-primary ${INSET_SM}`}>{page}</span>
            <button type="button" disabled={page >= pages} onClick={() => setPage(p => p + 1)}
              className={`px-3 py-1.5 rounded-lg bg-surface text-xs font-medium text-on-surface-variant ${RAISED} disabled:opacity-40 transition-all`}>Sonraki</button>
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
              <DetailField label="Akademisyen" value={detailRecord.academician?.full_name} />
              <DetailField label="Proje" value={detailRecord.project?.name ?? "—"} />
              <DetailField label="Yapılan İş" value={detailRecord.work_done} span2 />
              <DetailField label="Fatura Tutarı" value={formatTL(detailRecord.invoice_price)} />
              <DetailField label="TTO Payı" value={formatTL(detailRecord.tto_share_amount)} />
              <DetailField label="Akademisyene Net" value={formatTL(detailRecord.amount_after_withholding)} />
              <DetailField label="Diğer Fon & Harçlar" value={formatTL(detailRecord.other_funds)} />
              <DetailField label="Firma Tahsilat Durumu" value={detailRecord.firm_collection_status ?? "—"} />
              <DetailField label="Ödeme Durumu" value={detailRecord.payment_status} />
              <DetailField label="Ödeme Tarihi" value={detailRecord.paid_date ?? "—"} />
            </div>
            <div className="flex justify-end pt-2">
              <Link to={`/records/${detailRecord.id}/edit`} className={`px-4 py-2 rounded-xl bg-surface ${RAISED} text-xs font-semibold text-primary`}>
                Düzenle
              </Link>
            </div>
          </div>
        </div>
      )}

      <QuickAddFirmModal open={editOpen} firm={detail} onClose={() => setEditOpen(false)} onSave={handleSaveEdit} />
    </div>
  );

  return <AppShell activePath="firmalar">{content}</AppShell>;
}

function InfoTile({ Icon, label, value }) {
  return (
    <div className={`p-4 rounded-xl bg-surface ${INSET} flex items-center gap-3`}>
      <div className={`w-9 h-9 rounded-lg bg-surface flex items-center justify-center text-primary ${RAISED}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">{label}</span>
        <span className="text-xs font-semibold text-on-surface truncate">{value}</span>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, Icon, color }) {
  return (
    <div className={`p-5 rounded-xl bg-surface shadow-[6px_6px_12px_rgba(0,0,0,0.07),-6px_-6px_12px_rgba(255,255,255,0.7)] flex flex-col justify-between`}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">{label}</span>
        <div className={`w-8 h-8 rounded-lg bg-surface flex items-center justify-center ${INSET_SM} ${color}`}>
          <Icon className="w-[18px] h-[18px]" />
        </div>
      </div>
      <div>
        <span className={`text-2xl font-bold tracking-tight ${color}`}>{value}</span>
        <div className="flex items-center gap-1.5 mt-2 text-[11px] text-on-surface-variant">{sub}</div>
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
