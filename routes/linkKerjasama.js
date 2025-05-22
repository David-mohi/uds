import express from "express"
import { getLinkKerjasama, createLinkKerjasama, deleteLinkKerjasama } from "../controllers/linkKerjasama.js"
import { verifyToken, checkRole } from "../middlewares/authMiddleware.js"
import { publicLimiter, adminLimiter } from '../middlewares/rateLimiter.js';
import { param } from "express-validator"

const linkRoutes = express.Router()

linkRoutes.get("/", publicLimiter, getLinkKerjasama)
linkRoutes.post("/", verifyToken, checkRole("admin", "si paling admin"), adminLimiter, createLinkKerjasama)
linkRoutes.delete(
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
  deleteLinkKerjasama
);


export default linkRoutes