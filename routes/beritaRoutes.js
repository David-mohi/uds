import express from 'express';
import { createUploaderBunny } from '../middlewares/uploadBunny.js';
import { createBerita, updateBerita, deleteBerita, getBeritaTerkini, getBeritaBySlug, getSemuaBerita, getPengumuman, getAgenda, getSemuaBeritaAdmin, deleteBeritaByDateRange } from '../controllers/beritaController.js';
import { checkRole, verifyToken } from '../middlewares/authMiddleware.js';
import { publicLimiter, adminLimiter, auditLogRateLimiter } from '../middlewares/rateLimiter.js';
import { validateCreateBerita } from '../controllers/beritaController.js';
import { query, param } from 'express-validator';

// const upload = createUploader('uds_berita')
const beritaRoutes = express.Router();
const uploadBunny = createUploaderBunny([
	{name: "gambar", maxCount: 1},
	{name: "dokumen", maxCount: 3}
	],
	"berita-uds"
)
const idValidation = [
  param("id")
    .trim()
    .escape()
    .isInt({ gt: 0 })
    .withMessage("ID harus berupa angka positif"),
];

beritaRoutes.get(
  '/allnews',
  publicLimiter,
  [
    query('page').optional().trim().escape().isInt({ min: 1 }).withMessage('Page harus berupa angka positif'),
    query('limit').optional().trim().escape().isInt({ min: 1 }).withMessage('Limit harus berupa angka positif'),
    query('search').optional().trim().escape().isLength({ max: 100 }).withMessage('Pencarian tidak boleh lebih dari 100 karakter'),
    query('kategori').optional().trim().escape().isLength({ max: 20 }).isAlphanumeric().withMessage('Kategori hanya boleh huruf dan angka'),
  ],
  getSemuaBerita
);

beritaRoutes.get(
  '/admin-allnews',
  verifyToken,
  checkRole("admin", "si paling admin"),
  publicLimiter,
  [
    query('page').optional().trim().escape().isInt({ min: 1 }).withMessage('Page harus berupa angka positif'),
    query('limit').optional().trim().escape().isInt({ min: 1 }).withMessage('Limit harus berupa angka positif'),
    query('search').optional().trim().escape(),
    query('kategori')
      .optional()
      .trim()
      .escape()
      .matches(/^[\w-]+$/).withMessage('Kategori hanya boleh berisi huruf, angka, underscore, atau tanda hubung')
      .isLength({ max: 20 }),
    query('tahun')
      .optional()
      .trim()
      .escape()
      .isLength({ max: 6 })
      .isInt({ min: 2010, max: 2100 }).withMessage('Tahun harus berupa angka antara 2010 dan 2100'),
  ],
  getSemuaBeritaAdmin
);

// GET /berita/
beritaRoutes.get('/', publicLimiter, getBeritaTerkini);

// GET /berita/pengumuman?kategori=...
beritaRoutes.get(
  '/pengumuman',
  publicLimiter,
  [
    query('kategori').optional().trim().escape().isAlphanumeric().withMessage('Kategori hanya boleh huruf dan angka'),
  ],
  getPengumuman
);

// GET /berita/agenda?kategori=...
beritaRoutes.get(
  '/agenda',
  publicLimiter,
  [
    query('kategori').optional().trim().escape().isAlphanumeric().withMessage('Kategori hanya boleh huruf dan angka'),
  ],
  getAgenda
);

// GET /berita/:slug
beritaRoutes.get(
  '/:slug',
  publicLimiter,
  [
    param('slug').trim().escape().isSlug().withMessage('Slug tidak valid'),
  ],
  getBeritaBySlug
);
beritaRoutes.post('/', verifyToken, checkRole('admin', 'si paling admin'), adminLimiter, ...uploadBunny, validateCreateBerita, createBerita);
beritaRoutes.put(
  '/:id',
  [
    verifyToken,
    checkRole('admin', 'si paling admin'),
    adminLimiter,
    ...uploadBunny,
    ...idValidation,
  ],
  updateBerita
);

beritaRoutes.delete("/delete-range", verifyToken, checkRole("admin", "si paling admin"), deleteBeritaByDateRange);

beritaRoutes.delete(
  '/:id',
  [
    verifyToken,
    checkRole('admin', 'si paling admin'),
    adminLimiter,
    ...idValidation,
  ],
  deleteBerita
);


export default beritaRoutes;