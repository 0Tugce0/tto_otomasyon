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
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

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

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/records/${deleteTarget.id}`, { method: "DELETE" });
      setResult(r => ({
        ...r,
        total: r.total - 1,
        items: r.items.filter(x => x.id !== deleteTarget.id),
      }));
      showToast?.("Kayıt silindi.", "success");
    } catch (e) {
      if (e instanceof ApiError && e.status !== 401) showToast?.(e.message, "error");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const hasActiveFilter = firmId || academicianId || paymentStatus;

  return (
    <div className="min-h-screen bg-custom-bg text-custom-text">
      {/* Navbar */}
      <nav className="border-b border-custom-primary/15 bg-white/80 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-custom-primary flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="font-semibold text-custom-text text-sm hidden sm:block">TTO Otomasyonu</span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 text-sm">
          {user && (
            <span className="text-custom-primary text-xs hidden sm:block">👤 {user.full_name}</span>
          )}
          <Link to="/settings" className="text-custom-primary hover:text-custom-text transition-colors">Ayarlar</Link>
          <button id="navbar-logout" onClick={handleLogout}
            className="text-custom-primary hover:text-red-500 transition-colors">
            Çıkış
          </button>
        </div>
      </nav>

      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        {/* Başlık + Yeni Kayıt */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-custom-text">İş Kayıtları</h1>
            <p className="text-custom-primary text-sm mt-0.5">
              {loading ? "Yükleniyor…" : `${result.total} kayıt`}
              {hasActiveFilter && <span className="ml-2 text-custom-accent text-xs">(filtreli)</span>}
            </p>
          </div>
          <Link to="/records/new" id="new-record-btn"
            className="px-3 sm:px-4 py-2 bg-custom-primary hover:bg-custom-accent text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-custom-primary/20">
            + Yeni
          </Link>
        </div>

        {/* Filtreler */}
        <div className="bg-white border border-custom-primary/15 rounded-xl p-3 sm:p-4 mb-5 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <div>
            <label className="block text-xs text-custom-primary mb-1">Yıl</label>
            <select id="filter-year" value={year}
              onChange={e => applyFilter(setYear)(e.target.value ? parseInt(e.target.value) : "")}
              className="w-full px-2 sm:px-3 py-2 bg-custom-primary/5 border border-custom-primary/25 rounded-lg text-sm text-custom-text focus:outline-none focus:border-custom-primary">
              <option value="">Tümü</option>
              {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-custom-primary mb-1">Firma</label>
            <select id="filter-firm" value={firmId}
              onChange={e => applyFilter(setFirmId)(e.target.value)}
              className="w-full px-2 sm:px-3 py-2 bg-custom-primary/5 border border-custom-primary/25 rounded-lg text-sm text-custom-text focus:outline-none focus:border-custom-primary">
              <option value="">Tümü</option>
              {firms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-custom-primary mb-1">Akademisyen</label>
            <select id="filter-academician" value={academicianId}
              onChange={e => applyFilter(setAcademicianId)(e.target.value)}
              className="w-full px-2 sm:px-3 py-2 bg-custom-primary/5 border border-custom-primary/25 rounded-lg text-sm text-custom-text focus:outline-none focus:border-custom-primary">
              <option value="">Tümü</option>
              {academicians.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-custom-primary mb-1">Durum</label>
            <select id="filter-status" value={paymentStatus}
              onChange={e => applyFilter(setPaymentStatus)(e.target.value)}
              className="w-full px-2 sm:px-3 py-2 bg-custom-primary/5 border border-custom-primary/25 rounded-lg text-sm text-custom-text focus:outline-none focus:border-custom-primary">
              <option value="">Tümü</option>
              <option value="Ödendi">Ödendi</option>
              <option value="Ödenmedi">Ödenmedi</option>
            </select>
          </div>
        </div>

        {/* Tablo */}
        <div className="bg-white border border-custom-primary/15 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-4 border-custom-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-custom-primary/70 text-sm">Kayıtlar yükleniyor…</p>
            </div>
          ) : result.items.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-custom-primary/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-custom-primary/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 12h6m-6 4h6M5 8h.01M5 12h.01M5 16h.01M19 4H9a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2z" />
                </svg>
              </div>
              <p className="text-custom-primary font-medium">Kayıt bulunamadı</p>
              <p className="text-custom-primary/50 text-sm mt-1">
                {hasActiveFilter ? "Filtrelerinizi değiştirmeyi deneyin." : "Henüz iş kaydı eklenmemiş."}
              </p>
              {hasActiveFilter && (
                <button onClick={() => { setFirmId(""); setAcademicianId(""); setPaymentStatus(""); setPage(1); }}
                  className="mt-3 text-custom-accent text-sm hover:underline">
                  Filtreleri temizle
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-custom-primary/15 text-custom-primary text-xs uppercase tracking-wider">
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
                    <tr key={r.id} className="border-b border-custom-primary/10 hover:bg-custom-primary/5 transition-colors">
                      <td className="px-3 sm:px-4 py-3 font-mono text-custom-primary text-xs whitespace-nowrap">
                        {r.year}/{r.sira_no}
                        {r.is_manually_adjusted && (
                          <span className="ml-1 text-yellow-500" title="Elle düzeltilmiş">✎</span>
                        )}
                      </td>
                      <td className="px-3 sm:px-4 py-3">
                        <Link to={`/firms/${r.firm_id}`} className="text-custom-primary hover:underline text-xs sm:text-sm">
                          {r.firm?.name ?? `#${r.firm_id}`}
                        </Link>
                      </td>
                      <td className="px-3 sm:px-4 py-3 hidden sm:table-cell">
                        <Link to={`/academicians/${r.academician_id}`} className="text-custom-accent hover:underline text-xs sm:text-sm">
                          {r.academician?.full_name ?? `#${r.academician_id}`}
                        </Link>
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-custom-primary max-w-xs truncate hidden lg:table-cell text-xs">
                        {r.work_done || "—"}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-right font-mono text-xs text-custom-primary whitespace-nowrap">
                        {formatTL(r.invoice_price)}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-right font-mono text-xs text-custom-accent whitespace-nowrap hidden sm:table-cell">
                        {formatTL(r.amount_after_withholding)}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-center">
                        <span className={`inline-block px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.payment_status === "Ödendi"
                            ? "bg-custom-primary/10 text-custom-primary border border-custom-primary/30"
                            : "bg-custom-accent/10 text-custom-accent border border-custom-accent/30"
                        }`}>{r.payment_status}</span>
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-center whitespace-nowrap">
                        <Link to={`/records/${r.id}/edit`}
                          className="text-xs px-2 py-1 rounded-lg bg-custom-primary/10 hover:bg-custom-primary/20 transition-colors text-custom-text">
                          Düzenle
                        </Link>
                        <button onClick={() => setDeleteTarget(r)}
                          className="ml-1.5 text-xs px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 transition-colors text-red-600">
                          Sil
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {result.pages > 1 && (
            <div className="px-4 sm:px-6 py-4 border-t border-custom-primary/15 flex items-center justify-between text-sm">
              <span className="text-custom-primary text-xs sm:text-sm">
                Sayfa {result.page}/{result.pages} · {result.total} kayıt
              </span>
              <div className="flex gap-2">
                <button id="prev-page-btn" disabled={page <= 1 || loading}
                  onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 rounded-lg bg-custom-primary/5 hover:bg-custom-primary/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-custom-text text-sm">
                  ← Önceki
                </button>
                <button id="next-page-btn" disabled={page >= result.pages || loading}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 rounded-lg bg-custom-primary/5 hover:bg-custom-primary/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-custom-text text-sm">
                  Sonraki →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Silme onay modalı */}
      {deleteTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-custom-text/50 backdrop-blur-sm p-4">
          <div className="bg-white border border-custom-primary/15 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h2 className="text-lg font-semibold text-custom-text mb-2">Kaydı sil</h2>
            <p className="text-custom-primary text-sm mb-6">
              Bu kaydı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting}
                className="px-4 py-2 rounded-xl bg-custom-primary/10 hover:bg-custom-primary/20 text-custom-text text-sm font-medium transition-colors disabled:opacity-50">
                Vazgeç
              </button>
              <button onClick={handleConfirmDelete} disabled={deleting}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                {deleting ? "Siliniyor…" : "Evet, Sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
