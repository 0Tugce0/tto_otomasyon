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
    <div className="min-h-screen bg-custom-bg flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-custom-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-custom-bg flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">⚠</span>
        </div>
        <p className="text-red-600 font-semibold mb-2">Hata</p>
        <p className="text-custom-primary text-sm mb-4">{error}</p>
        <Link to="/" className="text-custom-accent hover:underline text-sm">← Kayıtlara dön</Link>
      </div>
    </div>
  );

  const { full_name, iban, department, work_records, summary } = detail;

  return (
    <div className="min-h-screen bg-custom-bg text-custom-text p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Link to="/" className="text-custom-primary/70 hover:text-custom-text text-sm transition-colors">← Kayıtlar</Link>
          <h1 className="text-xl sm:text-2xl font-bold text-custom-text mt-2">{full_name}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-custom-primary">
            {department && <span>📚 {department}</span>}
            {iban && <span className="font-mono text-xs bg-custom-primary/10 px-2 py-0.5 rounded">{iban}</span>}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: "Toplam Kayıt", value: work_records.length, color: "text-custom-text" },
            { label: "Ödendi",        value: work_records.filter(r => r.payment_status === "Ödendi").length, color: "text-custom-primary" },
            { label: "Toplam Net",    value: formatTL(summary.total_earned), color: "text-custom-accent" },
            { label: "Bekleyen",      value: formatTL(summary.pending_amount), color: summary.pending_count > 0 ? "text-custom-accent" : "text-custom-primary/50" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white border border-custom-primary/15 rounded-xl p-3 sm:p-4">
              <p className="text-custom-primary text-xs mb-1">{label}</p>
              <p className={`text-base sm:text-xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white border border-custom-primary/15 rounded-xl p-4 mb-5 flex flex-wrap gap-4 sm:gap-6 text-sm">
          <div>
            <span className="text-custom-primary/70 mr-2">Ödendi:</span>
            <span className="text-custom-primary font-semibold">{formatTL(summary.total_paid)}</span>
          </div>
          <div>
            <span className="text-custom-primary/70 mr-2">Ödenmedi ({summary.pending_count}):</span>
            <span className="text-custom-accent font-semibold">{formatTL(summary.pending_amount)}</span>
          </div>
        </div>

        <div className="bg-white border border-custom-primary/15 rounded-2xl overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-custom-primary/15">
            <h2 className="text-base font-semibold text-custom-text">İş Kayıtları ({work_records.length})</h2>
          </div>
          {work_records.length === 0 ? (
            <div className="p-10 text-center text-custom-primary/70">Kayıt yok.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-custom-primary/15 text-custom-primary text-xs uppercase tracking-wider">
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
                    <tr key={r.id} className="border-b border-custom-primary/10 hover:bg-custom-primary/5 transition-colors">
                      <td className="px-3 sm:px-4 py-3 font-mono text-custom-primary text-xs whitespace-nowrap">{r.year}/{r.sira_no}</td>
                      <td className="px-3 sm:px-4 py-3 text-custom-text text-xs sm:text-sm whitespace-nowrap">{r.firm?.name ?? "—"}</td>
                      <td className="px-3 sm:px-4 py-3 text-custom-primary/70 text-xs hidden lg:table-cell">{r.project?.name ?? "—"}</td>
                      <td className="px-3 sm:px-4 py-3 text-custom-primary max-w-xs truncate hidden sm:table-cell text-xs">{r.work_done || "—"}</td>
                      <td className="px-3 sm:px-4 py-3 text-right font-mono text-xs text-custom-primary whitespace-nowrap">{formatTL(r.invoice_price)}</td>
                      <td className="px-3 sm:px-4 py-3 text-right font-mono text-xs text-custom-accent whitespace-nowrap hidden sm:table-cell">{formatTL(r.amount_after_withholding)}</td>
                      <td className="px-3 sm:px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.payment_status === "Ödendi"
                            ? "bg-custom-primary/10 text-custom-primary border border-custom-primary/30"
                            : "bg-custom-accent/10 text-custom-accent border border-custom-accent/30"
                        }`}>{r.payment_status}</span>
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-center text-custom-primary/70 text-xs whitespace-nowrap hidden sm:table-cell">
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
