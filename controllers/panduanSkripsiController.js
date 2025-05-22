import db from "../config/db.js";
import { v2 as cloudinary } from "cloudinary";
import https from "https"
import validator from "validator"
import sanitizeHtml from "sanitize-html"
import { validationResult } from "express-validator";
import { logActivity } from "./utils/logActivityAdmin.js";
import cache from "./utils/Cache.js";

export const uploadPanduanSkripsi = async (req, res) => {
  try {
    const { tahun } = req.body;
    const file = req.file;

    // Validasi file harus ada
    if (!file) {
      return res.status(400).json({ message: "File PDF harus diunggah." });
    }

    // Validasi: maksimal 3 MB
    if (file.size > 3 * 1024 * 1024) {
      return res.status(400).json({ message: "Ukuran file tidak boleh lebih dari 3 MB." });
    }

    // Validasi: tahun wajib
    if (!tahun || !validator.isInt(tahun.toString(), { min: 2000, max: 2100 })) {
      return res.status(400).json({ message: "Tahun tidak valid." });
    }

    // Sanitasi input
    const sanitizedTahun = sanitizeHtml(tahun.toString().trim());
    const pdfUrl = file.path;

    const [result] = await db.query(
      "INSERT INTO panduan_skripsi (pdf_url, tahun) VALUES (?, ?)",
      [pdfUrl, sanitizedTahun]
    );

    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: "upload",
      targetId: result.insertId,
      targetTable: "panduan_skripsi",
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      message: `Mengunggah panduan skripsi tahun ${sanitizedTahun}`,
    });
    
    cache.del("panduan_skripsi_cache")
    
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal menyimpan panduan skripsi." });
  }
};

export const getPanduanSkripsi = async (req, res) => {
  try {
    const cacheKey = "panduan_skripsi_cache"
    const cachedData = cache.get(cacheKey)
    if (cachedData) {
      return res.status(200).json(cachedData)
    }
    const [rows] = await db.query("SELECT * FROM panduan_skripsi ORDER BY id DESC");
    cache.set(cacheKey, rows, 43200)
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal mengambil data panduan skripsi" });
  }
};

export const delPanduanSkripsi = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;

  try {
    const [rows] = await db.query('SELECT * FROM panduan_skripsi WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Data tidak ditemukan' });
    }

    const pdfUrl = rows[0];

    if (pdfUrl.pdf_url) {
      const urlParts = pdfUrl.pdf_url.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const folder = urlParts[urlParts.length - 2];
      const publicId = `${folder}/${fileName}`; // file raw

      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'raw',
      });

      if (result.result !== 'ok') {
        console.warn('Gagal hapus file dari Cloudinary:', result);
      }
    }

    // Hapus dari database
    await db.query('DELETE FROM panduan_skripsi WHERE id = ?', [id]);

    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: "delete",
      targetId: id,
      targetTable: "panduan_skripsi",
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      message: `Menghapus panduan skripsi tahun ${pdfUrl.tahun}`,
    });
    
    cache.del("panduan_skripsi_cache")
    
    res.json({ message: 'Data dan file berhasil dihapus' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal menghapus data' });
  }
};

export const downloadPanduanSkripsi = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { id } = req.params;
  const { filename } = req.query;
  const allowedDomain = "https://res.cloudinary.com/dbcm8omwq";

  try {
    const [rows] = await db.query("SELECT * FROM panduan_skripsi WHERE id = ?", [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'File tidak ditemukan' });

    const file = rows[0];
    
    // Validasi URL cloudinary
    if (!file.pdf_url.startsWith(allowedDomain)) {
      return res.status(403).json({ message: 'URL tidak diizinkan' });
    }

    // nama file
    const fileName = filename || `Panduan Skripsi-${file.tahun}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    // Stream file dari URL ke response
    https.get(file.pdf_url, (fileRes) => {
      fileRes.pipe(res);
    }).on('error', (err) => {
      console.error('Download error:', err.message);
      res.status(500).json({ message: 'Gagal mengunduh file' });
    });

  } catch (err) {
    console.error('Server error:', err.message);
    res.status(500).json({ message: 'Gagal download file' });
  }
};