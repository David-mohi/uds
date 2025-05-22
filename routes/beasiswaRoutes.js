import express from "express"
import { verifyToken, checkRole} from "../middlewares/authMiddleware.js"
import { publicLimiter, adminLimiter } from "../middlewares/rateLimiter.js"
import { uploadDokumenBeasiswa, deleteDokumenBeasiswa, updateDokumenBeasiswa, getDokumenBeasiswa } from "../controllers/BeasiswaController.js"
import { createUploaderBunny } from "../middlewares/uploadBunny.js"
import { param } from "express-validator"

const beasiswaRoutes = express.Router()
const uploadBunny = createUploaderBunny([{name: "dokumen", maxCount: 1}], "dokumen_beasiswa")

beasiswaRoutes.get("/", publicLimiter, getDokumenBeasiswa)
beasiswaRoutes.post("/upload-beasiswa", verifyToken, checkRole("admin", "si paling admin"), adminLimiter, ...uploadBunny, uploadDokumenBeasiswa)
beasiswaRoutes.put(
  "/:id/update-beasiswa",
  [
    verifyToken,
    checkRole("admin", "si paling admin"),
    adminLimiter,
    param("id")
      .trim()
      .escape()
      .isInt({ min: 1 }).withMessage("ID harus berupa angka positif"),
    ...uploadBunny,
  ],
  updateDokumenBeasiswa
);

beasiswaRoutes.delete(
  "/:id/delete-beasiswa",
  [
    verifyToken,
    checkRole("admin", "si paling admin"),
    adminLimiter,
    param("id")
      .trim()
      .escape()
      .isInt({ min: 1 }).withMessage("ID harus berupa angka positif"),
  ],
  deleteDokumenBeasiswa
);

export default beasiswaRoutes;