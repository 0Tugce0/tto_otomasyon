/**
 * RecordsList.jsx — İş kayıtları listesi (şartname 7.2)
 * apiFetch: 401 global handler, hata toast, loading, empty state, responsive.
 */

import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";

function formatTL(v) {
  if (v == null) return "—";
  return Number(v).toLocaleString("tr-TR", { minimumFractionDigits: 2 }) + " ₺";
}

const CURRENT_YEAR = 2026;
const PAGE_SIZE = 25;

export default function RecordsList({ showToast }) {
  const navigate = useNavigate();

  const [year, setYear] = useState(CURRENT_YEAR);
  const [firmId, setFirmId] = useState("");
  const [academicianId, setAcademicianId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [page, setPage] = useState(1);

  const [result, setResult] = useState({ total: 0, pages: 1, items: [] });
  const [firms, setFirms] = useState([]);
  const [academicians, setAcademicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/auth/me"),
      apiFetch("/api/firms/"),
      apiFetch("/api/academicians/"),
    ]).then(([me, f, a]) => {
      setUser(me);
      setFirms(Array.isArray(f) ? f : []);
      setAcademicians(Array.isArray(a) ? a : []);
    }).catch(e => {
      if (e instanceof ApiError && e.status !== 401) showToast?.(e.message, "error");
    });
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, page_size: PAGE_SIZE });
      if (year) params.set("year", year);
      if (firmId) params.set("firm_id", firmId);
      if (academicianId) params.set("academician_id", academicianId);
      if (paymentStatus) params.set("payment_status", paymentStatus);
      const data = await apiFetch(`/api/records/?${params}`);
      setResult(data ?? { total: 0, pages: 1, items: [] });
    } catch (e) {
      if (e instanceof ApiError && e.status !== 401) showToast?.(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [year, firmId, academicianId, paymentStatus, page]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  function applyFilter(setter) {
    return (val) => { setter(val); setPage(1); };
  }

  async function handleLogout() {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      navigate("/login", { replace: true });
    }
  }

  const hasActiveFilter = firmId || academicianId || paymentStatus;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Navbar */}
      <nav className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="font-semibold text-white text-sm hidden sm:block">TTO Otomasyonu</span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 text-sm">
          {user && (
            <span className="text-gray-400 text-xs hidden sm:block">👤 {user.full_name}</span>
          )}
          <Link to="/settings" className="text-gray-400 hover:text-white transition-colors">Ayarlar</Link>
          <button id="navbar-logout" onClick={handleLogout}
            className="text-gray-400 hover:text-red-400 transition-colors">
            Çıkış
          </button>
        </div>
      </nav>

      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        {/* Başlık + Yeni Kayıt */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">İş Kayıtları</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              {loading ? "Yükleniyor…" : `${result.total} kayıt`}
              {hasActiveFilter && <span className="ml-2 text-indigo-400 text-xs">(filtreli)</span>}
            </p>
          </div>
          <Link to="/records/new" id="new-record-btn"
            className="px-3 sm:px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/20">
            + Yeni
          </Link>
        </div>

        {/* Filtreler */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 sm:p-4 mb-5 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Yıl</label>
            <select id="filter-year" value={year}
              onChange={e => applyFilter(setYear)(e.target.value ? parseInt(e.target.value) : "")}
              className="w-full px-2 sm:px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500">
              <option value="">Tümü</option>
              {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Firma</label>
            <select id="filter-firm" value={firmId}
              onChange={e => applyFilter(setFirmId)(e.target.value)}
              className="w-full px-2 sm:px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500">
              <option value="">Tümü</option>
              {firms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Akademisyen</label>
            <select id="filter-academician" value={academicianId}
              onChange={e => applyFilter(setAcademicianId)(e.target.value)}
              className="w-full px-2 sm:px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500">
              <option value="">Tümü</option>
              {academicians.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Durum</label>
            <select id="filter-status" value={paymentStatus}
              onChange={e => applyFilter(setPaymentStatus)(e.target.value)}
              className="w-full px-2 sm:px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500">
              <option value="">Tümü</option>
              <option value="Ödendi">Ödendi</option>
              <option value="Ödenmedi">Ödenmedi</option>
            </select>
          </div>
        </div>

        {/* Tablo */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Kayıtlar yükleniyor…</p>
            </div>
          ) : result.items.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 12h6m-6 4h6M5 8h.01M5 12h.01M5 16h.01M19 4H9a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2z" />
                </svg>
              </div>
              <p className="text-gray-400 font-medium">Kayıt bulunamadı</p>
              <p className="text-gray-600 text-sm mt-1">
                {hasActiveFilter ? "Filtrelerinizi değiştirmeyi deneyin." : "Henüz iş kaydı eklenmemiş."}
              </p>
              {hasActiveFilter && (
                <button onClick={() => { setFirmId(""); setAcademicianId(""); setPaymentStatus(""); setPage(1); }}
                  className="mt-3 text-indigo-400 text-sm hover:underline">
                  Filtreleri temizle
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                    <th className="px-3 sm:px-4 py-3 text-left">No</th>
                    <th className="px-3 sm:px-4 py-3 text-left">Firma</th>
                    <th className="px-3 sm:px-4 py-3 text-left hidden sm:table-cell">Akademisyen</th>
                    <th className="px-3 sm:px-4 py-3 text-left hidden lg:table-cell">İş</th>
                    <th className="px-3 sm:px-4 py-3 text-right">Fatura</th>
                    <th className="px-3 sm:px-4 py-3 text-right hidden sm:table-cell">Net</th>
                    <th className="px-3 sm:px-4 py-3 text-center">Durum</th>
                    <th className="px-3 sm:px-4 py-3 text-center">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map(r => (
                    <tr key={r.id} className="border-b border-gray-800/40 hover:bg-gray-800/20 transition-colors">
                      <td className="px-3 sm:px-4 py-3 font-mono text-gray-400 text-xs whitespace-nowrap">
                        {r.year}/{r.sira_no}
                        {r.is_manually_adjusted && (
                          <span className="ml-1 text-yellow-500" title="Elle düzeltilmiş">✎</span>
                        )}
                      </td>
                      <td className="px-3 sm:px-4 py-3">
                        <Link to={`/firms/${r.firm_id}`} className="text-blue-400 hover:underline text-xs sm:text-sm">
                          {r.firm?.name ?? `#${r.firm_id}`}
                        </Link>
                      </td>
                      <td className="px-3 sm:px-4 py-3 hidden sm:table-cell">
                        <Link to={`/academicians/${r.academician_id}`} className="text-indigo-400 hover:underline text-xs sm:text-sm">
                          {r.academician?.full_name ?? `#${r.academician_id}`}
                        </Link>
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-gray-400 max-w-xs truncate hidden lg:table-cell text-xs">
                        {r.work_done || "—"}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-right font-mono text-xs text-blue-300 whitespace-nowrap">
                        {formatTL(r.invoice_price)}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-right font-mono text-xs text-green-300 whitespace-nowrap hidden sm:table-cell">
                        {formatTL(r.amount_after_withholding)}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-center">
                        <span className={`inline-block px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.payment_status === "Ödendi"
                            ? "bg-green-900/50 text-green-400 border border-green-800"
                            : "bg-yellow-900/50 text-yellow-400 border border-yellow-800"
                        }`}>{r.payment_status}</span>
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-center">
                        <Link to={`/records/${r.id}/edit`}
                          className="text-xs px-2 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors text-gray-300 whitespace-nowrap">
                          Düzenle
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {result.pages > 1 && (
            <div className="px-4 sm:px-6 py-4 border-t border-gray-800 flex items-center justify-between text-sm">
              <span className="text-gray-400 text-xs sm:text-sm">
                Sayfa {result.page}/{result.pages} · {result.total} kayıt
              </span>
              <div className="flex gap-2">
                <button id="prev-page-btn" disabled={page <= 1 || loading}
                  onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-gray-300 text-sm">
                  ← Önceki
                </button>
                <button id="next-page-btn" disabled={page >= result.pages || loading}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-gray-300 text-sm">
                  Sonraki →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
