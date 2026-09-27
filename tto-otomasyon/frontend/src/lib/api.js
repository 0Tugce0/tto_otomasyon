/**
 * lib/api.js — Merkezi fetch yardımcısı
 *
 * Tüm API çağrıları bu modül üzerinden yapılır:
 * - 401 → otomatik /login yönlendirme + "oturumunuz sona erdi" mesajı
 * - 422 Pydantic validation hataları → okunabilir Türkçe mesaja çevirme
 * - Ağ hatası → anlamlı mesaj
 *
 * Kullanım:
 *   import { apiFetch } from '../lib/api';
 *   const data = await apiFetch('/api/records/', { method: 'GET' });
 *   // Hata durumunda ApiError fırlatır — try/catch ile yakala
 */

/** Kullanıcıya gösterilebilecek hata. */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

/**
 * 401 geldiğinde tetiklenecek callback.
 * App.jsx tarafından navigate('/login') atanır.
 */
let _onUnauthorized = null;

export function setUnauthorizedHandler(fn) {
  _onUnauthorized = fn;
}

/**
 * Ana fetch sarmalayıcı.
 * options: standart fetch seçenekleri + credentials: 'include' varsayılan.
 */
export async function apiFetch(url, options = {}) {
  const opts = {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  };

  let res;
  try {
    res = await fetch(url, opts);
  } catch {
    throw new ApiError('Sunucuya bağlanılamadı. Ağ bağlantınızı kontrol edin.', 0);
  }

  // 401 — oturum sona ermiş
  if (res.status === 401) {
    if (_onUnauthorized) _onUnauthorized();
    throw new ApiError('Oturumunuz sona erdi. Lütfen tekrar giriş yapın.', 401);
  }

  // Başarılı / boş yanıt
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return null;
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new ApiError(`Beklenmeyen yanıt (HTTP ${res.status}).`, res.status);
  }

  if (!res.ok) {
    const msg = _extractErrorMessage(data, res.status);
    throw new ApiError(msg, res.status);
  }

  return data;
}

/** HTTP hata yanıtından kullanıcıya gösterilebilecek mesaj çıkar. */
function _extractErrorMessage(data, status) {
  // 422 — Pydantic doğrulama hatası
  if (status === 422 && data?.detail) {
    if (Array.isArray(data.detail)) {
      const msgs = data.detail.map(e => {
        const field = e.loc?.slice(1).join(' → ') ?? 'alan';
        const msg = e.msg ?? 'geçersiz değer';
        return `${field}: ${msg}`;
      });
      return 'Doğrulama hatası:\n' + msgs.join('\n');
    }
  }

  // 409 — çakışma
  if (status === 409 && data?.detail) return data.detail;

  // 404
  if (status === 404 && data?.detail) return data.detail;

  // Genel "detail" string
  if (typeof data?.detail === 'string') return data.detail;

  // Son çare
  const statusTexts = {
    400: 'Geçersiz istek.',
    403: 'Bu işlem için yetkiniz yok.',
    404: 'Kayıt bulunamadı.',
    409: 'Çakışma — bu kayıt zaten mevcut.',
    500: 'Sunucu hatası. Lütfen tekrar deneyin.',
  };
  return statusTexts[status] ?? `Beklenmeyen hata (HTTP ${status}).`;
}
