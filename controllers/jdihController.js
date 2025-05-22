import db from "../config/db.js";
import validator from "validator"
import { validationResult } from "express-validator";
import { logActivity } from "./utils/logActivityAdmin.js";
import cache from "./utils/Cache.js";

export const getJdihLinks = async (req, res) => {
  try {
    const cacheKey = 'jdih_links';

    // Cek apakah data ada di cache
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    // Jika tidak ada di cache, query database
    const [rows] = await db.query("SELECT * FROM jdih_links ORDER BY created_at DESC");

    // Simpan hasil query ke cache
    cache.set(cacheKey, rows);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createJdihLink = async (req, res) => {
  let { judul, url } = req.body;

  // Sanitasi input
  judul = validator.escape(judul?.trim() || '');
  url = url?.trim() || '';

  // Validasi
  if (!judul || !url) {
    return res.status(400).json({ message: "Judul dan URL wajib diisi" });
  }

  if (judul.length > 100) {
    return res.status(400).json({ message: "Judul maksimal 100 karakter" });
  }

  if (!validator.isURL(url, { protocols: ['http', 'https'], require_protocol: true })) {
    return res.status(400).json({ message: "URL tidak valid. Harus diawali dengan http:// atau https://" });
  }

  try {
    const [result] = await db.query("INSERT INTO jdih_links (judul, url) VALUES (?, ?)", [judul, url]);

    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: "upload",
      targetId: result.insertId,
      targetTable: "jdih",
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      message: `Mengunggah dokumen JDIH dengan judul "${judul}"`,
    });

    // Hapus cache agar data jdih_links terbaru bisa diambil
    cache.del('jdih_links');

    res.status(201).json({ message: "Link berhasil ditambahkan" });
  } catch (error) {
    console.error("Gagal menyimpan link JDIH:", error);
    res.status(500).json({ message: "Terjadi kesalahan saat menyimpan data" });
  }
};

export const deleteJdihLink = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;

  try {
    const [rows] = await db.query('SELECT * FROM jdih_links WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Link JDIH tidak ditemukan' });
    }

    const data = rows[0];

    await db.query("DELETE FROM jdih_links WHERE id = ?", [id]);

    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: "delete",
      targetId: id,
      targetTable: "jdih",
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      message: `Menghapus dokumen JDIH dengan judul "${data.judul}"`,
    });

    // Hapus cache jdih_links
    cache.del('jdih_links');

    res.json({ message: "Link berhasil dihapus" });
  } catch (error) {
    console.error("Gagal menghapus link JDIH:", error);
    res.status(500).json({ message: error.message });
  }
};

export const updateJdihLink = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  let { judul, url } = req.body;

  // Sanitasi: trim input
  judul = validator.escape(judul?.trim() || '');
  url = url?.trim();

  // Validasi
  if (!judul || !url) {
    return res.status(400).json({ message: "Judul dan URL wajib diisi" });
  }

  if (judul.length > 100) {
    return res.status(400).json({ message: "Judul maksimal 100 karakter" });
  }

  if (url.length > 2048) {
    return res.status(400).json({ message: "URL terlalu panjang" });
  }

  if (!validator.isURL(url, { require_protocol: true })) {
    return res.status(400).json({ message: "URL tidak valid. Sertakan protokol (http/https)" });
  }

  try {
    const [result] = await db.query(
      "UPDATE jdih_links SET judul = ?, url = ? WHERE id = ?",
      [judul, url, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Link tidak ditemukan" });
    }

    cache.del('jdih_links');
    
    res.status(200).json({ message: "Link berhasil diperbarui" });
  } catch (error) {
    console.error("Gagal update JDIH:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server" });
  }
};