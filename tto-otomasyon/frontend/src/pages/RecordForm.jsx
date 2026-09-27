/**
 * RecordForm.jsx — Yeni / Düzenle formu (14.4 güncellemesi)
 * apiFetch + showToast + disabled buton, preview-calculation loading.
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";

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
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link to="/" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">← Kayıtlar</Link>
          <h1 className="text-xl sm:text-2xl font-bold text-white mt-2">
            {isEdit ? `Kayıt Düzenle #${id}` : "Yeni İş Kaydı"}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Temel bilgiler */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Temel Bilgiler</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Yıl *</label>
                <select id="form-year" required value={form.year}
                  onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500">
                  {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Ödeme Durumu *</label>
                <select id="form-payment-status" required value={form.payment_status}
                  onChange={e => setForm(f => ({ ...f, payment_status: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500">
                  <option value="Ödenmedi">Ödenmedi</option>
                  <option value="Ödendi">Ödendi</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Firma *</label>
              <select id="form-firm" required value={form.firm_id}
                onChange={e => setForm(f => ({ ...f, firm_id: e.target.value }))}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500">
                <option value="">— Firma seç —</option>
                {firms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Akademisyen *</label>
              <select id="form-academician" required value={form.academician_id}
                onChange={e => setForm(f => ({ ...f, academician_id: e.target.value }))}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500">
                <option value="">— Akademisyen seç —</option>
                {academicians.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Proje</label>
              <select id="form-project" value={form.project_id}
                onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500">
                <option value="">— Proje yok —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Yapılan İş *</label>
              <input id="form-work-done" type="text" required value={form.work_done}
                onChange={e => setForm(f => ({ ...f, work_done: e.target.value }))}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                placeholder="Danışmanlık, Rapor vb." />
            </div>
          </div>

          {/* Parasal alanlar */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tutar Bilgileri</h2>
              {form.is_manually_adjusted && (
                <button type="button" onClick={resetManual}
                  className="text-xs text-yellow-400 hover:text-yellow-300 border border-yellow-800 px-2 py-1 rounded-lg transition-colors">
                  ✎ Elle — Otomatiğe dön
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Fatura Fiyatı (TL) *</label>
              <input id="form-invoice-price" type="number" step="0.01" required
                value={form.invoice_price}
                onChange={e => setForm(f => ({ ...f, invoice_price: e.target.value }))}
                onBlur={fetchPreview}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                placeholder="10000" />
              {calcLoading && (
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-indigo-400">Hesaplanıyor…</p>
                </div>
              )}
              {calcError && <p className="text-xs text-red-400 mt-1">{calcError}</p>}
              {!form.is_manually_adjusted && form.invoice_vat && !calcError && !calcLoading && (
                <p className="text-xs text-green-500 mt-1">✓ Hesaplamalar otomatik alındı</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {CALC_FIELDS.map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-medium mb-1.5">
                    <span className="text-gray-400">{label}</span>
                    {form.is_manually_adjusted
                      ? <span className="ml-1.5 text-yellow-500 text-xs">✎ elle</span>
                      : <span className="ml-1.5 text-indigo-400 text-xs">↻ otomatik</span>}
                  </label>
                  <input
                    id={`form-${key}`}
                    type="number" step="0.01"
                    value={form[key]}
                    onChange={e => handleCalcFieldChange(key, e.target.value)}
                    className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none transition-colors ${
                      form.is_manually_adjusted
                        ? "bg-gray-800 border-yellow-700 text-white focus:border-yellow-500"
                        : "bg-gray-800/40 border-gray-800 text-gray-400"
                    }`}
                    placeholder="0.00" />
                </div>
              ))}
            </div>
          </div>

          {/* Ödeme */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Ödeme Detayları</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Ödeme Tarihi</label>
                <input id="form-paid-date" type="date" value={form.paid_date}
                  onChange={e => setForm(f => ({ ...f, paid_date: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">IBAN (ödeme anındaki)</label>
                <input id="form-iban" type="text" value={form.iban_snapshot}
                  onChange={e => setForm(f => ({ ...f, iban_snapshot: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-indigo-500"
                  placeholder="TR00 …" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Notlar</label>
              <textarea id="form-notes" rows={3} value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
                placeholder="Opsiyonel…" />
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Link to="/" className="px-5 py-2.5 rounded-xl border border-gray-700 text-gray-300 text-sm hover:bg-gray-800 transition-colors">
              İptal
            </Link>
            <button id="form-save-btn" type="submit" disabled={saving || calcLoading}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all flex items-center gap-2">
              {saving && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {saving ? "Kaydediliyor…" : isEdit ? "Güncelle" : "Kaydet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
