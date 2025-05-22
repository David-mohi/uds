// uds_be/routes/organizationRoute.js
import express from 'express';
import { addStrukturOrganisasi, deleteGambarStruktur, deleteStrukturOrganisasi, getGambarStruktur, getStrukturOrganisasi, uploadGambarStruktur } from '../controllers/organisasiController.js';
import { checkRole, verifyToken } from '../middlewares/authMiddleware.js';
import { param } from "express-validator"
import { publicLimiter, adminLimiter } from '../middlewares/rateLimiter.js';
import { createUploaderBunny } from '../middlewares/uploadBunny.js';

// const upload = createUploader("organisasi")
const organisasiRoutes = express.Router();
const uploadBunny = createUploaderBunny([{name: "gambar", maxCount: 1}], "struktur-organisasi")

organisasiRoutes.get('/', publicLimiter, getStrukturOrganisasi);
organisasiRoutes.get('/gambar', publicLimiter, getGambarStruktur);
organisasiRoutes.post('/', verifyToken, checkRole("admin", "si paling admin"), addStrukturOrganisasi);
organisasiRoutes.post('/gambar', verifyToken, checkRole("admin", "si paling admin"), adminLimiter, ...uploadBunny, uploadGambarStruktur);
organisasiRoutes.delete(
  '/:id',
  [
    verifyToken,
    checkRole("admin", "si paling admin"),
    adminLimiter,
    param('id')
      .trim()
      .escape()
      .isInt({ min: 1 }).withMessage('ID harus berupa angka positif'),
  ],
  deleteStrukturOrganisasi
);

organisasiRoutes.delete(
  '/gambar/:id',
  [
    verifyToken,
    checkRole("admin", "si paling admin"),
    adminLimiter,
    param('id')
      .trim()
      .escape()
      .isInt({ min: 1 }).withMessage('ID harus berupa angka positif'),
  ],
  deleteGambarStruktur
);

export default organisasiRoutes;