import db from "../config/db.js";
import { v2 as cloudinary } from "cloudinary";
import https from "https"
import { validationResult } from "express-validator";
import validator from "validator"
import { logActivity } from "./utils/logActivityAdmin.js";
import cache from "./utils/Cache.js";

export const uploadKalenderAkademik = async (req, res) => {
  try {
    let { tahunAjaran, semester } = req.body;
    const pdfFile = req.file?.path;

    // Sanitasi
    tahunAjaran = validator.escape(tahunAjaran?.trim() || '');
    semester = validator.escape(semester?.trim() || '');

    // Validasi
    const tahunRegex = /^\d{4}\/\d{4}$/; // contoh: 2024/2025
    const semesterValid = ['Ganjil', 'Genap', 'Pendek'];

    if (!tahunAjaran || !semester || !pdfFile) {
      return res.status(400).json({ message: "Semua field wajib diisi dan file harus diunggah" });
    }

    if (!tahunRegex.test(tahunAjaran)) {
      return res.status(400).json({ message: "Format tahun ajaran tidak valid. Gunakan format contoh: 2024/2025" });
    }

    if (!semesterValid.includes(semester)) {
      return res.status(400).json({ message: "Semester tidak valid. Gunakan salah satu dari: Ganjil, Genap, Pendek" });
    }

    const [result] = await db.query(
      "INSERT INTO kalender_akademik (tahun_ajaran, semester, pdf_url) VALUES (?, ?, ?)",
      [tahunAjaran, semester, pdfFile]
    );

    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: "upload",
      targetId: result.insertId,
      targetTable: "kalender_akademik",
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      message: `Mengunggah kalender akademik semester "${semester}"tahun ajaran "${tahunAjaran}"`,
    });

    cache.del("kalender_akademik_cache")
    
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error("Upload kalender akademik gagal:", err);
    res.status(500).json({ message: "Gagal menyimpan kalender akademik" });
  }
};

export const getKalenderAkademik = async (req, res) => {
  const LIMIT = 4;
  const cacheKey = "kalender_akademik_cache";

  try {
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    const [rows] = await db.query(
      "SELECT * FROM kalender_akademik ORDER BY created_at DESC LIMIT ?",
      [LIMIT]
    );

    cache.set(cacheKey, rows, 43200);

    return res.status(200).json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal mengambil data kalender akademik" });
  }
};

export const updateKalenderAkademik = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { tahunAjaran, semester } = req.body;
  const newFilePath = req.file?.path;

  try {
    const [rows] = await db.query("SELECT * FROM kalender_akademik WHERE id = ?", [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Data tidak ditemukan' });
    }

    const existing = rows[0];
    const oldFileUrl = existing.pdf_url;
    let finalFileUrl = oldFileUrl;


    if (newFilePath && oldFileUrl) {
      const urlParts = oldFileUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const folder = urlParts[urlParts.length - 2];
      const publicId = `${folder}/${fileName}`;

      try {
        const result = await cloudinary.uploader.destroy(publicId, {
          resource_type: 'raw',
        });

        if (result.result !== 'ok') {
          console.warn('Gagal hapus file lama dari Cloudinary:', result);
        }
      } catch (err) {
        console.error('Gagal menghapus file dari Cloudinary:', err);
      }

      finalFileUrl = newFilePath;
    }

    await db.query(
      "UPDATE kalender_akademik SET tahun_ajaran = ?, semester = ?, pdf_url = ? WHERE id = ?",
      [tahunAjaran, semester, finalFileUrl, id]
    );

    cache.del("kalender_akademik_cache")
    
    res.json({ message: 'Kalender akademik berhasil diperbarui' });
  } catch (err) {
    console.error("Gagal update kalender akademik:", err);
    res.status(500).json({ message: 'Gagal memperbarui data' });
  }
};

export const delKalenderAkademik = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;

  try {
    const [rows] = await db.query('SELECT * FROM kalender_akademik WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Data tidak ditemukan' });

    const pdfFile = rows[0];

    if (pdfFile.pdf_url) {
      const urlParts = pdfFile.pdf_url.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const folder = urlParts[urlParts.length - 2];
      const publicId = `${folder}/${fileName}`; // ID tanpa ekstensi, karena raw file

      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'raw',
      });

      if (result.result !== 'ok') {
        console.warn('Gagal hapus file dari Cloudinary:', result);
      }
    }

    // Hapus dari database
    await db.query('DELETE FROM kalender_akademik WHERE id = ?', [id]);

    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: "upload",
      targetId: id,
      targetTable: "kalender_akademik",
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      message: `Menghapus kalender akademik semester "${pdfFile.semester} "tahun ajaran "${pdfFile.tahun_ajaran}"`,
    });

    cache.del("kalender_akademik_cache")
    
    res.json({ message: 'Data dan file berhasil dihapus' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal menghapus data' });
  }
};

// kalender-akademik.routes.js
export const downloadKalender = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { filename } = req.query;
  const allowedDomain = "https://res.cloudinary.com/dbcm8omwq";

  try {
    const [rows] = await db.query("SELECT * FROM kalender_akademik WHERE id = ?", [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'File tidak ditemukan' });

    const file = rows[0];
    
    // Validasi URL cloudinary
    if (!file.pdf_url.startsWith(allowedDomain)) {
      return res.status(403).json({ message: 'URL tidak diizinkan' });
    }

    // nama file
    const fileName = filename || `kalender-akademik-${file.semester}-${file.tahun_ajaran}.pdf`;

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
