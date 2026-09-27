/**
 * App.jsx — Uygulama routing + global 401 handler
 *
 * Route yapısı:
 *   /login               → Login (public)
 *   /                    → RecordsList (korumalı)
 *   /records/new         → RecordForm (korumalı)
 *   /records/:id/edit    → RecordForm (korumalı)
 *   /academicians/:id    → AcademicianDetail (korumalı)
 *   /firms/:id           → FirmDetail (korumalı)
 *   /settings            → Settings (korumalı)
 *
 * ProtectedRoute: mount'ta GET /api/auth/me → 401 ise /login yönlendir.
 * setUnauthorizedHandler: herhangi bir apiFetch 401 dönerse otomatik /login.
 */

import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useEffect } from "react";

import { setUnauthorizedHandler } from "./lib/api";
import { useToast, ToastContainer } from "./components/Toast";

import Login             from "./pages/Login";
import RecordsList       from "./pages/RecordsList";
import RecordForm        from "./pages/RecordForm";
import AcademicianDetail from "./pages/AcademicianDetail";
import FirmDetail        from "./pages/FirmDetail";
import Settings          from "./pages/Settings";
import ProtectedRoute    from "./components/ProtectedRoute";

/** Global 401 handler — BrowserRouter içinde olması gerekiyor. */
function GlobalHandlers({ showToast }) {
  const navigate = useNavigate();
  useEffect(() => {
    setUnauthorizedHandler(() => {
      showToast("Oturumunuz sona erdi. Lütfen tekrar giriş yapın.", "warning", 6000);
      navigate("/login", { replace: true });
    });
    return () => setUnauthorizedHandler(null);
  }, [navigate, showToast]);
  return null;
}

export default function App() {
  const { toasts, showToast, dismissToast } = useToast();

  return (
    <BrowserRouter>
      <GlobalHandlers showToast={showToast} />

      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />

        {/* Korumalı */}
        <Route path="/" element={
          <ProtectedRoute><RecordsList showToast={showToast} /></ProtectedRoute>
        } />
        <Route path="/records/new" element={
          <ProtectedRoute><RecordForm showToast={showToast} /></ProtectedRoute>
        } />
        <Route path="/records/:id/edit" element={
          <ProtectedRoute><RecordForm showToast={showToast} /></ProtectedRoute>
        } />
        <Route path="/academicians/:id" element={
          <ProtectedRoute><AcademicianDetail showToast={showToast} /></ProtectedRoute>
        } />
        <Route path="/firms/:id" element={
          <ProtectedRoute><FirmDetail showToast={showToast} /></ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute><Settings showToast={showToast} /></ProtectedRoute>
        } />

        {/* Bilinmeyen route → ana sayfa */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Global toast bildirimleri */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </BrowserRouter>
  );
}
