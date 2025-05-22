import express from "express";
import { getJdihLinks, createJdihLink, deleteJdihLink, updateJdihLink } from "../controllers/jdihController.js";
import { verifyToken, checkRole } from "../middlewares/authMiddleware.js";
import { adminLimiter } from "../middlewares/rateLimiter.js";
import { param } from "express-validator"

const jdihRoutes = express.Router();

jdihRoutes.get("/", verifyToken, checkRole("admin", "si paling admin", "jdih"), adminLimiter, getJdihLinks);
jdihRoutes.post("/", verifyToken, checkRole("admin", "si paling admin"), adminLimiter, createJdihLink);
jdihRoutes.put(
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
  updateJdihLink
);

jdihRoutes.delete(
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
  deleteJdihLink
);

export default jdihRoutes;