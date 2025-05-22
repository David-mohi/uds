import db from "../config/db.js";
import { v2 as cloudinary } from "cloudinary";
import path from "path"
import { validationResult } from "express-validator";
import { logActivity } from "./utils/logActivityAdmin.js";
import cache from "./utils/Cache.js";

export const uploadKuliahOnline = async (req, res) => {
  try {
	const gambarUrl = req.file?.path;

	const [result] = await db.query(
	  "INSERT INTO kuliah_online (gambar_url) VALUES (?)",
	  [gambarUrl]
	);

  await logActivity({
    db,
    userId: req.user?.id,
    namaUser: req.user?.nama,
    action: "upload",
    targetId: result.insertId,
    targetTable: "kuliah_online",
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    message: `Mengunggah gambar kuliah online"`,
  });

  cache.del("info_kuliah_cache")
  
	res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal menyimpan kalender akademik" });
  }
};

export const getKuliahOnline = async (req, res) => {
  try {
    const cacheKey = "info_kuliah_cache";
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }
    const [rows] = await db.query("SELECT * FROM kuliah_online ORDER BY id DESC LIMIT 1");
    cache.set(cacheKey, rows, 43200);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal mengambil data kalender akademik" });
  }
};

export const delKuliahOnline = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;

  try {
    const [rows] = await db.query('SELECT * FROM kuliah_online WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Data tidak ditemukan' });

    const gambarUrl = rows[0];

    if (gambarUrl.gambar_url) {
      const urlParts = gambarUrl.gambar_url.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const folder = urlParts[urlParts.length - 2];
      const publicId = `${folder}/${path.parse(fileName).name}`;

      const result = await cloudinary.uploader.destroy(publicId);

      if (result.result !== 'ok') {
        console.warn('Gagal hapus gambar dari Cloudinary:', result);
      }
    }

    await db.query('DELETE FROM kuliah_online WHERE id = ?', [id]);

    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: "delete",
      targetId: id,
      targetTable: "kuliah_online",
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      message: `Menghapus gambar kuliah online dengan ID "${id}"`,
    });
    
    cache.del("info_kuliah_cache")
    
    res.json({ message: 'Data dan file berhasil dihapus' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal menghapus data' });
  }
};