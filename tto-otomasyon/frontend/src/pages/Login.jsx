/**
 * Login.jsx — Giriş sayfası
 *
 * POST /api/auth/login → başarıda / (kayıtlar listesi) yönlendirilir.
 * Hata: generic "Kullanıcı adı veya şifre hatalı." mesajı (bilgi sızdırmaz).
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        navigate("/", { replace: true });
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "Kullanıcı adı veya şifre hatalı.");
      }
    } catch {
      setError("Sunucuya bağlanılamadı. Backend çalışıyor mu?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-custom-bg">
      {/* Arka plan degrade glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-custom-secondary opacity-25 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-custom-accent opacity-20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md px-6">
        {/* Logo / başlık */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-custom-primary mb-4 shadow-lg shadow-custom-primary/30">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-custom-text tracking-tight">TTO Otomasyonu</h1>
          <p className="text-custom-primary text-sm mt-1">Yapılan İşler ve Ödemeler Yönetimi</p>
        </div>

        {/* Form kartı */}
        <div className="bg-white border border-custom-primary/15 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-lg font-semibold text-custom-text mb-6">Giriş Yap</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Hata mesajı */}
            {error && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            {/* Kullanıcı adı */}
            <div>
              <label htmlFor="login-username" className="block text-sm font-medium text-custom-text/80 mb-2">
                Kullanıcı Adı
              </label>
              <input
                id="login-username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-custom-primary/5 border border-custom-primary/25 rounded-xl text-custom-text placeholder-custom-primary/50 focus:outline-none focus:border-custom-primary focus:ring-1 focus:ring-custom-primary transition-colors"
                placeholder="kullanıcı adı"
              />
            </div>

            {/* Şifre */}
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-custom-text/80 mb-2">
                Şifre
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-custom-primary/5 border border-custom-primary/25 rounded-xl text-custom-text placeholder-custom-primary/50 focus:outline-none focus:border-custom-primary focus:ring-1 focus:ring-custom-primary transition-colors"
                placeholder="••••••••"
              />
            </div>

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-custom-primary hover:bg-custom-accent disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-custom-primary focus:ring-offset-2 focus:ring-offset-white shadow-lg shadow-custom-primary/20"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Giriş yapılıyor…
                </span>
              ) : (
                "Giriş Yap"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-custom-primary/50 text-xs mt-6">
          TTO Otomasyonu v1.0 · Yerel ağ kullanımına özel
        </p>
      </div>
    </div>
  );
}
