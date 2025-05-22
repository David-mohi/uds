import jwt from 'jsonwebtoken';
import dotenv from "dotenv"
import db from '../config/db.js'; // Mengimpor koneksi ke database
dotenv.config()


export const verifyToken = async (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: 'Token tidak ditemukan' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [decoded.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'User tidak ditemukan' });

    const user = rows[0];
    req.user = {
      id: user.id,
      username: user.username,
      nama: user.nama,
      foto_url: user.foto_url,
      role: user.role
    };
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Token tidak valid' });
  }
};

export const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Akses ditolak' });
    }
    next();
  };
};
