import express from "express"
import { verifyToken, checkRole } from "../middlewares/authMiddleware.js"
import { param } from "express-validator"
import { createUploaderBunny } from "../middlewares/uploadBunny.js"
import { deleteUkm, getUkm, uploadUkm } from "../controllers/ukmController.js"
import { publicLimiter, adminLimiter } from '../middlewares/rateLimiter.js';

const ukmRoutes = express.Router()
const uploadBunny = createUploaderBunny([{name: "gambar", maxCount: 1}], "ukm")
const idValidation = [
  param("id")
    .trim()
    .escape()
    .isInt({ gt: 0 }).withMessage("ID harus berupa angka positif"),
];

ukmRoutes.get("/", publicLimiter, getUkm)
ukmRoutes.post("/", verifyToken, checkRole("admin", "si paling admin"), adminLimiter, ...uploadBunny, uploadUkm)
ukmRoutes.delete(
  "/:id",
  [
    verifyToken,
    checkRole("admin", "si paling admin"),
    adminLimiter,
    ...idValidation,
  ],
  deleteUkm
);

export default ukmRoutes