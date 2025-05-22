import express from "express"
import { verifyToken, checkRole } from "../middlewares/authMiddleware.js"
import { getBukuPedoman, createBukuPedoman, updateBukuPedoman, deleteBukuPedoman, downloadBukuPedoman } from "../controllers/bukuPedomanController.js"
import { createPdfUploader } from "../middlewares/upload.js"
import { publicLimiter, adminLimiter, downloadLimiter } from '../middlewares/rateLimiter.js';
import { param, query } from "express-validator";

const pedomanRoutes = express.Router()
const upload = createPdfUploader("buku-pedoman")
const validateIdParam = [
  param('id')
    .trim()
    .isInt({ gt: 0 })
    .withMessage('ID harus berupa angka bulat positif.')
    .toInt(),
];


pedomanRoutes.get("/", publicLimiter, getBukuPedoman)
pedomanRoutes.get(
  "/download",
  downloadLimiter,
  [
    query("url")
      .trim()
      .isURL().withMessage("Parameter url tidak valid")
      .custom((value) => {
        const allowedDomain = "https://res.cloudinary.com/dbcm8omwq/";
        if (!value.startsWith(allowedDomain)) {
          throw new Error("URL tidak diizinkan");
        }
        return true;
      }),

    query("filename")
      .trim()
      .isLength({ min: 1, max: 100 }).withMessage("Parameter filename tidak boleh kosong atau terlalu panjang")
      .matches(/^[a-zA-Z0-9\-_/ ]+$/).withMessage("Filename hanya boleh mengandung huruf, angka, spasi, dash, dan underscore"),
  ],
  downloadBukuPedoman
);
pedomanRoutes.post("/", verifyToken, checkRole("admin", "si paling admin"), adminLimiter, upload.single("buku_url"), createBukuPedoman)
pedomanRoutes.put(
  '/:id',
  verifyToken,
  checkRole('admin', 'si paling admin'),
  adminLimiter,
  validateIdParam,
  upload.single('buku_url'),
  updateBukuPedoman
);

pedomanRoutes.delete(
  '/:id',
  verifyToken,
  checkRole('admin', 'si paling admin'),
  adminLimiter,
  validateIdParam,
  deleteBukuPedoman
);

export default pedomanRoutes