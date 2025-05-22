import express from "express";
import { deleteHeroSlider, getActiveHeroSlider, getHeroSlider, updateActiveHero, updateHero, uploadHeroSlider } from "../controllers/sliderController.js";
import { param } from "express-validator";
import { createUploaderBunny } from "../middlewares/uploadBunny.js";
import { checkRole, verifyToken } from "../middlewares/authMiddleware.js";
import { publicLimiter, adminLimiter } from '../middlewares/rateLimiter.js';

const sliderRoutes = express.Router();
const uploadBunny = createUploaderBunny([{name: "gambar", maxCount: 1}], "hero-slider")
const idValidation = [
  param("id")
    .trim()
    .escape()
    .isInt({ gt: 0 }).withMessage("ID harus berupa angka positif"),
];

sliderRoutes.get("/", publicLimiter, getActiveHeroSlider);
sliderRoutes.get("/all-hero", verifyToken, checkRole("admin", "si paling admin"), publicLimiter, getHeroSlider);
sliderRoutes.post("/", verifyToken, checkRole("admin", "si paling admin"), adminLimiter, ...uploadBunny, uploadHeroSlider);
sliderRoutes.put(
  "/:id",
  [
    verifyToken,
    checkRole("admin", "si paling admin"),
    adminLimiter,
    ...idValidation,
    ...uploadBunny,
  ],
  updateHero
);

sliderRoutes.put(
  "/toggle/:id",
  [
    verifyToken,
    checkRole("admin", "si paling admin"),
    adminLimiter,
    ...idValidation,
  ],
  updateActiveHero
);

sliderRoutes.delete(
  "/:id",
  [
    verifyToken,
    checkRole("admin", "si paling admin"),
    adminLimiter,
    ...idValidation,
  ],
  deleteHeroSlider
);

export default sliderRoutes;