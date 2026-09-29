/**
 * RecordForm.jsx — Yeni / Düzenle formu (Stitch tasarımı — modül 2/6)
 *
 * Tasarım notları (kullanıcıyla netleştirildi):
 * - Mevcut 5 adımlık hesaplama zinciri (core/calculations.py, Excel'den
 *   doğrulanmış) AYNEN korunuyor. "Diğer Fon & Harçlar" bunun üstüne
 *   eklenen opsiyonel, ayrı bir 6. kesinti (bkz. final_net_payable).
 * - Sözleşme dosyası yükleme bu modülde YOK — sonraki bir işe ertelendi.
 * - "İki aşamalı ödeme akışı": 1. aşama (Firma → TTO) YENİ alan
 *   (firm_collection_status). 2. aşama (TTO → Akademisyen) zaten var olan
 *   payment_status alanı ile temsil ediliyor — ayrı bir alan icat edilmedi.
 * - TTO payı / stopaj oranlarının "override" edilmesi, tasarımdaki ayrı
 *   checkbox'lar yerine formun zaten var olan tek global
 *   is_manually_adjusted mekanizmasıyla yapılıyor (B-8 kararıyla tutarlı).
 * - KDV oranı halen `settings` tablosundan (yıl bazlı) geliyor; formda
 *   serbest bir KDV seçici YOK — is_manually_adjusted açıkken diğer
 *   hesaplanan alanlar gibi elle değiştirilebilir.
 * - "Yönetim onayına sunuldu" gibi var olmayan bir onay iş akışı iddia
 *   edilmiyor; kayıt doğrudan oluşturulur (uygulamanın gerçek davranışı).
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";
import AppShell from "../components/AppShell";
import SearchableCreatableSelect from "../components/SearchableCreatableSelect";
import QuickAddFirmModal from "../components/QuickAddFirmModal";
import {
  PlusCircleIcon, GroupIcon, DocumentIcon, CalculatorIcon, ReceiptIcon,
  FlowIcon, InfoIcon, BankIcon, CopyIcon, RestartIcon,
} from "../components/icons";

const CARD = "rounded-2xl p-6 lg:p-7 bg-surface shadow-[6px_6px_16px_rgba(0,0,0,0.06),-6px_-6px_16px_rgba(255,255,255,0.7)] flex flex-col gap-6";
const INSET = "shadow-[inset_3px_3px_6px_rgba(0,0,0,0.06),inset_-3px_-3px_6px_rgba(255,255,255,0.6)]";
const INSET_SM = "shadow-[inset_2px_2px_4px_rgba(0,0,0,0.05),inset_-2px_-2px_4px_rgba(255,255,255,0.6)]";
const RAISED = "shadow-[4px_4px_10px_rgba(0,0,0,0.04),-4px_-4px_10px_rgba(255,255,255,0.6)]";

const CALC_FIELDS = [
  { key: "invoice_vat",             label: "Fatura KDV" },
  { key: "withholding_tax",         label: "Tevkifat" },
  { key: "tto_share_amount",        label: "TTO Payı (TL)" },
  { key: "amount_after_tto_share",  label: "TTO Payı Sonrası" },
  { key: "amount_after_withholding",label: "Akademisyene Net (Diğer Fon Öncesi)" },
];

const EMPTY_FORM = {
  year: 2026,
  firm_id: "", academician_id: "", project_id: "",
  work_done: "",
  request_date: "",
  invoice_price: "",
  invoice_vat: "", withholding_tax: "", tto_share_amount: "",
  amount_after_tto_share: "", amount_after_withholding: "",
  other_funds: "0",
  firm_collection_status: "Tahsil Edildi",
  payment_status: "Ödenmedi",
  paid_date: "", iban_snapshot: "", notes: "",
  is_manually_adjusted: false,
};

function formatTL(v) {
  const n = Number(v);
  if (!isFinite(n)) return "₺0,00";
  return "₺" + n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function RecordForm({ showToast }) {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // "Bu Firmaya Yeni İş Kaydı Ekle" (FirmDetail.jsx — modül 5) buradan gelir.
  const prefillFirmId = !isEdit ? searchParams.get("firm_id") : null;

  const [form, setForm] = useState(() => prefillFirmId ? { ...EMPTY_FORM, firm_id: prefillFirmId } : EMPTY_FORM);
  const [firms, setFirms] = useState([]);
  const [academicians, setAcademicians] = useState([]);
  const [projects, setProjects] = useState([]);
  const [pageLoading, setPageLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcError, setCalcError] = useState("");
  const [firmModalOpen, setFirmModalOpen] = useState(false);

  // Dropdown'lar
  useEffect(() => {
    Promise.all([
      apiFetch("/api/firms/"),
      apiFetch("/api/academicians/"),
      apiFetch("/api/projects/"),
    ]).then(([f, a, p]) => {
      setFirms(Array.isArray(f) ? f : []);
      setAcademicians(Array.isArray(a) ? a : []);
      setProjects(Array.isArray(p) ? p : []);
    }).catch(e => {
      if (e instanceof ApiError && e.status !== 401) showToast?.(e.message, "error");
    });
  }, []);

  // Düzenleme: mevcut kayıt
  useEffect(() => {
    if (!isEdit) return;
    setPageLoading(true);
    apiFetch(`/api/records/${id}`)
      .then(d => setForm({
        year: d.year,
        firm_id: d.firm_id,
        academician_id: d.academician_id,
        project_id: d.project_id ?? "",
        work_done: d.work_done ?? "",
        request_date: d.request_date ?? "",
        invoice_price: d.invoice_price ?? "",
        invoice_vat: d.invoice_vat ?? "",
        withholding_tax: d.withholding_tax ?? "",
        tto_share_amount: d.tto_share_amount ?? "",
        amount_after_tto_share: d.amount_after_tto_share ?? "",
        amount_after_withholding: d.amount_after_withholding ?? "",
        other_funds: d.other_funds ?? "0",
        firm_collection_status: d.firm_collection_status ?? "Tahsil Edildi",
        payment_status: d.payment_status,
        paid_date: d.paid_date ?? "",
        iban_snapshot: d.iban_snapshot ?? "",
        notes: d.notes ?? "",
        is_manually_adjusted: d.is_manually_adjusted,
      }))
      .catch(e => {
        if (e instanceof ApiError && e.status !== 401) showToast?.(e.message, "error");
      })
      .finally(() => setPageLoading(false));
  }, [id, isEdit]);

  // Preview-calculation onBlur
  const fetchPreview = useCallback(async () => {
    const price = parseFloat(form.invoice_price);
    if (!price || price <= 0 || form.is_manually_adjusted || !form.year) return;
    setCalcLoading(true);
    setCalcError("");
    try {
      const data = await apiFetch("/api/records/preview-calculation", {
        method: "POST",
        body: JSON.stringify({
          year: parseInt(form.year),
          invoice_price: form.invoice_price,
          other_funds: form.other_funds || "0",
        }),
      });
      setForm(f => ({
        ...f,
        invoice_vat: data.invoice_vat,
        withholding_tax: data.withholding_tax,
        tto_share_amount: data.tto_share_amount,
        amount_after_tto_share: data.amount_after_tto_share,
        amount_after_withholding: data.amount_after_withholding,
      }));
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Hesaplama yapılamadı.";
      setCalcError(msg);
    } finally {
      setCalcLoading(false);
    }
  }, [form.invoice_price, form.year, form.is_manually_adjusted]);

  async function createFirm(name) {
    const created = await apiFetch("/api/firms/", { method: "POST", body: JSON.stringify({ name }) });
    setFirms(f => [...f, created]);
    return { id: created.id, label: created.name };
  }

  async function handleQuickAddFirm(payload) {
    const created = await apiFetch("/api/firms/", { method: "POST", body: JSON.stringify(payload) });
    setFirms(f => [...f, created]);
    setForm(f => ({ ...f, firm_id: created.id }));
    showToast?.(`Yeni firma kaydedildi ve seçildi: ${created.name}`, "success");
  }

  async function createAcademician(name) {
    const created = await apiFetch("/api/academicians/", {
      method: "POST",
      body: JSON.stringify({ full_name: name }),
    });
    setAcademicians(a => [...a, created]);
    return { id: created.id, label: created.full_name };
  }

  async function createProject(name) {
    const created = await apiFetch("/api/projects/", { method: "POST", body: JSON.stringify({ name }) });
    setProjects(p => [...p, created]);
    return { id: created.id, label: created.name };
  }

  function handleCalcFieldChange(field, value) {
    setForm(f => ({ ...f, [field]: value, is_manually_adjusted: true }));
  }

  function resetManual() {
    setForm(f => ({
      ...f, is_manually_adjusted: false,
      invoice_vat: "", withholding_tax: "", tto_share_amount: "",
      amount_after_tto_share: "", amount_after_withholding: "",
    }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setCalcError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;
    if (!form.firm_id || !form.academician_id) {
      showToast?.("Lütfen firma ve akademisyen seçin.", "error");
      return;
    }
    setSaving(true);
    const body = {
      year: parseInt(form.year),
      firm_id: parseInt(form.firm_id),
      academician_id: parseInt(form.academician_id),
      project_id: form.project_id ? parseInt(form.project_id) : null,
      work_done: form.work_done,
      request_date: form.request_date || null,
      invoice_price: form.invoice_price,
      invoice_vat: form.invoice_vat || "0",
      withholding_tax: form.withholding_tax || "0",
      tto_share_amount: form.tto_share_amount || null,
      amount_after_tto_share: form.amount_after_tto_share || "0",
      amount_after_withholding: form.amount_after_withholding || "0",
      other_funds: form.other_funds || "0",
      firm_collection_status: form.firm_collection_status || null,
      payment_status: form.payment_status,
      paid_date: form.paid_date || null,
      iban_snapshot: form.iban_snapshot || null,
      notes: form.notes || null,
      is_manually_adjusted: form.is_manually_adjusted,
    };
    try {
      const url  = isEdit ? `/api/records/${id}` : "/api/records/";
      const method = isEdit ? "PUT" : "POST";
      await apiFetch(url, { method, body: JSON.stringify(body) });
      showToast?.(isEdit ? "Kayıt güncellendi." : "Yeni kayıt oluşturuldu.", "success");
      navigate("/", { replace: true });
    } catch (e) {
      if (e instanceof ApiError && e.status !== 401) showToast?.(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  const selectedAcademician = useMemo(
    () => academicians.find(a => String(a.id) === String(form.academician_id)),
    [academicians, form.academician_id]
  );

  async function copyIban() {
    if (!selectedAcademician?.iban) return;
    try {
      await navigator.clipboard.writeText(selectedAcademician.iban);
      showToast?.("IBAN panoya kopyalandı.", "success");
    } catch {
      showToast?.("IBAN kopyalanamadı.", "error");
    }
  }

  // Dağılım oranı — sadece zaten backend'den gelen tutarların oranı (yeni hesap yapılmıyor)
  const invoicePrice = parseFloat(form.invoice_price) || 0;
  const ttoAmount = parseFloat(form.tto_share_amount) || 0;
  const netAmount = Math.max(0, (parseFloat(form.amount_after_withholding) || 0) - (parseFloat(form.other_funds) || 0));
  const netPct = invoicePrice > 0 ? Math.round((netAmount / invoicePrice) * 100) : 0;
  const ttoPct = invoicePrice > 0 ? Math.round((ttoAmount / invoicePrice) * 100) : 0;
  const taxPct = Math.max(0, 100 - netPct - ttoPct);
  const totalInvoice = invoicePrice + (parseFloat(form.invoice_vat) || 0);

  const content = (
    <div className="flex flex-col w-full">
      {/* Başlık */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">Kayıt Sistemi</span>
            <span className="inline-block w-1 h-1 rounded-full bg-primary/40" />
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-on-surface">
            {isEdit ? `Kayıt Düzenle #${id}` : "Yeni İş ve Ödeme Kaydı Oluştur"}
          </h1>
          <p className="text-xs text-on-surface-variant mt-1">Sözleşme, faturalandırma ve akademisyen hakediş hesaplama formu</p>
        </div>
        <div className="flex items-center gap-3 self-start lg:self-center">
          <div className={`px-4 py-2 rounded-xl bg-surface ${INSET_SM} flex items-center gap-2.5`}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <span className="text-xs font-semibold text-on-surface">Canlı Otomatik Hesaplama Aktif</span>
          </div>
          <button type="button" onClick={resetForm} title="Formu Temizle"
            className={`px-3 py-2 rounded-xl bg-surface ${RAISED} text-on-surface-variant hover:text-on-surface transition-all flex items-center gap-1.5 text-xs font-medium`}>
            <RestartIcon className="w-4 h-4" />
            <span>Sıfırla</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* SOL SÜTUN */}
        <div className="xl:col-span-7 flex flex-col gap-6">
          {/* Taraflar */}
          <div className={CARD}>
            <div className="flex items-center justify-between pb-2">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl bg-surface ${INSET_SM} flex items-center justify-center text-primary`}>
                  <GroupIcon className="w-[18px] h-[18px]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-on-surface">Taraflar ve Kurumsal Bilgi</h2>
                  <p className="text-[11px] text-on-surface-variant">Sözleşmeye taraf firma ve projeyi yürüten akademisyen</p>
                </div>
              </div>
              <span className={`text-[11px] font-mono font-medium px-2 py-1 rounded-lg bg-surface ${INSET_SM} text-on-surface-variant`}>Adım 01</span>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-on-surface">İş Yapılan Firma <span className="text-error">*</span></span>
                <button type="button" onClick={() => setFirmModalOpen(true)}
                  className="text-[11px] font-semibold text-primary hover:text-primary-container transition-colors flex items-center gap-1">
                  <PlusCircleIcon className="w-[15px] h-[15px]" />
                  <span>Hızlı Firma Ekle</span>
                </button>
              </div>
              <SearchableCreatableSelect
                id="form-firm"
                items={firms.map(f => ({ id: f.id, label: f.name }))}
                value={form.firm_id}
                onChange={firm_id => setForm(f => ({ ...f, firm_id }))}
                onCreate={createFirm}
                placeholder="Var olan firmalardan seçin veya yeni firma yazın…"
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-on-surface">Sorumlu Akademisyen / Proje Yürütücüsü <span className="text-error">*</span></span>
              <SearchableCreatableSelect
                id="form-academician"
                items={academicians.map(a => ({ id: a.id, label: a.full_name }))}
                value={form.academician_id}
                onChange={academician_id => setForm(f => ({ ...f, academician_id }))}
                onCreate={createAcademician}
                placeholder="Akademisyen adı ara veya yeni ekle…"
              />
              {selectedAcademician && (selectedAcademician.faculty || selectedAcademician.department) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                  {selectedAcademician.faculty && (
                    <div className={`px-3 py-2 rounded-lg bg-surface ${INSET_SM} text-[11px] text-on-surface-variant`}>
                      Fakülte: <span className="text-on-surface font-medium">{selectedAcademician.faculty}</span>
                    </div>
                  )}
                  {selectedAcademician.department && (
                    <div className={`px-3 py-2 rounded-lg bg-surface ${INSET_SM} text-[11px] text-on-surface-variant`}>
                      Bölüm: <span className="text-on-surface font-medium">{selectedAcademician.department}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-on-surface">Proje</span>
              <SearchableCreatableSelect
                id="form-project"
                items={projects.map(p => ({ id: p.id, label: p.name }))}
                value={form.project_id}
                onChange={project_id => setForm(f => ({ ...f, project_id }))}
                onCreate={createProject}
                placeholder="Proje ara veya yeni ekle (opsiyonel)…"
                allowClear
              />
            </div>
          </div>

          {/* İş Tanımı & Takvim */}
          <div className={CARD}>
            <div className="flex items-center justify-between pb-2">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl bg-surface ${INSET_SM} flex items-center justify-center text-primary`}>
                  <DocumentIcon className="w-[18px] h-[18px]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-on-surface">İşin Niteliği ve Süreç Takvimi</h2>
                  <p className="text-[11px] text-on-surface-variant">Ar-Ge / Danışmanlık kapsamı ve resmi tarihler</p>
                </div>
              </div>
              <span className={`text-[11px] font-mono font-medium px-2 py-1 rounded-lg bg-surface ${INSET_SM} text-on-surface-variant`}>Adım 02</span>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-on-surface">Yapılan İş / Danışmanlık Konusu ve Kapsamı <span className="text-error">*</span></span>
                <span className="text-[10px] text-on-surface-variant font-mono">{form.work_done.length} / 500 karakter</span>
              </div>
              <div className={`p-1 rounded-xl bg-surface ${INSET}`}>
                <textarea
                  id="form-work-done" required rows={3} maxLength={500}
                  value={form.work_done}
                  onChange={e => setForm(f => ({ ...f, work_done: e.target.value }))}
                  className="w-full p-2.5 bg-transparent text-xs font-medium text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none resize-none leading-relaxed"
                  placeholder="İşin detaylı teknik tanımını, beklenen çıktıları ve metodolojiyi yazınız…"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-on-surface-variant" htmlFor="form-request-date">Talep Tarihi</label>
                <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface ${INSET}`}>
                  <input id="form-request-date" type="date" value={form.request_date}
                    onChange={e => setForm(f => ({ ...f, request_date: e.target.value }))}
                    className="w-full bg-transparent text-xs text-on-surface focus:outline-none font-medium" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-on-surface-variant" htmlFor="form-year">Yıl *</label>
                <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface ${INSET}`}>
                  <select id="form-year" required value={form.year}
                    onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                    className="w-full bg-transparent text-xs text-on-surface focus:outline-none font-medium">
                    {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SAĞ SÜTUN — Finansal Hesaplama */}
        <div className="xl:col-span-5 flex flex-col gap-6">
          <div className={CARD}>
            <div className="flex items-center justify-between pb-2">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl bg-surface ${INSET_SM} flex items-center justify-center text-primary`}>
                  <CalculatorIcon className="w-[18px] h-[18px]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-on-surface">Otomatik Hesaplayıcı</h2>
                  <p className="text-[11px] text-on-surface-variant">TTO oranları — Ayarlar sayfasından yıl bazlı yönetilir</p>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-primary px-2 py-0.5 rounded-full bg-primary/10">Canlı</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface" htmlFor="form-invoice-price">Brüt Tutar (Fatura Fiyatı) *</label>
              <div className={`flex items-center gap-2 px-3.5 py-3 rounded-xl bg-surface ${INSET}`}>
                <span className="text-xs font-bold text-on-surface-variant font-mono">₺</span>
                <input id="form-invoice-price" type="number" step="0.01" min="0" required
                  value={form.invoice_price}
                  onChange={e => setForm(f => ({ ...f, invoice_price: e.target.value }))}
                  onBlur={fetchPreview}
                  className="w-full bg-transparent text-sm font-semibold text-on-surface focus:outline-none font-mono"
                  placeholder="0.00" />
              </div>
              {calcLoading && <p className="text-[11px] text-primary">Hesaplanıyor…</p>}
              {calcError && <p className="text-[11px] text-error">{calcError}</p>}
            </div>

            <div className={`px-4 py-2.5 rounded-xl bg-surface ${INSET_SM} flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <ReceiptIcon className="text-on-surface-variant w-[17px] h-[17px]" />
                <span className="text-xs font-medium text-on-surface">Toplam Fatura Bedeli<br />(KDV Dahil):</span>
              </div>
              <span className="text-sm font-bold font-mono text-primary">{formatTL(totalInvoice)}</span>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Yasal ve Kurumsal Kesintiler</div>
                {form.is_manually_adjusted ? (
                  <button type="button" onClick={resetManual}
                    className="text-[11px] font-semibold text-primary hover:underline">Otomatiğe dön</button>
                ) : (
                  <span className="text-[10px] text-on-surface-variant">Elle değiştirmek için alana tıklayın</span>
                )}
              </div>
              {CALC_FIELDS.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-on-surface">{label}</span>
                  <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-surface ${INSET_SM}`}>
                    <input
                      id={`form-${key}`}
                      type="number" step="0.01"
                      value={form[key]}
                      onChange={e => handleCalcFieldChange(key, e.target.value)}
                      className="w-24 bg-transparent text-right text-xs font-mono font-medium text-on-surface focus:outline-none"
                      placeholder="0.00" />
                  </div>
                </div>
              ))}
              {/* Diğer Fon & Harçlar — her zaman düzenlenebilir, ayrı opsiyonel kesinti */}
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-on-surface">Diğer Fon &amp; Harçlar</span>
                <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-surface ${INSET_SM}`}>
                  <span className="text-[10px] text-on-surface-variant">₺</span>
                  <input id="form-other-funds" type="number" step="0.01" min="0"
                    value={form.other_funds}
                    onChange={e => setForm(f => ({ ...f, other_funds: e.target.value }))}
                    className="w-24 bg-transparent text-right text-xs font-mono font-medium text-on-surface focus:outline-none" />
                </div>
              </div>
            </div>

            {/* Net Hakediş Kartı */}
            <div className="relative overflow-hidden rounded-2xl p-5 bg-surface shadow-[6px_6px_14px_rgba(0,0,0,0.07),-6px_-6px_14px_rgba(255,255,255,0.8)] mt-2">
              <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br from-primary/10 to-transparent blur-xl pointer-events-none" />
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Akademisyene Ödenecek Tutar</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <h3 className="text-3xl font-extrabold font-mono text-on-surface tracking-tight">{formatTL(netAmount)}</h3>
                  </div>
                  <p className="text-[10px] text-on-surface-variant mt-1">TTO payı, stopaj ve varsa diğer fon/harçlar düşüldükten sonra net ele geçen.</p>
                </div>
                <div className={`w-10 h-10 rounded-xl bg-surface ${INSET_SM} flex items-center justify-center text-primary`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5h-15A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
                  </svg>
                </div>
              </div>
              <div className="mt-4 pt-3 flex flex-col gap-1.5">
                <div className="flex justify-between text-[10px] font-medium text-on-surface-variant">
                  <span>Hakediş Dağılım Oranı</span>
                  <span className="font-mono text-on-surface">%{netPct} Net • %{taxPct} Stopaj • %{ttoPct} TTO</span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),inset_-2px_-2px_4px_rgba(255,255,255,0.7)] overflow-hidden flex">
                  <div className="h-full bg-primary rounded-l-full transition-all duration-300" style={{ width: `${netPct}%` }} title="Net Hakediş" />
                  <div className="h-full bg-tertiary-container transition-all duration-300" style={{ width: `${taxPct}%` }} title="Stopaj" />
                  <div className="h-full bg-secondary-fixed-dim transition-all duration-300" style={{ width: `${ttoPct}%` }} title="TTO Kesintisi" />
                </div>
              </div>
            </div>

            {/* İki Aşamalı Ödeme Akışı */}
            <div className="flex flex-col gap-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                  <FlowIcon className="w-4 h-4 text-primary" />
                  Süreç / İki Aşamalı Ödeme Akışı
                </span>
                <span className="text-[10px] text-on-surface-variant">2 Aşamalı Süreç</span>
              </div>

              <div className={`flex flex-col gap-2.5 p-3 rounded-xl bg-surface ${INSET_SM}`}>
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-on-surface font-semibold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    1. Aşama: Firma → TTO Tahsilatı
                  </span>
                  <span className="text-[10px] font-mono text-primary px-1.5 py-0.5 rounded bg-primary/10">Ön Koşul</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {["Tahsil Edildi", "Tahsil Edilmedi"].map(opt => (
                    <label key={opt}
                      className={`relative flex items-center gap-2 p-2.5 rounded-xl bg-surface cursor-pointer transition-all ${
                        form.firm_collection_status === opt ? INSET_SM : RAISED
                      }`}>
                      <input type="radio" name="firmCollectionStatus" className="text-primary focus:ring-0"
                        checked={form.firm_collection_status === opt}
                        onChange={() => setForm(f => ({ ...f, firm_collection_status: opt }))} />
                      <span className="text-xs font-medium text-on-surface">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className={`flex flex-col gap-2.5 p-3 rounded-xl bg-surface ${INSET_SM}`}>
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-on-surface font-semibold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary-fixed-dim" />
                    2. Aşama: TTO → Akademisyen Hakediş Ödemesi
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {["Ödendi", "Ödenmedi"].map(opt => (
                    <label key={opt}
                      className={`relative flex items-center gap-2 p-2.5 rounded-xl bg-surface cursor-pointer transition-all ${
                        form.payment_status === opt ? INSET_SM : RAISED
                      }`}>
                      <input type="radio" name="academicPaymentStatus" className="text-primary focus:ring-0"
                        checked={form.payment_status === opt}
                        onChange={() => setForm(f => ({ ...f, payment_status: opt }))} />
                      <span className="text-xs font-medium text-on-surface">{opt}</span>
                    </label>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-on-surface-variant">
                  <InfoIcon className="text-primary w-[13px] h-[13px]" />
                  <span>Akademisyene ödeme, firmadan tahsilat yapıldıktan sonra tamamlanır.</span>
                </div>
              </div>
            </div>

            {/* IBAN */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-on-surface">Ödeme Yapılacak Banka &amp; IBAN</label>
                {selectedAcademician?.iban && (
                  <span className="text-[10px] text-primary">Akademisyen Kaydından</span>
                )}
              </div>
              <div className={`flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-surface ${INSET}`}>
                <BankIcon className="text-on-surface-variant w-[18px] h-[18px]" />
                <input readOnly type="text"
                  value={selectedAcademician?.iban ?? ""}
                  placeholder={selectedAcademician ? "IBAN kayıtlı değil" : "Önce akademisyen seçin"}
                  className="w-full bg-transparent text-xs font-mono font-medium text-on-surface focus:outline-none" />
                {selectedAcademician?.iban && (
                  <button type="button" onClick={copyIban} title="IBAN Kopyala"
                    className="text-on-surface-variant hover:text-primary transition-colors">
                    <CopyIcon className="w-[18px] h-[18px]" />
                  </button>
                )}
              </div>
            </div>

            {/* Ödeme Tarihi / IBAN Snapshot / Notlar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-on-surface-variant" htmlFor="form-paid-date">Ödeme Tarihi</label>
                <div className={`flex items-center px-3 py-2.5 rounded-xl bg-surface ${INSET}`}>
                  <input id="form-paid-date" type="date" value={form.paid_date}
                    onChange={e => setForm(f => ({ ...f, paid_date: e.target.value }))}
                    className="w-full bg-transparent text-xs text-on-surface focus:outline-none font-medium" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-on-surface-variant" htmlFor="form-payment-status-select">Ödeme Durumu (2. Aşama)</label>
                <div className={`flex items-center px-3 py-2.5 rounded-xl bg-surface ${INSET}`}>
                  <select id="form-payment-status-select" value={form.payment_status}
                    onChange={e => setForm(f => ({ ...f, payment_status: e.target.value }))}
                    className="w-full bg-transparent text-xs text-on-surface focus:outline-none font-medium">
                    <option value="Ödenmedi">Ödenmedi</option>
                    <option value="Ödendi">Ödendi</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-on-surface-variant" htmlFor="form-notes">Notlar</label>
              <div className={`p-1 rounded-xl bg-surface ${INSET}`}>
                <textarea id="form-notes" rows={2} value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full p-2.5 bg-transparent text-xs text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none resize-none"
                  placeholder="Opsiyonel…" />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Link to="/"
                className={`px-4 py-2 rounded-xl bg-surface ${RAISED} text-xs font-medium text-on-surface-variant hover:text-on-surface transition-all`}>
                İptal
              </Link>
              <button id="form-save-btn" type="submit" disabled={saving || calcLoading}
                className="px-5 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold shadow-[4px_4px_10px_rgba(99,102,241,0.3),-4px_-4px_10px_rgba(255,255,255,0.6)] disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center gap-2">
                {saving && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {saving ? "Kaydediliyor…" : isEdit ? "Güncelle" : "Kaydı Oluştur"}
              </button>
            </div>
          </div>
        </div>
      </form>

      <QuickAddFirmModal open={firmModalOpen} onClose={() => setFirmModalOpen(false)} onSave={handleQuickAddFirm} />
    </div>
  );

  if (pageLoading) {
    return (
      <AppShell activePath="yeni-kayit-ekle">
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    );
  }

  return <AppShell activePath="yeni-kayit-ekle">{content}</AppShell>;
}
