import db from "../config/db.js";
import validator from "validator"
import sanitizeHtml from "sanitize-html"
import { validationResult } from "express-validator";
import { logActivity } from "./utils/logActivityAdmin.js";
import cache from "./utils/Cache.js";

export const getMitraKerjasama = async (req, res) => {
  try {
    const cacheKey = "mitra_kerjasama_cache"
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    const [rows] = await db.query("SELECT * FROM mitra_kerjasama");

    cache.set(cacheKey, rows, 43200);

    res.json(rows);
  } catch (err) {
    console.error("Gagal mengambil data mitra:", err);
    res.status(500).json({ message: "Gagal mengambil data mitra" });
  }
};

export const getMitraKerjasamaPage = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const page = parseInt(req.query.page) || 1;
  const limit = 5;
  const offset = (page - 1) * limit;
  const cacheKey = `mitra_kerjasama_page_${page}`;

  try {
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    const [rows] = await db.query("SELECT * FROM mitra_kerjasama LIMIT ? OFFSET ?", [limit, offset]);
    const [[{ total }]] = await db.query("SELECT COUNT(*) as total FROM mitra_kerjasama");

    const result = {
      data: rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    cache.set(cacheKey, result, 43200);

    res.json(result);
  } catch (err) {
    console.error("Gagal mengambil data mitra:", err);
    res.status(500).json({ message: "Gagal mengambil data mitra" });
  }
};


export const createMitraKerjasama = async (req, res) => {
  const { nama_instansi, latitude, longitude, alamat } = req.body;

  // Validasi wajib isi
  if (!nama_instansi || !latitude || !longitude || !alamat) {
    return res.status(400).json({ message: "Semua field wajib diisi." });
  }

  // Validasi panjang karakter
  if (nama_instansi.length > 100 || alamat.length > 500) {
    return res.status(400).json({ message: "Panjang karakter nama instansi atau alamat melebihi batas." });
  }

  // Validasi latitude & longitude
  if (!validator.isFloat(latitude.toString()) || !validator.isFloat(longitude.toString())) {
    return res.status(400).json({ message: "Latitude dan Longitude harus berupa angka desimal." });
  }

  // Sanitasi input
  const nama = sanitizeHtml(nama_instansi.trim(), { allowedTags: [], allowedAttributes: {} });
  const lat = parseFloat(latitude);
  const long = parseFloat(longitude);
  const cleanAlamat = sanitizeHtml(alamat.trim(), { allowedTags: [], allowedAttributes: {} });

  try {
    const [result] = await db.query(
      "INSERT INTO mitra_kerjasama (nama_instansi, latitude, longitude, alamat) VALUES (?, ?, ?, ?)",
      [nama, lat, long, cleanAlamat]
    );

    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: "upload",
      targetId: result.insertId,
      targetTable: "mitra_kerjasama",
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      message: `Mengunggah mitra kerjasama dengan nama instansi "${nama}"`,
    });
    
    const keys = cache.keys();
    const mitraKeys = keys.filter(key => key.startsWith('mitra_kerjasama'));
    mitraKeys.forEach(key => cache.del(key));

    res.status(201).json({ message: "Mitra berhasil ditambahkan", id: result.insertId });
  } catch (err) {
    console.error("Gagal menambahkan mitra:", err);
    res.status(500).json({ message: "Gagal menambahkan mitra" });
  }
};
  
export async function updateMitraKerjasama(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const { id } = req.params;
  const { nama_instansi, latitude, longitude, alamat } = req.body;

  // Validasi wajib isi
  if (!nama_instansi || !latitude || !longitude || !alamat) {
    return res.status(400).json({ message: "Semua field wajib diisi." });
  }

  // Validasi panjang karakter
  if (nama_instansi.length > 100 || alamat.length > 255) {
    return res.status(400).json({ message: "Panjang karakter nama instansi atau alamat melebihi batas." });
  }

  // Validasi latitude & longitude
  if (!validator.isFloat(latitude.toString()) || !validator.isFloat(longitude.toString())) {
    return res.status(400).json({ message: "Latitude dan Longitude harus berupa angka desimal." });
  }

  // Sanitasi input
  const nama = sanitizeHtml(nama_instansi.trim(), { allowedTags: [], allowedAttributes: {} });
  const lat = parseFloat(latitude);
  const long = parseFloat(longitude);
  const cleanAlamat = sanitizeHtml(alamat.trim(), { allowedTags: [], allowedAttributes: {} });

  try {
    const [result] = await db.query(
      "UPDATE mitra_kerjasama SET nama_instansi = ?, latitude = ?, longitude = ?, alamat = ? WHERE id = ?",
      [nama, lat, long, cleanAlamat, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Data tidak ditemukan" });
    }

    // Hapus cache full list
    const keys = cache.keys();
    const mitraKeys = keys.filter(key => key.startsWith('mitra_kerjasama'));
    mitraKeys.forEach(key => cache.del(key));

    res.json({ message: "Mitra berhasil diperbarui" });
  } catch (error) {
    console.error("Gagal mengedit mitra kerjasama:", error);
    res.status(500).json({ message: "Gagal mengedit mitra kerjasama" });
  }
}

export const deleteMitraKerjasama = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;

  try {
    const [row] = await db.query("SELECT * FROM mitra_kerjasama WHERE id = ?", [id]);
    const data = row[0];

    if (!data) {
      return res.status(404).json({ message: "Mitra tidak ditemukan" });
    }

    const [result] = await db.query("DELETE FROM mitra_kerjasama WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Mitra tidak ditemukan" });
    }

    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: "delete",
      targetId: id,
      targetTable: "mitra_kerjasama",
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      message: `Menghapus mitra kerjasama dengan nama instansi "${data.nama_instansi}"`,
    });

    // Hapus cache full list
    const keys = cache.keys();
    const mitraKeys = keys.filter(key => key.startsWith('mitra_kerjasama'));
    mitraKeys.forEach(key => cache.del(key));

    res.json({ message: "Mitra berhasil dihapus" });
  } catch (err) {
    console.error("Gagal menghapus mitra:", err);
    res.status(500).json({ message: "Gagal menghapus mitra" });
  }
};  