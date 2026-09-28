/**
 * RecordForm.jsx — Yeni / Düzenle formu (14.4 güncellemesi)
 * apiFetch + showToast + disabled buton, preview-calculation loading.
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";
import SearchableCreatableSelect from "../components/SearchableCreatableSelect";

const CALC_FIELDS = [
  { key: "invoice_vat",             label: "Fatura KDV" },
  { key: "withholding_tax",         label: "Tevkifat" },
  { key: "tto_share_amount",        label: "TTO Payı (TL)" },
  { key: "amount_after_tto_share",  label: "TTO Payı Sonrası" },
  { key: "amount_after_withholding",label: "Akademisyene Net" },
];

const EMPTY_FORM = {
  year: 2026,
  firm_id: "", academician_id: "", project_id: "",
  work_done: "",
  invoice_price: "",
  invoice_vat: "", withholding_tax: "", tto_share_amount: "",
  amount_after_tto_share: "", amount_after_withholding: "",
  payment_status: "Ödenmedi",
  paid_date: "", iban_snapshot: "", notes: "",
  is_manually_adjusted: false,
};

export default function RecordForm({ showToast }) {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [firms, setFirms] = useState([]);
  const [academicians, setAcademicians] = useState([]);
  const [projects, setProjects] = useState([]);
  const [pageLoading, setPageLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcError, setCalcError] = useState("");

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
        invoice_price: d.invoice_price ?? "",
        invoice_vat: d.invoice_vat ?? "",
        withholding_tax: d.withholding_tax ?? "",
        tto_share_amount: d.tto_share_amount ?? "",
        amount_after_tto_share: d.amount_after_tto_share ?? "",
        amount_after_withholding: d.amount_after_withholding ?? "",
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
        body: JSON.stringify({ year: parseInt(form.year), invoice_price: form.invoice_price }),
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

  // "Aranabilir + yeni ekle" bileşenleri için oluşturma yardımcıları.
  // Her biri yeni kaydı API'ye POST eder, dropdown state'ine ekler
  // (sayfa yenilenmeden) ve bileşenin bekledigi {id, label} şeklinde döner.
  async function createFirm(name) {
    const created = await apiFetch("/api/firms/", { method: "POST", body: JSON.stringify({ name }) });
    setFirms(f => [...f, created]);
    return { id: created.id, label: created.name };
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
      invoice_price: form.invoice_price,
      invoice_vat: form.invoice_vat || "0",
      withholding_tax: form.withholding_tax || "0",
      tto_share_amount: form.tto_share_amount || null,
      amount_after_tto_share: form.amount_after_tto_share || "0",
      amount_after_withholding: form.amount_after_withholding || "0",
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

  if (pageLoading) return (
    <div className="min-h-screen bg-custom-bg flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-custom-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-custom-bg text-custom-text p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link to="/" className="text-custom-primary/70 hover:text-custom-text text-sm transition-colors">← Kayıtlar</Link>
          <h1 className="text-xl sm:text-2xl font-bold text-custom-text mt-2">
            {isEdit ? `Kayıt Düzenle #${id}` : "Yeni İş Kaydı"}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Temel bilgiler */}
          <div className="bg-white border border-custom-primary/15 rounded-2xl p-4 sm:p-5 space-y-4">
            <h2 className="text-xs font-semibold text-custom-primary uppercase tracking-wider">Temel Bilgiler</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-custom-primary mb-1.5">Yıl *</label>
                <select id="form-year" required value={form.year}
                  onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-custom-primary/5 border border-custom-primary/25 rounded-xl text-custom-text text-sm focus:outline-none focus:border-custom-primary">
                  {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-custom-primary mb-1.5">Ödeme Durumu *</label>
                <select id="form-payment-status" required value={form.payment_status}
                  onChange={e => setForm(f => ({ ...f, payment_status: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-custom-primary/5 border border-custom-primary/25 rounded-xl text-custom-text text-sm focus:outline-none focus:border-custom-primary">
                  <option value="Ödenmedi">Ödenmedi</option>
                  <option value="Ödendi">Ödendi</option>
                </select>
              </div>
            </div>

            <SearchableCreatableSelect
              id="form-firm"
              label="Firma *"
              items={firms.map(f => ({ id: f.id, label: f.name }))}
              value={form.firm_id}
              onChange={firm_id => setForm(f => ({ ...f, firm_id }))}
              onCreate={createFirm}
              placeholder="Firma ara veya yeni ekle…"
            />

            <SearchableCreatableSelect
              id="form-academician"
              label="Akademisyen *"
              items={academicians.map(a => ({ id: a.id, label: a.full_name }))}
              value={form.academician_id}
              onChange={academician_id => setForm(f => ({ ...f, academician_id }))}
              onCreate={createAcademician}
              placeholder="Akademisyen ara veya yeni ekle…"
            />

            <SearchableCreatableSelect
              id="form-project"
              label="Proje"
              items={projects.map(p => ({ id: p.id, label: p.name }))}
              value={form.project_id}
              onChange={project_id => setForm(f => ({ ...f, project_id }))}
              onCreate={createProject}
              placeholder="Proje ara veya yeni ekle (opsiyonel)…"
              allowClear
            />

            <div>
              <label className="block text-xs font-medium text-custom-primary mb-1.5">Yapılan İş *</label>
              <input id="form-work-done" type="text" required value={form.work_done}
                onChange={e => setForm(f => ({ ...f, work_done: e.target.value }))}
                className="w-full px-3 py-2.5 bg-custom-primary/5 border border-custom-primary/25 rounded-xl text-custom-text text-sm focus:outline-none focus:border-custom-primary"
                placeholder="Danışmanlık, Rapor vb." />
            </div>
          </div>

          {/* Parasal alanlar */}
          <div className="bg-white border border-custom-primary/15 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-custom-primary uppercase tracking-wider">Tutar Bilgileri</h2>
              {form.is_manually_adjusted && (
                <button type="button" onClick={resetManual}
                  className="text-xs text-yellow-600 hover:text-yellow-700 border border-yellow-300 px-2 py-1 rounded-lg transition-colors">
                  ✎ Elle — Otomatiğe dön
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-custom-primary mb-1.5">Fatura Fiyatı (TL) *</label>
              <input id="form-invoice-price" type="number" step="0.01" required
                value={form.invoice_price}
                onChange={e => setForm(f => ({ ...f, invoice_price: e.target.value }))}
                onBlur={fetchPreview}
                className="w-full px-3 py-2.5 bg-custom-primary/5 border border-custom-primary/25 rounded-xl text-custom-text text-sm focus:outline-none focus:border-custom-primary"
                placeholder="10000" />
              {calcLoading && (
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="w-3 h-3 border-2 border-custom-accent border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-custom-accent">Hesaplanıyor…</p>
                </div>
              )}
              {calcError && <p className="text-xs text-red-500 mt-1">{calcError}</p>}
              {!form.is_manually_adjusted && form.invoice_vat && !calcError && !calcLoading && (
                <p className="text-xs text-green-600 mt-1">✓ Hesaplamalar otomatik alındı</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {CALC_FIELDS.map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-medium mb-1.5">
                    <span className="text-custom-primary">{label}</span>
                    {form.is_manually_adjusted
                      ? <span className="ml-1.5 text-yellow-600 text-xs">✎ elle</span>
                      : <span className="ml-1.5 text-custom-accent text-xs">↻ otomatik</span>}
                  </label>
                  <input
                    id={`form-${key}`}
                    type="number" step="0.01"
                    value={form[key]}
                    onChange={e => handleCalcFieldChange(key, e.target.value)}
                    className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none transition-colors ${
                      form.is_manually_adjusted
                        ? "bg-yellow-50 border-yellow-300 text-custom-text focus:border-yellow-500"
                        : "bg-custom-primary/5 border-custom-primary/10 text-custom-primary/60"
                    }`}
                    placeholder="0.00" />
                </div>
              ))}
            </div>
          </div>

          {/* Ödeme */}
          <div className="bg-white border border-custom-primary/15 rounded-2xl p-4 sm:p-5 space-y-4">
            <h2 className="text-xs font-semibold text-custom-primary uppercase tracking-wider">Ödeme Detayları</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-custom-primary mb-1.5">Ödeme Tarihi</label>
                <input id="form-paid-date" type="date" value={form.paid_date}
                  onChange={e => setForm(f => ({ ...f, paid_date: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-custom-primary/5 border border-custom-primary/25 rounded-xl text-custom-text text-sm focus:outline-none focus:border-custom-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-custom-primary mb-1.5">IBAN (ödeme anındaki)</label>
                <input id="form-iban" type="text" value={form.iban_snapshot}
                  onChange={e => setForm(f => ({ ...f, iban_snapshot: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-custom-primary/5 border border-custom-primary/25 rounded-xl text-custom-text text-sm font-mono focus:outline-none focus:border-custom-primary"
                  placeholder="TR00 …" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-custom-primary mb-1.5">Notlar</label>
              <textarea id="form-notes" rows={3} value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2.5 bg-custom-primary/5 border border-custom-primary/25 rounded-xl text-custom-text text-sm focus:outline-none focus:border-custom-primary resize-none"
                placeholder="Opsiyonel…" />
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Link to="/" className="px-5 py-2.5 rounded-xl border border-custom-primary/25 text-custom-text text-sm hover:bg-custom-primary/5 transition-colors">
              İptal
            </Link>
            <button id="form-save-btn" type="submit" disabled={saving || calcLoading}
              className="px-6 py-2.5 bg-custom-primary hover:bg-custom-accent disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all flex items-center gap-2">
              {saving && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {saving ? "Kaydediliyor…" : isEdit ? "Güncelle" : "Kaydet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
