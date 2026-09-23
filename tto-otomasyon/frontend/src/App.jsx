/**
 * App.jsx — Uygulama routing iskeleti
 *
 * Şartname madde 7'deki tüm sayfalar react-router-dom v7 ile tanımlandı.
 * Henüz gerçek içerik yok — adım 14'te doldurulacak.
 *
 * Route yapısı:
 *   /login                   → Login (public)
 *   /                        → RecordsList (korumalı — ana sayfa)
 *   /records/new             → RecordForm (yeni kayıt)
 *   /records/:id/edit        → RecordForm (düzenleme)
 *   /academicians/:id        → AcademicianDetail
 *   /firms/:id               → FirmDetail
 *   /settings                → Settings
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import Login from './pages/Login'
import RecordsList from './pages/RecordsList'
import RecordForm from './pages/RecordForm'
import AcademicianDetail from './pages/AcademicianDetail'
import FirmDetail from './pages/FirmDetail'
import Settings from './pages/Settings'

export default function App() {
  return (
    // Tailwind bg-blue-500 sınıfı — build çıktısında CSS üretildiğini doğrulamak için.
    // (adım 14'te gerçek layout ile değiştirilecek)
    <div className="min-h-screen bg-gray-50">
      <BrowserRouter>
        <Routes>
          {/* Public route */}
          <Route path="/login" element={<Login />} />

          {/* Korumalı route'lar — adım 14'te ProtectedRoute HOC eklenecek */}
          <Route path="/" element={<RecordsList />} />
          <Route path="/records/new" element={<RecordForm />} />
          <Route path="/records/:id/edit" element={<RecordForm />} />
          <Route path="/academicians/:id" element={<AcademicianDetail />} />
          <Route path="/firms/:id" element={<FirmDetail />} />
          <Route path="/settings" element={<Settings />} />

          {/* Bilinmeyen route'lar ana sayfaya yönlendir */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  )
}
