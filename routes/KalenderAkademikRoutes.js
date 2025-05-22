import express from "express"
import { createPdfUploader } from "../middlewares/upload.js"
import { checkRole, verifyToken } from "../middlewares/authMiddleware.js"
import { getKalenderAkademik, uploadKalenderAkademik, delKalenderAkademik, downloadKalender, updateKalenderAkademik } from "../controllers/kalenderAkademikController.js"
import { publicLimiter, adminLimiter, downloadLimiter } from '../middlewares/rateLimiter.js';
import { param } from "express-validator"

const akademikRoutes = express.Router()
const upload = createPdfUploader("kalender-akademik")

akademikRoutes.get("/", publicLimiter, getKalenderAkademik)
akademikRoutes.post("/", verifyToken, checkRole("admin", "si paling admin"), adminLimiter, upload.single("pdfFile"), uploadKalenderAkademik)
akademikRoutes.put(
  "/:id",
  [
    verifyToken,
    checkRole("admin", "si paling admin"),
    adminLimiter,
    param("id")
      .trim()
      .escape()
      .isInt({ min: 1 }).withMessage("ID harus berupa angka positif"),
  ],
  upload.single("pdfFile"),
  updateKalenderAkademik
);

akademikRoutes.delete(
  "/:id",
  [
    verifyToken,
    checkRole("admin", "si paling admin"),
    adminLimiter,
    param("id")
      .trim()
      .escape()
      .isInt({ min: 1 }).withMessage("ID harus berupa angka positif"),
  ],
  delKalenderAkademik
);

akademikRoutes.get(
  "/download/:id",
  [
    downloadLimiter,
    param("id")
      .trim()
      .escape()
      .isInt({ min: 1 }).withMessage("ID harus berupa angka positif"),
  ],
  downloadKalender
);

export default akademikRoutes