import db from '../config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from "dotenv"
import { logActivity } from "./utils/logActivityAdmin.js"

dotenv.config()

export const login = async (req, res) => {
  const { username, password, captchaToken } = req.body;

  // Validasi awal input username dan password
  if (
    typeof username !== "string" || 
    typeof password !== "string" || 
    typeof captchaToken !== "string"
  ) {
    return res.status(400).json({ message: "Input tidak valid" });
  }

  const trimmedUsername = username.trim();

  // Validasi panjang dan karakter username (hanya huruf, angka, underscore)
  const isValidUsername = /^[a-zA-Z0-9_]{3,32}$/.test(trimmedUsername);
  const isValidPassword = password.length >= 6 && password.length <= 64;

  if (!isValidUsername || !isValidPassword) {
    return res.status(400).json({ message: "Username atau password tidak valid" });
  }

  // Validasi CAPTCHA
  if (!captchaToken) {
    return res.status(400).json({ message: "CAPTCHA tidak ditemukan" });
  }

  try {
    const captchaSecret = process.env.RECAPTCHA_SECRET;
    const verifyURL = `https://www.google.com/recaptcha/api/siteverify?secret=${captchaSecret}&response=${captchaToken}`;

    const captchaResponse = await fetch(verifyURL, { method: "POST" });
    const captchaData = await captchaResponse.json();

    if (!captchaData.success) {
      return res.status(400).json({ message: "CAPTCHA tidak valid" });
    }

    // Cari user berdasarkan username (case-sensitive)
    const [rows] = await db.query('SELECT * FROM users WHERE BINARY username = ?', [trimmedUsername]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Username atau password salah' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: 'Username atau password salah' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: false, // sementara setingan local
      sameSite: "Lax",
      maxAge: 24 * 60 * 60 * 1000 // 1 hari
    });

    // Catat log login
    await logActivity({
      db,
      userId: user.id,
      namaUser: user.nama,
      action: 'login',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      message: `${user.nama} login`,
    });
    
    res.json({
      message: 'Login berhasil',
      user: {
        id: user.id,
        username: user.username,
        nama: user.nama,
        role: user.role,
        foto: user.foto_url
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Login gagal' });
  }
};

export const getUserData = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT nama, foto_url, role FROM users WHERE username = ?", [req.user.username]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    res.json({ message: "Token valid", user: rows[0] });
  } catch (err) {
    console.error("Gagal ambil data user:", err);
    res.status(500).json({ message: "Gagal mengambil data user" });
  }
};