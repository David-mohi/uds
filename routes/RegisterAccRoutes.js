import express from "express"
import { verifyToken, checkRole } from "../middlewares/authMiddleware.js"
import { adminLimiter } from "../middlewares/rateLimiter.js"
import { addAkun, deleteAkun, semuaAkun, updateAkun, updatePassword, updateFoto } from "../controllers/RegisterAccController.js"
import { createUploaderBunny } from "../middlewares/uploadBunny.js"
import { param } from "express-validator"

const registerRoutes = express.Router()
const uploadBunny = createUploaderBunny([{name: "gambar", maxCount: 1}], "Foto-Profile")
const usernameValidation = [
  param("username")
    .trim()
    .escape()
    .matches(/^[a-zA-Z0-9_.]+$/).withMessage("Username hanya boleh berisi huruf, angka, underscore, dan titik")
    .isLength({ min: 3, max: 30 }).withMessage("Username harus antara 3 sampai 30 karakter"),
];

registerRoutes.post("/", verifyToken, checkRole("si paling admin"), adminLimiter, ...uploadBunny, addAkun)
registerRoutes.get("/akun-mimin", verifyToken, checkRole("si paling admin"), adminLimiter, semuaAkun)
registerRoutes.put("/update-profilefoto", verifyToken, checkRole("admin", "si paling admin"), ...uploadBunny, updateFoto)
registerRoutes.put(
  "/updateakun/:username",
  [
    verifyToken,
    checkRole("si paling admin"),
    adminLimiter,
    ...usernameValidation,
  ],
  updateAkun
);

registerRoutes.put(
  "/updateakun-password/:username",
  [
    verifyToken,
    checkRole("si paling admin"),
    adminLimiter,
    ...usernameValidation,
  ],
  updatePassword
);

registerRoutes.delete(
  "/deleteakun/:username",
  [
    verifyToken,
    checkRole("si paling admin"),
    adminLimiter,
    ...usernameValidation,
  ],
  deleteAkun
);

registerRoutes.get("/check-token-register", verifyToken, checkRole("si paling admin"), (req, res) => {
  res.json({ message: "Token valid", user: req.user });
});

export default registerRoutes