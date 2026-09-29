/**
 * EditAcademicianModal.jsx — Akademisyen bilgilerini düzenleme/oluşturma modalı
 * (Stitch modül 4 — "Düzenle" butonu; modül 5 — "Yeni Akademisyen").
 * academician={id:...} verilirse düzenleme (PUT), null/undefined verilirse
 * yeni kayıt (POST) modu — her ikisi de var olan endpoint'leri kullanır.
 */

import { useState, useEffect } from "react";
import { XIcon, EditIcon, PlusCircleIcon } from "./icons";

const INSET = "shadow-[inset_3px_3px_6px_rgba(0,0,0,0.06),inset_-3px_-3px_6px_rgba(255,255,255,0.6)]";
const RAISED = "shadow-[3px_3px_6px_rgba(0,0,0,0.05),-3px_-3px_6px_rgba(255,255,255,0.6)]";

export default function EditAcademicianModal({ open, academician, onClose, onSave }) {
  const isCreate = !academician?.id;
  const [fullName, setFullName] = useState("");
  const [iban, setIban] = useState("");
  const [faculty, setFaculty] = useState("");
  const [department, setDepartment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setFullName(academician?.full_name ?? "");
    setIban(academician?.iban ?? "");
    setFaculty(academician?.faculty ?? "");
    setDepartment(academician?.department ?? "");
    setError("");
  }, [academician, open]);

  if (!open) return null;

  async function handleSave() {
    const trimmed = fullName.trim();
    if (!trimmed) {
      setError("Ad soyad boş olamaz.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        full_name: trimmed,
        iban: iban.trim() || null,
        faculty: faculty.trim() || null,
        department: department.trim() || null,
      });
      onClose();
    } catch (e) {
      setError(e?.message || "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/20 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-surface shadow-[10px_10px_30px_rgba(0,0,0,0.12),-10px_-10px_30px_rgba(255,255,255,0.8)] p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            {isCreate ? <PlusCircleIcon className="text-primary w-5 h-5" /> : <EditIcon className="text-primary w-5 h-5" />}
            <h3 className="text-base font-semibold text-on-surface">{isCreate ? "Yeni Akademisyen Ekle" : "Akademisyen Bilgilerini Düzenle"}</h3>
          </div>
          <button type="button" onClick={onClose}
            className={`w-8 h-8 rounded-xl bg-surface ${RAISED} flex items-center justify-center text-on-surface-variant hover:text-on-surface`}>
            <XIcon className="w-[18px] h-[18px]" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-semibold text-on-surface">Ad Soyad</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} type="text"
              className={`mt-1 w-full px-3.5 py-2.5 rounded-xl bg-surface ${INSET} text-xs text-on-surface focus:outline-none`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-on-surface">Fakülte</label>
              <input value={faculty} onChange={(e) => setFaculty(e.target.value)} type="text"
                className={`mt-1 w-full px-3.5 py-2.5 rounded-xl bg-surface ${INSET} text-xs text-on-surface focus:outline-none`}
                placeholder="Örn: Mühendislik Fakültesi" />
            </div>
            <div>
              <label className="text-xs font-semibold text-on-surface">Bölüm</label>
              <input value={department} onChange={(e) => setDepartment(e.target.value)} type="text"
                className={`mt-1 w-full px-3.5 py-2.5 rounded-xl bg-surface ${INSET} text-xs text-on-surface focus:outline-none`} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-on-surface">IBAN</label>
            <input value={iban} onChange={(e) => setIban(e.target.value)} type="text"
              className={`mt-1 w-full px-3.5 py-2.5 rounded-xl bg-surface ${INSET} text-xs font-mono text-on-surface focus:outline-none`}
              placeholder="TR00 …" />
          </div>
          {error && <p className="text-xs text-error">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 mt-2">
          <button type="button" onClick={onClose} disabled={saving}
            className={`px-4 py-2 rounded-xl bg-surface ${RAISED} text-xs font-medium text-on-surface-variant hover:text-on-surface disabled:opacity-50`}>
            İptal
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className={`px-5 py-2 rounded-xl bg-surface ${RAISED} text-xs font-semibold text-primary disabled:opacity-50`}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}
