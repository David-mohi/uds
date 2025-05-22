import express from "express"
import { getMitraKerjasama, getMitraKerjasamaPage, createMitraKerjasama, updateMitraKerjasama, deleteMitraKerjasama } from "../controllers/kerjasamaController.js"
import { verifyToken, checkRole } from "../middlewares/authMiddleware.js";
import { publicLimiter, adminLimiter } from '../middlewares/rateLimiter.js';
import { param, query } from "express-validator"

const kerjasamaRoutes = express.Router()

kerjasamaRoutes.get("/", publicLimiter, getMitraKerjasama)
kerjasamaRoutes.get(
  "/page",
  [
    verifyToken,
    checkRole("admin", "si paling admin"),
    publicLimiter,
    query("page")
      .optional()
      .isInt({ min: 1 }).withMessage("Parameter page harus berupa bilangan bulat positif")
      .toInt()
  ],
  getMitraKerjasamaPage
);
kerjasamaRoutes.post("/", verifyToken, checkRole("admin", "si paling admin"), adminLimiter, createMitraKerjasama)
kerjasamaRoutes.put(
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
  updateMitraKerjasama
);

kerjasamaRoutes.delete(
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
  deleteMitraKerjasama
);


export default kerjasamaRoutes