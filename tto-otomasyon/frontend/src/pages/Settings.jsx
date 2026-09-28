/**
 * Settings.jsx — apiFetch + showToast (14.4)
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";

const EMPTY_FORM = {
  valid_year: new Date().getFullYear() + 1,
  tto_share_rate: "0.15",
  withholding_rate: "0.20",
  vat_rate: "0.20",
  invoice_withholding_rate: "0.10",
};

function pct(v) {
  return v ? `%${(parseFloat(v) * 100).toFixed(0)}` : "—";
}

export default function Settings({ showToast }) {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  async function fetchSettings() {
    setLoading(true);
    try {
      const data = await apiFetch("/api/settings/");
      setSettings(data ?? []);
    } catch (e) {
      if (e instanceof ApiError && e.status !== 401) showToast?.(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchSettings(); }, []);

  function startEdit(s) {
    setEditId(s.id);
    setForm({
      valid_year: s.valid_year,
      tto_share_rate: s.tto_share_rate,
      withholding_rate: s.withholding_rate,
      vat_rate: s.vat_rate,
      invoice_withholding_rate: s.invoice_withholding_rate,
    });
  }

  function startNew() { setEditId(null); setForm(EMPTY_FORM); }

  async function handleSave(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const url = editId ? `/api/settings/${editId}` : "/api/settings/";
      const method = editId ? "PUT" : "POST";
      await apiFetch(url, { method, body: JSON.stringify(form) });
      showToast?.(editId ? "Oran güncellendi." : "Yeni yıl oranı eklendi.", "success");
      await fetchSettings();
      if (!editId) setForm(EMPTY_FORM);
    } catch (e) {
      if (e instanceof ApiError && e.status !== 401) showToast?.(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-custom-bg text-custom-text p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link to="/" className="text-custom-primary/70 hover:text-custom-text text-sm transition-colors">← Kayıtlar</Link>
            <h1 className="text-xl sm:text-2xl font-bold text-custom-text mt-2">Hesaplama Oranları</h1>
            <p className="text-custom-primary text-sm mt-0.5">Yıl bazlı TTO payı, stopaj, KDV ve fatura tevkifat oranları</p>
          </div>
        </div>

        {/* Mevcut oranlar */}
        <div className="bg-white border border-custom-primary/15 rounded-2xl overflow-hidden mb-6">
          <div className="px-4 sm:px-6 py-4 border-b border-custom-primary/15">
            <h2 className="text-base font-semibold text-custom-text">Mevcut Oranlar</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center">
              <div className="w-6 h-6 border-4 border-custom-primary border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : settings.length === 0 ? (
            <div className="p-8 text-center text-custom-primary/70">Henüz oran girilmemiş.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-custom-primary/15 text-custom-primary text-xs uppercase tracking-wider">
                    <th className="px-4 sm:px-6 py-3 text-left">Yıl</th>
                    <th className="px-4 sm:px-6 py-3 text-right">TTO Payı</th>
                    <th className="px-4 sm:px-6 py-3 text-right">Stopaj</th>
                    <th className="px-4 sm:px-6 py-3 text-right hidden sm:table-cell">KDV</th>
                    <th className="px-4 sm:px-6 py-3 text-right hidden sm:table-cell">Fatura Tevkifat</th>
                    <th className="px-4 sm:px-6 py-3 text-center">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {settings.map(s => (
                    <tr key={s.id} className={`border-b border-custom-primary/10 hover:bg-custom-primary/5 transition-colors ${editId === s.id ? "bg-custom-primary/10" : ""}`}>
                      <td className="px-4 sm:px-6 py-4 font-semibold text-custom-accent">{s.valid_year}</td>
                      <td className="px-4 sm:px-6 py-4 text-right text-custom-primary">{pct(s.tto_share_rate)}</td>
                      <td className="px-4 sm:px-6 py-4 text-right">{pct(s.withholding_rate)}</td>
                      <td className="px-4 sm:px-6 py-4 text-right hidden sm:table-cell">{pct(s.vat_rate)}</td>
                      <td className="px-4 sm:px-6 py-4 text-right hidden sm:table-cell">{pct(s.invoice_withholding_rate)}</td>
                      <td className="px-4 sm:px-6 py-4 text-center">
                        <button onClick={() => startEdit(s)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-custom-primary/10 hover:bg-custom-primary/20 transition-colors text-custom-text">
                          Düzenle
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Form */}
        <div className="bg-white border border-custom-primary/15 rounded-2xl p-4 sm:p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-custom-text">
              {editId ? `${form.valid_year} Yılı Düzenle` : "Yeni Yıl Ekle"}
            </h2>
            {editId && (
              <button onClick={startNew} className="text-xs text-custom-primary hover:text-custom-text transition-colors">
                ✕ İptal
              </button>
            )}
          </div>

          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: "valid_year",               label: "Yıl",                          type: "number", placeholder: "2027" },
              { key: "tto_share_rate",            label: "TTO Payı Oranı (0.15 = %15)",  placeholder: "0.15" },
              { key: "withholding_rate",          label: "Stopaj Oranı (0.20 = %20)",    placeholder: "0.20" },
              { key: "vat_rate",                  label: "KDV Oranı (0.20 = %20)",       placeholder: "0.20" },
              { key: "invoice_withholding_rate",  label: "Fatura Tevkifat (0.10 = %10)", placeholder: "0.10" },
            ].map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-custom-primary mb-1.5">{label}</label>
                <input
                  id={`settings-${key}`}
                  type={type || "text"} required
                  disabled={editId && key === "valid_year"}
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-custom-primary/5 border border-custom-primary/25 rounded-xl text-custom-text text-sm placeholder-custom-primary/40 focus:outline-none focus:border-custom-primary disabled:opacity-50 transition-colors"
                  placeholder={placeholder}
                />
              </div>
            ))}
            <div className="sm:col-span-2 flex justify-end pt-2">
              <button id="settings-save-btn" type="submit" disabled={saving}
                className="px-6 py-2.5 bg-custom-primary hover:bg-custom-accent disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all flex items-center gap-2">
                {saving && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {saving ? "Kaydediliyor…" : editId ? "Güncelle" : "Ekle"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
