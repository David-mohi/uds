import db from "../config/db.js";
import sanitizeHtml from "sanitize-html"
import validator from "validator"
import { validationResult } from "express-validator";
import { logActivity } from "./utils/logActivityAdmin.js";
import cache from "./utils/Cache.js";

export const getLinkKerjasama = async (req, res) => {
  try {
    const cacheKey = "link_kerjasama_cache";
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }
    const [rows] = await db.query("SELECT * FROM link_kerjasama");
    cache.set(cacheKey, rows, 43200);
    res.json(rows);
  } catch (err) {
    console.error("Gagal mengambil data mitra:", err);
    res.status(500).json({ message: "Gagal mengambil data mitra" });
  }
};

export const createLinkKerjasama = async (req, res) => {
  const { label, url } = req.body;

  // Validasi wajib isi
  if (!label || !url) {
    return res.status(400).json({ message: "Label dan URL wajib diisi." });
  }

  // Validasi panjang label
  if (label.length > 100) {
    return res.status(400).json({ message: "Label maksimal 100 karakter." });
  }

  // Validasi format URL
  if (!validator.isURL(url, { require_protocol: true })) {
    return res.status(400).json({ message: "Format URL tidak valid. Harus mengandung http:// atau https://." });
  }

  // Sanitasi input
  const cleanLabel = sanitizeHtml(label.trim(), { allowedTags: [], allowedAttributes: {} });
  const cleanUrl = sanitizeHtml(url.trim(), { allowedTags: [], allowedAttributes: {} });

  try {
    const [result] = await db.query(
      "INSERT INTO link_kerjasama (label, url) VALUES (?, ?)",
      [cleanLabel, cleanUrl]
    );

    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: "upload",
      targetId: result.insertId,
      targetTable: "link_kerjasama",
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      message: `Mengunggah link kerjasama dengan label "${cleanLabel}"`,
    });
    
    cache.del("link_kerjasama_cache")
    
    res.status(201).json({ message: "Link kerjasama berhasil ditambahkan", id: result.insertId });
  } catch (err) {
    console.error("Gagal menambahkan link kerjasama:", err);
    res.status(500).json({ message: "Gagal menambahkan link kerjasama" });
  }
};

export const deleteLinkKerjasama = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
	const { id } = req.params;
  
	try {
    const [rows] = await db.query("SELECT * FROM link_kerjasama WHERE id = ?", [id])
    if (rows.length === 0) {
      return res.status(404).json({message: "Data tidak ditemukan"})
    }

    const data = rows[0]
    
	  const [result] = await db.query("DELETE FROM link_kerjasama WHERE id = ?", [id]);
  
	  if (result.affectedRows === 0) {
		return res.status(404).json({ message: "Mitra tidak ditemukan" });
	  }
    
    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: "delete",
      targetId: result.insertId,
      targetTable: "link_kerjasama",
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      message: `Menghapus link kerjasama dengan label "${data.label}"`,
    });
    
    cache.del("link_kerjasama_cache")
    
	  res.json({ message: "Mitra berhasil dihapus" });
	} catch (err) {
	  console.error("Gagal menghapus mitra:", err);
	  res.status(500).json({ message: "Gagal menghapus mitra" });
	}
};