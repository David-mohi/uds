import express from "express"
import { createUploader } from "../middlewares/upload.js"
import { checkRole, verifyToken } from "../middlewares/authMiddleware.js"
import { getKuliahOnline, uploadKuliahOnline, delKuliahOnline } from "../controllers/kuliahOnline.js"
import { publicLimiter, adminLimiter } from '../middlewares/rateLimiter.js';
import { param } from "express-validator"

const kuliahOnlineRoutes = express.Router()
const upload = createUploader("kuliah-online")

kuliahOnlineRoutes.get("/", publicLimiter, getKuliahOnline)
kuliahOnlineRoutes.post("/", verifyToken, checkRole("admin", "si paling admin"), adminLimiter, upload.single("gambarUrl"), uploadKuliahOnline)
kuliahOnlineRoutes.delete(
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
  delKuliahOnline
);

export default kuliahOnlineRoutes