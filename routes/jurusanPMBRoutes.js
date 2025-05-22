import express from "express"
import { verifyToken, checkRole } from "../middlewares/authMiddleware.js"
import { getJurusanPMB, addJurusanPMB, deleteJurusanPMB, updateJurusanPMB } from "../controllers/jurusanPMB.js"
import { publicLimiter, adminLimiter } from '../middlewares/rateLimiter.js';
import { param } from "express-validator"

const jurusanPMBRoutes = express.Router()

jurusanPMBRoutes.get("/", publicLimiter, getJurusanPMB)
jurusanPMBRoutes.post("/", verifyToken, checkRole("admin", "si paling admin"), adminLimiter, addJurusanPMB)
jurusanPMBRoutes.put(
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
  updateJurusanPMB
);

jurusanPMBRoutes.delete(
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
  deleteJurusanPMB
);

export default jurusanPMBRoutes;