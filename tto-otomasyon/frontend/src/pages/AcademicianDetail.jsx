/**
 * AcademicianDetail.jsx — apiFetch + showToast + responsive (14.4)
 */
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";

function formatTL(v) {
  if (v == null) return "—";
  return Number(v).toLocaleString("tr-TR", { minimumFractionDigits: 2 }) + " ₺";
}

export default function AcademicianDetail({ showToast }) {
  const { id } = useParams();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch(`/api/academicians/${id}/detail`)
      .then(setDetail)
      .catch(e => {
        const msg = e instanceof ApiError ? e.message : "Yüklenemedi.";
        if (e?.status !== 401) setError(msg);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-red-900/30 border border-red-800 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">⚠</span>
        </div>
        <p className="text-red-400 font-semibold mb-2">Hata</p>
        <p className="text-gray-400 text-sm mb-4">{error}</p>
        <Link to="/" className="text-indigo-400 hover:underline text-sm">← Kayıtlara dön</Link>
      </div>
    </div>
  );

  const { full_name, iban, department, work_records, summary } = detail;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Link to="/" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">← Kayıtlar</Link>
          <h1 className="text-xl sm:text-2xl font-bold text-white mt-2">{full_name}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-400">
            {department && <span>📚 {department}</span>}
            {iban && <span className="font-mono text-xs bg-gray-800 px-2 py-0.5 rounded">{iban}</span>}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: "Toplam Kayıt", value: work_records.length, color: "text-white" },
            { label: "Ödendi",        value: work_records.filter(r => r.payment_status === "Ödendi").length, color: "text-green-400" },
            { label: "Toplam Net",    value: formatTL(summary.total_earned), color: "text-blue-400" },
            { label: "Bekleyen",      value: formatTL(summary.pending_amount), color: summary.pending_count > 0 ? "text-yellow-400" : "text-gray-500" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-3 sm:p-4">
              <p className="text-gray-400 text-xs mb-1">{label}</p>
              <p className={`text-base sm:text-xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-5 flex flex-wrap gap-4 sm:gap-6 text-sm">
          <div>
            <span className="text-gray-500 mr-2">Ödendi:</span>
            <span className="text-green-400 font-semibold">{formatTL(summary.total_paid)}</span>
          </div>
          <div>
            <span className="text-gray-500 mr-2">Ödenmedi ({summary.pending_count}):</span>
            <span className="text-yellow-400 font-semibold">{formatTL(summary.pending_amount)}</span>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-800">
            <h2 className="text-base font-semibold text-white">İş Kayıtları ({work_records.length})</h2>
          </div>
          {work_records.length === 0 ? (
            <div className="p-10 text-center text-gray-500">Kayıt yok.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                    <th className="px-3 sm:px-4 py-3 text-left">No</th>
                    <th className="px-3 sm:px-4 py-3 text-left">Firma</th>
                    <th className="px-3 sm:px-4 py-3 text-left hidden lg:table-cell">Proje</th>
                    <th className="px-3 sm:px-4 py-3 text-left hidden sm:table-cell">İş</th>
                    <th className="px-3 sm:px-4 py-3 text-right">Fatura</th>
                    <th className="px-3 sm:px-4 py-3 text-right hidden sm:table-cell">Net</th>
                    <th className="px-3 sm:px-4 py-3 text-center">Durum</th>
                    <th className="px-3 sm:px-4 py-3 text-center hidden sm:table-cell">Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {work_records.map(r => (
                    <tr key={r.id} className="border-b border-gray-800/40 hover:bg-gray-800/20 transition-colors">
                      <td className="px-3 sm:px-4 py-3 font-mono text-gray-400 text-xs whitespace-nowrap">{r.year}/{r.sira_no}</td>
                      <td className="px-3 sm:px-4 py-3 text-gray-200 text-xs sm:text-sm whitespace-nowrap">{r.firm?.name ?? "—"}</td>
                      <td className="px-3 sm:px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">{r.project?.name ?? "—"}</td>
                      <td className="px-3 sm:px-4 py-3 text-gray-400 max-w-xs truncate hidden sm:table-cell text-xs">{r.work_done || "—"}</td>
                      <td className="px-3 sm:px-4 py-3 text-right font-mono text-xs text-blue-300 whitespace-nowrap">{formatTL(r.invoice_price)}</td>
                      <td className="px-3 sm:px-4 py-3 text-right font-mono text-xs text-indigo-300 whitespace-nowrap hidden sm:table-cell">{formatTL(r.amount_after_withholding)}</td>
                      <td className="px-3 sm:px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.payment_status === "Ödendi"
                            ? "bg-green-900/50 text-green-400 border border-green-800"
                            : "bg-yellow-900/50 text-yellow-400 border border-yellow-800"
                        }`}>{r.payment_status}</span>
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-center text-gray-500 text-xs whitespace-nowrap hidden sm:table-cell">
                        {r.paid_date ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
