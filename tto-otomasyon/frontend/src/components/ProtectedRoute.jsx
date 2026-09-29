/**
 * ProtectedRoute.jsx
 *
 * Her korumalı sayfanın mount'unda GET /api/auth/me çağırır.
 * - 200 → kullanıcı oturum açmış, children render edilir
 * - 401 → /login'e yönlendirilir
 * - Yüklenirken boş ekran (spinner) gösterilir
 */

import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const [status, setStatus] = useState("loading"); // "loading" | "ok" | "unauthorized"

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => {
        if (cancelled) return;
        setStatus(res.ok ? "ok" : "unauthorized");
      })
      .catch(() => {
        if (!cancelled) setStatus("unauthorized");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-on-surface-variant text-sm">Oturum kontrol ediliyor…</p>
        </div>
      </div>
    );
  }

  if (status === "unauthorized") {
    return <Navigate to="/login" replace />;
  }

  return children;
}
