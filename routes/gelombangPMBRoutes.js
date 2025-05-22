import express from "express"
import { checkRole, verifyToken } from "../middlewares/authMiddleware.js"
import { addGelombangPendaftaran, deleteGelombangPendaftaran, getGelombangPendaftaran, updateGelombangPendaftaran } from "../controllers/gelombangPMBControlles.js"
import { publicLimiter, adminLimiter } from '../middlewares/rateLimiter.js';
import { param } from "express-validator";

const PMBRoutes = express.Router()

PMBRoutes.get("/", publicLimiter, getGelombangPendaftaran)
PMBRoutes.post("/", verifyToken, checkRole("admin", "si paling admin"), adminLimiter, addGelombangPendaftaran)
PMBRoutes.delete(
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
  deleteGelombangPendaftaran
);

PMBRoutes.put(
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
  updateGelombangPendaftaran
);

export default PMBRoutes