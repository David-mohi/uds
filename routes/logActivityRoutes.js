import express from "express"
import { deleteVisitorsByDateRange, exportVisitorsCSV, getVisitors, logVisit } from "../controllers/logActivityController.js"
import { auditLogRateLimiter, visitorsLogLimiter } from "../middlewares/rateLimiter.js"
import { verifyToken, checkRole } from "../middlewares/authMiddleware.js"
import { query, body } from "express-validator"

const activityRoutes = express.Router()
const validateVisitorQuery = [
  query("ip_address")
    .optional()
    .trim()
    .isLength({ max: 45 }).withMessage("IP address terlalu panjang"),

  query("user_agent")
    .optional()
    .trim()
    .isLength({ max: 255 }).withMessage("User Agent terlalu panjang"),

  query("start")
    .optional()
    .isISO8601().withMessage("Tanggal mulai tidak valid"),

  query("end")
    .optional()
    .isISO8601().withMessage("Tanggal akhir tidak valid"),

  query("page")
    .optional()
    .toInt()
    .isInt({ min: 1 }).withMessage("Page harus berupa angka positif"),

  query("limit")
    .optional()
    .toInt()
    .isInt({ min: 1, max: 100 }).withMessage("Limit harus antara 1-100")
];

const validateDeleteVisitorRange = [
  body("startDate")
    .trim()
    .notEmpty().withMessage("Tanggal awal wajib diisi")
    .isISO8601().withMessage("Format tanggal awal tidak valid"),

  body("endDate")
    .trim()
    .notEmpty().withMessage("Tanggal akhir wajib diisi")
    .isISO8601().withMessage("Format tanggal akhir tidak valid"),
];

// Routes
activityRoutes.get("/visitors", logVisit);
activityRoutes.get("/visitors-log",
  verifyToken,
  checkRole("admin", "si paling admin"),
  visitorsLogLimiter,
  validateVisitorQuery,
  getVisitors);
activityRoutes.get("/export-logvisit", verifyToken, checkRole("si paling admin"), auditLogRateLimiter, exportVisitorsCSV)
activityRoutes.delete("/delete-range", verifyToken, checkRole("admin", "si paling admin"), auditLogRateLimiter, validateDeleteVisitorRange, deleteVisitorsByDateRange);
  
export default activityRoutes;