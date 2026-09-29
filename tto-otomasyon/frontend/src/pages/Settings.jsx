/**
 * Settings.jsx — Sistem ve Finansal Parametre Ayarları (Stitch tasarımı — modül 6/6)
 *
 * Tasarımdan bilinçli sapmalar (raporda açıklandı, sessizce yapılmadı):
 * - "Ar-Ge Fonu / Altyapı Kesintisi" (%5, "BAP Payı") → KALDIRILDI. settings
 *   tablosunda böyle bir oran/kesinti yok; eklemek core/calculations.py'deki
 *   5 adımlık doğrulanmış zincire otomatik bir 3. kesinti eklemek anlamına
 *   gelir — bu, modül 2'de "mevcut motoru koru, yeni otomatik kesinti
 *   ekleme" kararıyla doğrudan çelişir. Onun yerine var olan ama Stitch
 *   taslağında hiç görünmeyen GERÇEK 4. oran (Fatura Tevkifatı) eklendi
 *   — calculate_all() bu alanı zorunlu olarak kullanıyor, atlanamaz.
 * - "İstisna Durumları / Vergi İstisnası Uygula" global anahtarı →
 *   KALDIRILDI. KDV muafiyeti sistemde zaten VAR ama kayıt bazında elle
 *   (is_manually_adjusted ile invoice_vat=0 girilerek) yönetiliyor —
 *   global bir "%0 stopaj" anahtarı otomatik hesaplama mantığını
 *   değiştirir, bu da aynı "motoru koruma" kararına aykırı olurdu. Onun
 *   yerine bu gerçek davranışı açıklayan bilgi notu eklendi.
 * - "Otomatik Hesaplama Kuralları" → checkbox/toggle DEĞİL, salt bilgi
 *   kartına çevrildi: sistemde hesaplama sırası zaten sabit tek bir
 *   zincirdir (yapılandırılabilir değil), bunu tıklanabilir bir "kural"
 *   gibi göstermek yanıltıcı olurdu. "Asgari ücret vergi istisnası"
 *   kuralı tamamen kaldırıldı — böyle bir mantık sistemde yok.
 * - "Bildirim & Entegrasyon" bölümü (Vade Uyarısı, SAP/Luca ERP
 *   entegrasyonu) → TAMAMEN KALDIRILDI. Bu uygulamanın hiçbir bildirim/
 *   e-posta/harici entegrasyon altyapısı yok (LAN-only, bkz. README).
 * - "Değişiklikler... sistem loglarında saklanır" iddiası → kaldırıldı,
 *   böyle bir audit-log sistemi yok.
 * - "Varsayılan Parametrelere Dön" GERÇEK: formu (henüz kaydedilmemiş)
 *   varsayılan oranlara sıfırlar — kaydetmek için hâlâ "Kaydet" gerekir.
 * - Sağdaki "Kesinti Dağılım Modeli" donut'u GERÇEK: formdaki (henüz
 *   kaydedilmemiş) oranlarla core/calculations.py'deki AYNI formülü
 *   100.000 TL üzerinden anlık simüle eder — DB'ye yazmaz, backend'e
 *   istek atmaz, salt önizleme.
 */

import { useState, useEffect, useMemo } from "react";
import { apiFetch, ApiError } from "../lib/api";
import AppShell from "../components/AppShell";
import {
  PercentIcon, CalculatorIcon, HistoryIcon, CheckCircleIcon, PieChartIcon,
  PlusCircleIcon, LockIcon, InfoIcon,
} from "../components/icons";

const CARD = "rounded-2xl bg-surface shadow-[6px_6px_14px_rgba(0,0,0,0.06),-6px_-6px_14px_rgba(255,255,255,0.75)]";
const INSET = "shadow-[inset_3px_3px_6px_rgba(0,0,0,0.06),inset_-3px_-3px_6px_rgba(255,255,255,0.7)]";
const INSET_SOFT = "shadow-[4px_4px_10px_rgba(0,0,0,0.03),-4px_-4px_10px_rgba(255,255,255,0.6)]";
const RAISED = "shadow-[4px_4px_10px_rgba(0,0,0,0.05),-4px_-4px_10px_rgba(255,255,255,0.7)]";

const RATE_FIELDS = [
  { key: "tto_share_rate", label: "Üniversite / TTO Kurum Payı Oranı", badge: "Zorunlu", badgeColor: "text-on-surface-variant",
    hint: "Sözleşme bedelinden doğrudan üniversite bünyesine aktarılır." },
  { key: "invoice_withholding_rate", label: "Fatura Tevkifat Oranı (KDV Üzerinden)", badge: "KDV × Oran", badgeColor: "text-on-surface-variant",
    hint: "Faturaya eklenen tevkifat, KDV tutarının bu oranı olarak hesaplanır." },
  { key: "withholding_rate", label: "Stopaj / Gelir Vergisi Oranı", badge: "Varsayılan", badgeColor: "text-primary",
    hint: "GVK Madde 94 uyarınca serbest meslek kazancı stopaj oranı." },
  { key: "vat_rate", label: "Standart KDV Oranı", badge: "3065 SK", badgeColor: "text-on-surface-variant",
    hint: "TTO tarafından düzenlenen faturalara uygulanan genel KDV." },
];

const DEFAULT_RATES_PCT = { tto_share_rate: "15", withholding_rate: "20", vat_rate: "20", invoice_withholding_rate: "10" };
const EMPTY_FORM = { valid_year: new Date().getFullYear() + 1, ...DEFAULT_RATES_PCT };

function toPct(decimalStr) {
  const n = parseFloat(decimalStr);
  return isFinite(n) ? String(Math.round(n * 100)) : "";
}
function toDecimal(pctStr) {
  const n = parseFloat(pctStr);
  return isFinite(n) ? (n / 100).toFixed(2) : "0.00";
}
function fmtTL(n) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " ₺";
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
      const list = data ?? [];
      setSettings(list);
      // Varsayılan olarak en güncel yılı seçili getir (varsa)
      if (list.length > 0 && editId === null) {
        const latest = [...list].sort((a, b) => b.valid_year - a.valid_year)[0];
        selectYear(latest);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status !== 401) showToast?.(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchSettings(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function selectYear(s) {
    setEditId(s.id);
    setForm({
      valid_year: s.valid_year,
      tto_share_rate: toPct(s.tto_share_rate),
      withholding_rate: toPct(s.withholding_rate),
      vat_rate: toPct(s.vat_rate),
      invoice_withholding_rate: toPct(s.invoice_withholding_rate),
    });
  }

  function startNew() {
    setEditId(null);
    const latestYear = settings.length ? Math.max(...settings.map(s => s.valid_year)) : new Date().getFullYear();
    setForm({ ...EMPTY_FORM, valid_year: latestYear + 1 });
  }

  function revertToDefaults() {
    setForm(f => ({ ...f, ...DEFAULT_RATES_PCT }));
    showToast?.("Oranlar varsayılana sıfırlandı (henüz kaydedilmedi).", "info");
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const payload = {
        valid_year: parseInt(form.valid_year),
        tto_share_rate: toDecimal(form.tto_share_rate),
        withholding_rate: toDecimal(form.withholding_rate),
        vat_rate: toDecimal(form.vat_rate),
        invoice_withholding_rate: toDecimal(form.invoice_withholding_rate),
      };
      const url = editId ? `/api/settings/${editId}` : "/api/settings/";
      const method = editId ? "PUT" : "POST";
      const saved = await apiFetch(url, { method, body: JSON.stringify(payload) });
      showToast?.(editId ? "Oranlar güncellendi." : "Yeni yıl oranı eklendi.", "success");
      const data = await apiFetch("/api/settings/");
      setSettings(data ?? []);
      selectYear(saved);
    } catch (e) {
      if (e instanceof ApiError && e.status !== 401) showToast?.(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  // Kesinti Dağılım Modeli — canlı önizleme (core/calculations.py ile AYNI formül, 100.000 TL baz)
  const simulation = useMemo(() => {
    const base = 100000;
    const ttoRate = (parseFloat(form.tto_share_rate) || 0) / 100;
    const withholdingRate = (parseFloat(form.withholding_rate) || 0) / 100;
    const ttoAmount = base * ttoRate;
    const afterTto = base - ttoAmount;
    const netAmount = afterTto * (1 - withholdingRate);
    const stopajAmount = afterTto - netAmount;
    return {
      base,
      net: netAmount, netPct: Math.round((netAmount / base) * 100),
      tto: ttoAmount, ttoPct: Math.round((ttoAmount / base) * 100),
      stopaj: stopajAmount, stopajPct: Math.round((stopajAmount / base) * 100),
    };
  }, [form.tto_share_rate, form.withholding_rate]);

  const circumference = 301.6;
  const netDash = (simulation.netPct / 100) * circumference;
  const ttoDash = (simulation.ttoPct / 100) * circumference;
  const stopajDash = (simulation.stopajPct / 100) * circumference;

  const content = (
    <div className="flex flex-col w-full gap-8">
      {/* Başlık */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest font-semibold text-primary">Yönetim Konsolu</span>
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span className="text-xs text-on-surface-variant font-medium">Finans &amp; Mevzuat Modülü</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold text-on-surface tracking-tight">Sistem ve Finansal Parametre Ayarları</h1>
          <p className="text-sm text-on-surface-variant max-w-2xl">Yıl bazında TTO payı oranları, stopaj ve yasal kesinti parametrelerinin yapılandırılması</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={revertToDefaults}
            className={`px-5 py-2.5 rounded-xl bg-surface text-secondary hover:text-on-surface font-medium text-xs ${RAISED} transition-all flex items-center gap-2`}>
            <HistoryIcon className="w-[18px] h-[18px]" />
            <span>Varsayılan Parametrelere Dön</span>
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className={`px-6 py-2.5 rounded-xl bg-surface text-primary font-semibold text-xs shadow-[5px_5px_12px_rgba(99,102,241,0.22),-5px_-5px_12px_rgba(255,255,255,0.9)] transition-all flex items-center gap-2 disabled:opacity-50`}>
            <CheckCircleIcon className="w-[18px] h-[18px]" />
            <span>{saving ? "Kaydediliyor…" : "Değişiklikleri Kaydet"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* SOL SÜTUN */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          {/* 1. Yıl Bazlı Finansal Oranlar */}
          <section className={`p-6 md:p-8 ${CARD} flex flex-col gap-6`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-surface ${INSET} flex items-center justify-center text-primary`}>
                  <PercentIcon className="w-[22px] h-[22px]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-on-surface">Yıl Bazlı Finansal Oranlar</h2>
                  <p className="text-xs text-on-surface-variant">Kesinti matrahı ve resmi pay oranları katsayıları</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`flex items-center p-1.5 rounded-xl bg-surface ${INSET} gap-1 flex-wrap`}>
                  {settings.map(s => (
                    <button key={s.id} type="button" onClick={() => selectYear(s)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        editId === s.id ? `text-primary bg-surface ${RAISED}` : "text-on-surface-variant hover:text-on-surface font-medium"
                      }`}>
                      {s.valid_year}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={startNew}
                  className={`p-2 rounded-xl bg-surface text-primary ${RAISED} hover:opacity-90 transition-all`}
                  title="Yeni Dönem / Yıl Tanımla">
                  <PlusCircleIcon className="w-[18px] h-[18px]" />
                </button>
              </div>
            </div>

            {!editId && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-on-surface-variant">Yeni Yıl:</label>
                <input type="number" value={form.valid_year}
                  onChange={e => setForm(f => ({ ...f, valid_year: e.target.value }))}
                  className={`w-24 h-9 px-3 text-sm font-semibold text-on-surface bg-surface rounded-lg ${INSET} focus:outline-none`} />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
              {RATE_FIELDS.map(({ key, label, badge, badgeColor, hint }) => (
                <div key={key} className={`flex flex-col gap-2 p-4 rounded-xl bg-surface ${INSET_SOFT}`}>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-on-surface" htmlFor={key}>{label}</label>
                    <span className={`text-[10px] ${badgeColor} bg-surface px-2 py-0.5 rounded-md shadow-[inset_1px_1px_3px_rgba(0,0,0,0.05),inset_-1px_-1px_3px_rgba(255,255,255,0.6)]`}>{badge}</span>
                  </div>
                  <div className="relative flex items-center">
                    <input id={key} type="number" step="1" min="0" max="100" required
                      value={form[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      className={`w-full h-11 px-4 pr-10 text-sm font-semibold text-on-surface bg-surface rounded-xl ${INSET} focus:outline-none focus:text-primary transition-all`} />
                    <span className="absolute right-4 text-xs font-bold text-on-surface-variant pointer-events-none">%</span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant leading-tight">{hint}</p>
                </div>
              ))}
            </div>

            {/* KDV muafiyeti — gerçek davranış notu (global anahtar değil) */}
            <div className={`mt-2 p-5 rounded-xl bg-surface ${INSET} flex items-start gap-3.5`}>
              <div className={`w-9 h-9 rounded-xl bg-surface ${RAISED} flex items-center justify-center text-tertiary shrink-0`}>
                <InfoIcon className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-on-surface">KDV İstisnası (Teknokent / İhracat vb.) Kayıt Bazında Uygulanır</span>
                <span className="text-[11px] text-on-surface-variant mt-1 leading-relaxed">
                  Burada yıl geneli için bir istisna anahtarı yok — istisnai bir fatura girildiğinde,
                  "Yeni Kayıt" formunda ilgili kaydın KDV/tevkifat alanları elle sıfırlanıp not düşülür
                  (yalnızca o kayıt için, genel oranlar değişmez).
                </span>
              </div>
            </div>
          </section>

          {/* 2. Hesaplama Mantığı — bilgi amaçlı, yapılandırılabilir değil */}
          <section className={`p-6 md:p-8 ${CARD} flex flex-col gap-6`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-surface ${INSET} flex items-center justify-center text-primary`}>
                <CalculatorIcon className="w-[22px] h-[22px]" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-on-surface">Hesaplama Sırası</h2>
                <p className="text-xs text-on-surface-variant">Sabit zincir — yıl bazında yalnızca yukarıdaki oranlar değişir, sıralama değişmez</p>
              </div>
            </div>
            <div className={`flex items-start gap-4 p-4 rounded-xl bg-surface ${INSET_SOFT}`}>
              <div className={`w-8 h-8 rounded-lg bg-surface ${INSET} flex items-center justify-center text-primary shrink-0 mt-0.5`}>
                <CheckCircleIcon className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-on-surface">Fatura KDV → TTO Payı → TTO Payı Sonrası Tutar → Stopaj → Akademisyene Net</span>
                <span className="text-[11px] text-on-surface-variant mt-0.5">
                  KDV hariç tutardan önce TTO payı düşülür, stopaj bu düşülmüş tutar üzerinden hesaplanır
                  (Excel'den doğrulanmış, tüm yıllarda aynı formül).
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* SAĞ SÜTUN */}
        <div className="lg:col-span-4 flex flex-col gap-8">
          {/* Kesinti Dağılım Modeli — canlı simülasyon */}
          <div className={`p-6 ${CARD} flex flex-col gap-5`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PieChartIcon className="text-primary w-5 h-5" />
                <h3 className="text-xs font-semibold text-on-surface uppercase tracking-wider">Kesinti Dağılım Modeli</h3>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full bg-surface text-primary ${RAISED} font-semibold`}>{fmtTL(simulation.base)} Baz</span>
            </div>
            <div className="relative flex items-center justify-center py-2">
              <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" fill="none" r="48" stroke="#d6d8de" strokeWidth="12" />
                <circle cx="60" cy="60" fill="none" r="48" stroke="#6366f1" strokeDasharray={`${netDash} ${circumference}`} strokeLinecap="round" strokeWidth="12" />
                <circle cx="60" cy="60" fill="none" r="48" stroke="#7c3aed" strokeDasharray={`${ttoDash} ${circumference}`} strokeDashoffset={-netDash} strokeLinecap="round" strokeWidth="12" />
                <circle cx="60" cy="60" fill="none" r="48" stroke="#8a8c9a" strokeDasharray={`${stopajDash} ${circumference}`} strokeDashoffset={-(netDash + ttoDash)} strokeLinecap="round" strokeWidth="12" />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-base font-bold text-on-surface">%{simulation.netPct}</span>
                <span className="text-[10px] text-on-surface-variant font-medium">Net Hakediş</span>
              </div>
            </div>
            <div className="flex flex-col gap-2.5 pt-2">
              <SimRow color="bg-primary" label="Net Akademisyen Payı" value={fmtTL(simulation.net)} />
              <SimRow color="bg-tertiary" label={`TTO Kurum Payı (%${simulation.ttoPct})`} value={fmtTL(simulation.tto)} />
              <SimRow color="bg-outline" label={`Stopaj (%${simulation.stopajPct})`} value={fmtTL(simulation.stopaj)} />
            </div>
            <p className="text-[10px] text-on-surface-variant leading-relaxed pt-1">
              Bu, formdaki (henüz kaydedilmemiş) oranlarla yapılan bir önizlemedir — kaydetmeden hiçbir şey değişmez.
            </p>
          </div>

          {/* Denetim / güvenlik bilgisi */}
          <div className={`p-4 rounded-xl bg-surface ${INSET} flex items-center gap-3`}>
            <LockIcon className="text-on-surface-variant w-5 h-5 shrink-0" />
            <span className="text-[11px] text-on-surface-variant leading-tight">
              Değiştirilen parametreler kaydedildiği andan itibaren, o yıl için yapılan tüm yeni hakediş
              hesaplamalarında (Yeni Kayıt formundaki önizleme dahil) kullanılır.
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <AppShell activePath="ayarlar">
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    );
  }

  return <AppShell activePath="ayarlar">{content}</AppShell>;
}

function SimRow({ color, label, value }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
        <span className="text-on-surface-variant">{label}</span>
      </div>
      <span className="font-semibold text-on-surface">{value}</span>
    </div>
  );
}
