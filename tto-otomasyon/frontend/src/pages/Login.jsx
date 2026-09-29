/**
 * Login.jsx — Giriş sayfası (Stitch tasarımı — modül 1/6)
 *
 * POST /api/auth/login → başarıda / (kayıtlar listesi) yönlendirilir.
 * Hata: generic "Kullanıcı adı/e-posta veya şifre hatalı." mesajı (bilgi sızdırmaz).
 *
 * Tasarım notları (kullanıcıyla netleştirildi):
 * - Material Symbols yerine inline SVG ikonlar (dış CDN bağımlılığı yok — LAN-only mimari).
 * - Plus Jakarta Sans/Inter yerine sistem fontu (Google Fonts'a bağımlı değil).
 * - "Şifremi Unuttum" kaldırıldı — bu sistemde e-posta/SMTP altyapısı yok.
 * - "SSL 256-bit" rozeti kaldırıldı — uygulama düz HTTP üzerinden çalışıyor (README madde 2),
 *   var olmayan bir şifreleme iddiası göstermek yanıltıcı olur.
 * - Logo: Stitch'in geçici önizleme görseli yerine uygulamanın mevcut SVG amblemi kullanıldı.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";

function EmailIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0-.828.672-1.5 1.5-1.5h16.5c.828 0 1.5.672 1.5 1.5v10.5a1.5 1.5 0 01-1.5 1.5H3.75a1.5 1.5 0 01-1.5-1.5V6.75z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75l9.75 6.75 9.75-6.75" />
    </svg>
  );
}

function LockIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V7.5a4.5 4.5 0 10-9 0v3M6 10.5h12a1.5 1.5 0 011.5 1.5v7.5a1.5 1.5 0 01-1.5 1.5H6a1.5 1.5 0 01-1.5-1.5V12A1.5 1.5 0 016 10.5z" />
    </svg>
  );
}

function EyeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function EyeOffIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
    </svg>
  );
}

function CheckIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ArrowRightIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  );
}

function ErrorIcon(props) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
    </svg>
  );
}

const RAISED_SHADOW = "shadow-[10px_10px_24px_rgba(0,0,0,0.08),-10px_-10px_24px_rgba(255,255,255,0.7)]";
const INSET_SHADOW = "shadow-[inset_4px_4px_8px_rgba(0,0,0,0.06),inset_-4px_-4px_8px_rgba(255,255,255,0.5)]";

export default function Login() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ identifier, password, remember_me: rememberMe }),
      });

      if (res.ok) {
        navigate("/", { replace: true });
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "Kullanıcı adı/e-posta veya şifre hatalı.");
      }
    } catch {
      setError("Sunucuya bağlanılamadı. Backend çalışıyor mu?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="w-full min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="flex flex-col w-full items-center justify-center py-6 px-4">
        <div className={`w-full max-w-[460px] bg-surface rounded-[28px] p-8 md:p-10 flex flex-col items-center transition-all duration-300 ${RAISED_SHADOW}`}>
          {/* Logo / başlık */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className={`p-3 rounded-2xl mb-4 bg-surface ${RAISED_SHADOW}`}>
              <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
                <svg className="w-7 h-7 text-on-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-on-surface mt-2">
              TTO Portalı Giriş Yap
            </h1>
            <p className="text-xs text-on-surface-variant mt-2 max-w-[340px] leading-relaxed">
              Üniversite Sanayi İşbirliği, Yapılan İşler ve Ödeme Yönetim Sistemi
            </p>
          </div>

          <form onSubmit={handleSubmit} className="w-full flex flex-col space-y-5">
            {/* Hata mesajı */}
            {error && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-error-container text-on-error-container text-sm">
                <ErrorIcon className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Kullanıcı adı / e-posta */}
            <div className="flex flex-col space-y-2">
              <label className="text-xs font-semibold text-on-surface-variant flex items-center justify-between" htmlFor="identifier">
                <span>Kullanıcı Adı veya E-Posta</span>
                <span className="text-[10px] text-primary/80 font-normal">Kurumsal Kimlik</span>
              </label>
              <div className={`relative w-full rounded-2xl bg-surface flex items-center transition-all duration-200 ${INSET_SHADOW}`}>
                <EmailIcon className="text-secondary ml-4 w-5 h-5 select-none" />
                <input
                  id="identifier"
                  type="text"
                  required
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full bg-transparent px-3.5 py-3.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/50 rounded-2xl"
                  placeholder="kullanıcı adı veya e-posta"
                />
              </div>
            </div>

            {/* Şifre */}
            <div className="flex flex-col space-y-2">
              <label className="text-xs font-semibold text-on-surface-variant" htmlFor="password">Şifre</label>
              <div className={`relative w-full rounded-2xl bg-surface flex items-center transition-all duration-200 ${INSET_SHADOW}`}>
                <LockIcon className="text-secondary ml-4 w-5 h-5 select-none" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent px-3.5 py-3.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/50 rounded-2xl pr-12"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  aria-label="Şifreyi Göster veya Gizle"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3.5 p-1 rounded-lg text-secondary hover:text-on-surface transition-colors flex items-center justify-center focus:outline-none"
                >
                  {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Beni Hatırla */}
            <div className="flex items-center pt-1">
              <label className="flex items-center space-x-3 cursor-pointer group select-none">
                <div className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <div className={`w-5 h-5 rounded-md bg-surface transition-all duration-200 peer-checked:bg-primary flex items-center justify-center ${INSET_SHADOW}`}>
                    <CheckIcon className={`text-on-primary w-4 h-4 transition-opacity ${rememberMe ? "opacity-100" : "opacity-0"}`} />
                  </div>
                </div>
                <span className="text-xs text-on-surface-variant font-medium group-hover:text-on-surface transition-colors">Beni Hatırla</span>
              </label>
            </div>

            {/* Submit */}
            <div className="pt-2">
              <button
                id="login-submit"
                type="submit"
                disabled={loading}
                className={`w-full py-3.5 px-6 rounded-2xl bg-primary text-on-primary font-semibold text-sm flex items-center justify-center space-x-2 transition-all duration-200 active:scale-[0.99] group focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed shadow-[5px_5px_12px_rgba(99,102,241,0.35),-5px_-5px_12px_rgba(255,255,255,0.7)]`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Giriş yapılıyor…</span>
                  </span>
                ) : (
                  <>
                    <span>Sisteme Giriş Yap</span>
                    <ArrowRightIcon className="w-[18px] h-[18px] group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-8 pt-5 text-center flex flex-col items-center">
            <div className="flex items-center space-x-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="text-[11px] text-on-surface-variant/80 tracking-wide font-normal">
              © 2026 TTO Otomasyonu · Yerel ağ kullanımına özel
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
