/**
 * QuickAddFirmModal.jsx — "Hızlı Firma Kaydı" / "Firma Bilgilerini Düzenle" modalı
 * (Stitch modül 2 — oluşturma; modül 5 — düzenleme).
 *
 * SearchableCreatableSelect'in satır-içi "+ yeni ekle" akışından farklı
 * olarak, firma adının yanı sıra Vergi No/TCKN, Vergi Dairesi ve irtibat
 * e-postasını da toplar (firms.tax_no/tax_office/contact_email).
 * firm={id:...} verilirse düzenleme (PUT) modu, aksi halde yeni kayıt (POST).
 */

import { useState, useEffect } from "react";
import { DomainAddIcon, EditIcon, XIcon } from "./icons";

const INSET = "shadow-[inset_3px_3px_6px_rgba(0,0,0,0.06),inset_-3px_-3px_6px_rgba(255,255,255,0.6)]";
const RAISED = "shadow-[3px_3px_6px_rgba(0,0,0,0.05),-3px_-3px_6px_rgba(255,255,255,0.6)]";

export default function QuickAddFirmModal({ open, firm, onClose, onSave }) {
  const isEdit = !!firm?.id;
  const [name, setName] = useState("");
  const [taxNo, setTaxNo] = useState("");
  const [taxOffice, setTaxOffice] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(firm?.name ?? "");
    setTaxNo(firm?.tax_no ?? "");
    setTaxOffice(firm?.tax_office ?? "");
    setContactEmail(firm?.contact_email ?? "");
    setError("");
  }, [firm, open]);

  if (!open) return null;

  function reset() {
    setName(""); setTaxNo(""); setTaxOffice(""); setContactEmail(""); setError("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Lütfen firma ünvanı giriniz.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        name: trimmed,
        tax_no: taxNo.trim() || null,
        tax_office: taxOffice.trim() || null,
        contact_email: contactEmail.trim() || null,
      });
      reset();
      onClose();
    } catch (e) {
      setError(e?.message || "Firma kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/20 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-surface shadow-[10px_10px_30px_rgba(0,0,0,0.12),-10px_-10px_30px_rgba(255,255,255,0.8)] p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            {isEdit ? <EditIcon className="text-primary w-5 h-5" /> : <DomainAddIcon className="text-primary w-[22px] h-[22px]" />}
            <h3 className="text-base font-semibold text-on-surface">{isEdit ? "Firma Bilgilerini Düzenle" : "Hızlı Firma Kaydı"}</h3>
          </div>
          <button type="button" onClick={handleClose}
            className={`w-8 h-8 rounded-xl bg-surface ${RAISED} flex items-center justify-center text-on-surface-variant hover:text-on-surface`}>
            <XIcon className="w-[18px] h-[18px]" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-semibold text-on-surface">Firma Resmi Ünvanı</label>
            <input value={name} onChange={(e) => setName(e.target.value)} type="text"
              className={`mt-1 w-full px-3.5 py-2.5 rounded-xl bg-surface ${INSET} text-xs text-on-surface focus:outline-none`}
              placeholder="Örn: Baykar Makina Sanayi ve Tic. A.Ş." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-on-surface">Vergi No / TCKN</label>
              <input value={taxNo} onChange={(e) => setTaxNo(e.target.value)} maxLength={11} type="text"
                className={`mt-1 w-full px-3.5 py-2.5 rounded-xl bg-surface ${INSET} text-xs font-mono text-on-surface focus:outline-none`}
                placeholder="10 haneli VKN" />
            </div>
            <div>
              <label className="text-xs font-semibold text-on-surface">Vergi Dairesi</label>
              <input value={taxOffice} onChange={(e) => setTaxOffice(e.target.value)} type="text"
                className={`mt-1 w-full px-3.5 py-2.5 rounded-xl bg-surface ${INSET} text-xs text-on-surface focus:outline-none`}
                placeholder="Örn: Maslak V.D." />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-on-surface">İlgili İrtibat Kişisi / E-posta</label>
            <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} type="email"
              className={`mt-1 w-full px-3.5 py-2.5 rounded-xl bg-surface ${INSET} text-xs text-on-surface focus:outline-none`}
              placeholder="proje@firma.com" />
          </div>
          {error && <p className="text-xs text-error">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 mt-2">
          <button type="button" onClick={handleClose} disabled={saving}
            className={`px-4 py-2 rounded-xl bg-surface ${RAISED} text-xs font-medium text-on-surface-variant hover:text-on-surface disabled:opacity-50`}>
            İptal
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className={`px-5 py-2 rounded-xl bg-surface ${RAISED} text-xs font-semibold text-primary hover:text-primary-container disabled:opacity-50`}>
            {saving ? "Kaydediliyor…" : isEdit ? "Kaydet" : "Firmayı Ekle ve Seç"}
          </button>
        </div>
      </div>
    </div>
  );
}
