import express from 'express';
import { login } from '../controllers/authController.js';
import { checkRole, verifyToken } from '../middlewares/authMiddleware.js';
import { loginLimiter } from '../middlewares/rateLimiter.js';
import { logActivity } from '../controllers/utils/logActivityAdmin.js';
import db from '../config/db.js';

const authRoutes = express.Router();

authRoutes.post('/staff-login', loginLimiter, login);
authRoutes.post('/logout', verifyToken, async (req, res) => {
  try {
    // Hapus token
    res.clearCookie("token", { httpOnly: true, secure: false, sameSite: "Strict" });

    // Log aktivitas logout
    if (req.user) {
      await logActivity({
        db,
        userId: req.user.id,
        namaUser: req.user.nama,
        action: 'logout',
        targetId: req.user.id,
        targetTable: 'users',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        message: `${req.user.nama} melakukan logout`,
      });
    }

    res.status(200).json({ message: 'Logout berhasil' });
  } catch (err) {
    console.error('Gagal mencatat logout:', err);
    res.status(500).json({ message: 'Logout gagal' });
  }
});

authRoutes.get("/check-token", verifyToken, checkRole("admin", "si paling admin"), (req, res) => {
  res.json({ message: "Token valid", user: req.user });
});

authRoutes.get("/check-jdih-token", verifyToken, checkRole("admin", "si paling admin", "jdih"), (req, res) => {
  res.json({ message: "Token valid", user: req.user });
});

export default authRoutes;