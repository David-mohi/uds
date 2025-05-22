import express from "express"
import { verifyToken, checkRole } from "../middlewares/authMiddleware.js";
import { query, body } from "express-validator";
import { getLogActivityAdmin, exportAuditLogs, delAuditLogsByDateRange } from "../controllers/auditAdminLogs.js";
import { auditLogRateLimiter, adminLimiter } from "../middlewares/rateLimiter.js";

const adminAuditRoutes = express.Router()
const validateDateRange = [
  body("startDate")
    .notEmpty().withMessage("Tanggal awal wajib diisi")
    .isISO8601().withMessage("Format tanggal awal tidak valid"),

  body("endDate")
    .notEmpty().withMessage("Tanggal akhir wajib diisi")
    .isISO8601().withMessage("Format tanggal akhir tidak valid"),
];

adminAuditRoutes.get(
  '/audit-act',
  verifyToken,
  checkRole("si paling admin"),
  adminLimiter,
  [
    query('page')
      .optional()
      .trim()
      .escape()
      .isInt({ min: 1 }).withMessage('Page harus berupa angka positif'),

    query('limit')
      .optional()
      .trim()
      .escape()
      .isInt({ min: 1 }).withMessage('Limit harus berupa angka positif'),

    query('nama_user')
      .optional()
      .trim()
      .escape()
      .isLength({ max: 100 }).withMessage('Nama user terlalu panjang'),

    query('action')
      .optional()
      .trim()
      .escape()
      .isIn(['upload', 'update', 'delete', 'login', 'logout']).withMessage('Action tidak valid'),

    query('target_table')
      .optional({ checkFalsy: true })
      .trim()
      .escape()
      .matches(/^[\w-]+$/)
      .withMessage('Nama tabel hanya boleh berisi huruf, angka, underscore, atau tanda hubung'),
    
    query('target_id')
      .optional({ checkFalsy: true })
      .trim()
      .escape(),

    query('start')
      .optional()
      .trim()
      .escape()
      .isISO8601().withMessage('Format tanggal mulai tidak valid'),

    query('end')
      .optional()
      .trim()
      .escape()
      .isISO8601().withMessage('Format tanggal akhir tidak valid'),
  ],
  getLogActivityAdmin
);

adminAuditRoutes.get("/export-audit", verifyToken, checkRole("si paling admin"), auditLogRateLimiter, exportAuditLogs)
adminAuditRoutes.delete("/audit-act/delete-range", verifyToken, checkRole("admin", "si paling admin"), auditLogRateLimiter, validateDateRange, delAuditLogsByDateRange);

export default adminAuditRoutes