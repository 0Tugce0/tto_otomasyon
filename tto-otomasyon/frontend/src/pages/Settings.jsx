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
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link to="/" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">← Kayıtlar</Link>
            <h1 className="text-xl sm:text-2xl font-bold text-white mt-2">Hesaplama Oranları</h1>
            <p className="text-gray-400 text-sm mt-0.5">Yıl bazlı TTO payı, stopaj, KDV ve fatura tevkifat oranları</p>
          </div>
        </div>

        {/* Mevcut oranlar */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mb-6">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-800">
            <h2 className="text-base font-semibold text-white">Mevcut Oranlar</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center">
              <div className="w-6 h-6 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : settings.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Henüz oran girilmemiş.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
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
                    <tr key={s.id} className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${editId === s.id ? "bg-indigo-950/30" : ""}`}>
                      <td className="px-4 sm:px-6 py-4 font-semibold text-indigo-400">{s.valid_year}</td>
                      <td className="px-4 sm:px-6 py-4 text-right text-green-400">{pct(s.tto_share_rate)}</td>
                      <td className="px-4 sm:px-6 py-4 text-right">{pct(s.withholding_rate)}</td>
                      <td className="px-4 sm:px-6 py-4 text-right hidden sm:table-cell">{pct(s.vat_rate)}</td>
                      <td className="px-4 sm:px-6 py-4 text-right hidden sm:table-cell">{pct(s.invoice_withholding_rate)}</td>
                      <td className="px-4 sm:px-6 py-4 text-center">
                        <button onClick={() => startEdit(s)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors text-gray-300">
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
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-white">
              {editId ? `${form.valid_year} Yılı Düzenle` : "Yeni Yıl Ekle"}
            </h2>
            {editId && (
              <button onClick={startNew} className="text-xs text-gray-400 hover:text-white transition-colors">
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
                <label className="block text-xs font-medium text-gray-400 mb-1.5">{label}</label>
                <input
                  id={`settings-${key}`}
                  type={type || "text"} required
                  disabled={editId && key === "valid_year"}
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-indigo-500 disabled:opacity-50 transition-colors"
                  placeholder={placeholder}
                />
              </div>
            ))}
            <div className="sm:col-span-2 flex justify-end pt-2">
              <button id="settings-save-btn" type="submit" disabled={saving}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all flex items-center gap-2">
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
