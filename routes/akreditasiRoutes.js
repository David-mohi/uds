import express from 'express';
import { deleteAkreditasi, getAkreditasi, updateAkreditasi, uploadAkreditasi } from '../controllers/akreditasiController.js';
import { createUploaderBunny } from '../middlewares/uploadBunny.js';
import { verifyToken, checkRole } from "../middlewares/authMiddleware.js"
import { publicLimiter, adminLimiter } from '../middlewares/rateLimiter.js';
import { param } from "express-validator"

const akreditasiRoutes = express.Router();
const uploadBunny = createUploaderBunny([{name: "dokumen", maxCount: 1}], "akreditasi")

// const validateProdiParam = [
//   param('prodi')
//     .trim()
//     .escape()
//     .matches(/^[a-zA-Z0-9-_]+$/)
//     .withMessage('Prodi hanya boleh berisi huruf, angka, tanda hubung (-), dan underscore (_).'),
// ];

// Validasi dan sanitasi untuk id (biasanya angka)
const validateIdParam = [
  param('id')
    .trim()
    .isInt({ gt: 0 })
    .withMessage('ID harus berupa angka bulat positif.')
    .toInt(),
];

akreditasiRoutes.get('/', publicLimiter, getAkreditasi);

// Route dengan validasi params
// akreditasiRoutes.get(
//   '/:prodi',
//   publicLimiter,
//   validateProdiParam,
//   getAkreditasiByProdi
// );

akreditasiRoutes.put(
  '/:id',
  adminLimiter,
  verifyToken,
  checkRole("admin", "si paling admin"),
  validateIdParam,
  ...uploadBunny,
  updateAkreditasi
);

akreditasiRoutes.delete(
  '/:id',
  adminLimiter,
  verifyToken,
  checkRole("admin", "si paling admin"),
  validateIdParam,
  deleteAkreditasi
);
akreditasiRoutes.post('/', adminLimiter, verifyToken, checkRole("admin", "si paling admin"), ...uploadBunny, uploadAkreditasi);

export default akreditasiRoutes;