import express from "express"
import { verifyToken, checkRole} from "../middlewares/authMiddleware.js"
import { publicLimiter, adminLimiter } from "../middlewares/rateLimiter.js"
import { deleteDokumenSDM, getDokumenSDM, updateDokumenSDM, uploadDokumenSDM } from "../controllers/dokumenSDM.js"
import { createUploaderBunny } from "../middlewares/uploadBunny.js"
import { param } from "express-validator"

const sdmRoutes = express.Router()
const uploadBunny = createUploaderBunny([{name: "dokumen", maxCount: 1}], "dokumen_sdm")

sdmRoutes.get("/", publicLimiter, getDokumenSDM)
sdmRoutes.post("/upload-sdm", verifyToken, checkRole("admin", "si paling admin"), adminLimiter, ...uploadBunny, uploadDokumenSDM)
sdmRoutes.put(
  "/:id/update-sdm",
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
  updateDokumenSDM
);

sdmRoutes.delete(
  "/:id/delete-sdm",
  [
    verifyToken,
    checkRole("admin", "si paling admin"),
    adminLimiter,
    param("id")
      .trim()
      .escape()
      .isInt({ min: 1 }).withMessage("ID harus berupa angka positif"),
  ],
  deleteDokumenSDM
);

export default sdmRoutes;