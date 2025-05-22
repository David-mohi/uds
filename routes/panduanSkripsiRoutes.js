import express from "express"
import { createPdfUploader } from "../middlewares/upload.js"
import { checkRole, verifyToken } from "../middlewares/authMiddleware.js"
import { getPanduanSkripsi, uploadPanduanSkripsi, delPanduanSkripsi, downloadPanduanSkripsi } from "../controllers/panduanSkripsiController.js"
import { publicLimiter, adminLimiter, downloadLimiter } from '../middlewares/rateLimiter.js';
import { param } from "express-validator";

const skripsiRoutes = express.Router()
const upload = createPdfUploader("panduan-skripsi")

skripsiRoutes.get("/", publicLimiter, getPanduanSkripsi)
skripsiRoutes.get(
  "/download/:id",
  [
    downloadLimiter,
    param("id")
      .trim()
      .escape()
      .isInt({ min: 1 }).withMessage("ID harus berupa angka positif"),
  ],
  downloadPanduanSkripsi
);

skripsiRoutes.post("/", verifyToken, checkRole("admin", "si paling admin"), adminLimiter, upload.single("pdfUrl"), uploadPanduanSkripsi)
skripsiRoutes.delete(
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
  delPanduanSkripsi
);


export default skripsiRoutes