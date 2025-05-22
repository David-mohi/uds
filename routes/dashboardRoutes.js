import express from "express"
import {verifyToken, checkRole} from "../middlewares/authMiddleware.js"
import { adminLimiter, publicLimiter } from "../middlewares/rateLimiter.js"
import { getPengunjungGrafik, getPengunjungHariIni, getRecentUploads, getTotalBerita } from "../controllers/DashboardController.js"

const dashboardRoutes = express.Router()

dashboardRoutes.get("/berita-total", verifyToken, checkRole("admin", "si paling admin"), adminLimiter, getTotalBerita)
dashboardRoutes.get("/pengunjung-today", verifyToken, checkRole("admin", "si paling admin"), adminLimiter, getPengunjungHariIni)
dashboardRoutes.get("/visitors-graph", verifyToken, checkRole("admin", "si paling admin"), publicLimiter, getPengunjungGrafik);
dashboardRoutes.get("/recent-act", verifyToken, checkRole("admin", "si paling admin"), adminLimiter, getRecentUploads)

export default dashboardRoutes