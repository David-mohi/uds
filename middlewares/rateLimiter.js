// rateLimit.js
import rateLimit from 'express-rate-limit';

export const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
  standardHeaders: true,
  legacyHeaders: false,
})

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Terlalu banyak percobaan login. Silakan coba lagi nanti.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const pengaduanLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 2,
  message: 'Terlalu banyak percobaan. Silakan coba lagi nanti.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const auditLogRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 menit
  max: 30, // maksimal 30 request per window per IP
  message: "Terlalu banyak permintaan ke audit log, coba lagi nanti.",
  standardHeaders: true,
  legacyHeaders: false,
});

export const visitorsLogLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 60,
  message: "Terlalu banyak permintaan, silakan coba lagi nanti.",
  standardHeaders: true,
  legacyHeaders: false,
});

export const usersVisitorLogLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 jam
  max: 15,
  message: "Terlalu banyak kunjungan tercatat, silakan coba lagi nanti.",
  standardHeaders: true,
  legacyHeaders: false,
});

export const downloadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 jam
  max: 10,
  message: "Terlalu percobaan download, silahkan coba lagi nanti.",
  standardHeaders: true,
  legacyHeaders: false,
});