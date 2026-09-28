/**
 * FirmDetail.jsx — apiFetch + showToast + responsive (14.4)
 */
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";

function formatTL(v) {
  if (v == null) return "—";
  return Number(v).toLocaleString("tr-TR", { minimumFractionDigits: 2 }) + " ₺";
}

export default function FirmDetail({ showToast }) {
  const { id } = useParams();
  const [firm, setFirm] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [firmData, recData] = await Promise.all([
          apiFetch(`/api/firms/${id}`),
          apiFetch(`/api/records/?firm_id=${id}&page_size=200`),
        ]);
        setFirm(firmData);
        setRecords(recData?.items ?? []);
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : "Yüklenemedi.";
        if (e?.status !== 401) setError(msg);
      } finally {
        setLoading(false);
      }
    }
    load();
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

  const totalInvoice = records.reduce((s, r) => s + parseFloat(r.invoice_price || 0), 0);
  const totalNet = records.reduce((s, r) => s + parseFloat(r.amount_after_withholding || 0), 0);
  const paidCount = records.filter(r => r.payment_status === "Ödendi").length;

  return (
    <div className="min-h-screen bg-custom-bg text-custom-text p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Link to="/" className="text-custom-primary/70 hover:text-custom-text text-sm transition-colors">← Kayıtlar</Link>
          <h1 className="text-xl sm:text-2xl font-bold text-custom-text mt-2">{firm?.name}</h1>
          <p className="text-custom-primary text-sm mt-1">Firma · ID #{firm?.id}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Toplam Kayıt",   value: records.length,       color: "text-custom-text" },
            { label: "Ödendi",          value: paidCount,            color: "text-custom-primary" },
            { label: "Toplam Fatura",   value: formatTL(totalInvoice), color: "text-custom-primary" },
            { label: "Toplam Net",      value: formatTL(totalNet),   color: "text-custom-accent" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white border border-custom-primary/15 rounded-xl p-3 sm:p-4">
              <p className="text-custom-primary text-xs mb-1">{label}</p>
              <p className={`text-lg sm:text-xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white border border-custom-primary/15 rounded-2xl overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-custom-primary/15">
            <h2 className="text-base font-semibold text-custom-text">İş Kayıtları ({records.length})</h2>
          </div>
          {records.length === 0 ? (
            <div className="p-10 text-center text-custom-primary/70">Bu firmaya ait kayıt yok.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-custom-primary/15 text-custom-primary text-xs uppercase tracking-wider">
                    <th className="px-3 sm:px-4 py-3 text-left">No</th>
                    <th className="px-3 sm:px-4 py-3 text-left">Akademisyen</th>
                    <th className="px-3 sm:px-4 py-3 text-left hidden sm:table-cell">İş</th>
                    <th className="px-3 sm:px-4 py-3 text-right">Fatura</th>
                    <th className="px-3 sm:px-4 py-3 text-right hidden sm:table-cell">Net</th>
                    <th className="px-3 sm:px-4 py-3 text-center">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(r => (
                    <tr key={r.id} className="border-b border-custom-primary/10 hover:bg-custom-primary/5 transition-colors">
                      <td className="px-3 sm:px-4 py-3 font-mono text-custom-primary text-xs whitespace-nowrap">{r.year}/{r.sira_no}</td>
                      <td className="px-3 sm:px-4 py-3 text-custom-text text-xs sm:text-sm">{r.academician?.full_name ?? "—"}</td>
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
