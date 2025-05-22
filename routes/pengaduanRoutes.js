import express from "express";
import { createPengaduan, deletePengaduan, getAllPengaduan, updateStatusPengaduan } from "../controllers/pengaduanController.js";
import { createUploaderBunny } from "../middlewares/uploadBunny.js";
import { verifyToken, checkRole } from "../middlewares/authMiddleware.js";
import { adminLimiter, pengaduanLimiter } from '../middlewares/rateLimiter.js';
import { param, query } from "express-validator"

const pengaduanRoutes = express.Router();
const uploadBunny = createUploaderBunny([{name: "gambar", maxCount: 1}], "file-pengaduan")

pengaduanRoutes.post("/", pengaduanLimiter, ...uploadBunny, createPengaduan);

pengaduanRoutes.get(
  "/",
  [
    verifyToken,
    checkRole("admin", "si paling admin"),
    adminLimiter,
    query("page")
      .optional()
      .isInt({ min: 1 }).withMessage("Parameter page harus bilangan bulat positif")
      .toInt(),
    query("limit")
      .optional()
      .isInt({ min: 1 }).withMessage("Parameter limit harus bilangan bulat positif")
      .toInt(),
    query("status")
      .optional()
      .isIn(['0', '1']).withMessage("Parameter status harus '0' atau '1'") // validasi status hanya '0' atau '1'
  ],
  getAllPengaduan
);

pengaduanRoutes.put(
  "/:id/status",
  [
    verifyToken,
    checkRole("admin", "si paling admin"),
    adminLimiter,
    param("id")
      .trim()
      .escape()
      .isInt({ min: 1 }).withMessage("ID harus berupa angka positif"),
  ],
  updateStatusPengaduan
);

pengaduanRoutes.delete(
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
  deletePengaduan
);

export default pengaduanRoutes;