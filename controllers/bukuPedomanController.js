import db from "../config/db.js"
import { v2 as cloudinary } from "cloudinary"
import https from "https"
import sanitizeHtml from "sanitize-html"
import { validationResult } from "express-validator"
import { logActivity } from "./utils/logActivityAdmin.js"
import cache from "./utils/Cache.js"

export async function getBukuPedoman(req, res) {
  try {
    const cacheKey = 'buku_pedoman_all';

    // Cek cache
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    const [row] = await db.query("SELECT * FROM buku_pedoman ORDER BY id");

    // Simpan ke cache
    cache.set(cacheKey, row, 86400);

    res.json(row);
  } catch (err) {
    res.status(500).json({ message: "Terjadi kesalahan saat mengambil data buku pedoman"});
    console.error("Gagal mengambil data buku pedoman", err)
  }
}

export async function createBukuPedoman(req, res) {
  let { deskripsi, judul } = req.body;
  const bukuFile = req.file;

  // Sanitasi input
  judul = sanitizeHtml(judul, { allowedTags: [], allowedAttributes: {} }).trim();
  deskripsi = sanitizeHtml(deskripsi, { allowedTags: [], allowedAttributes: {} }).trim();

  // Validasi
  const errors = [];
  if (!judul) errors.push("Judul wajib diisi");
  if (!deskripsi) errors.push("Deskripsi wajib diisi");
  if (judul.length > 100) errors.judul = "Judul maksimal 100 karakter";
  if (deskripsi.length > 1000) errors.deskripsi = "Deskripsi maksimal 500 karakter";
  if (!bukuFile) errors.push("File buku tidak ditemukan");
  if (bukuFile && bukuFile.size > 2 * 1024 * 1024) errors.push("Ukuran file buku maksimal 1MB");

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  try {
    const [result] = await db.query(
      "INSERT INTO buku_pedoman(buku_url, judul, deskripsi) VALUES (?, ?, ?)",
      [bukuFile.path, judul, deskripsi]
    );

    // log aktivitas
    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: 'create',
      targetId: result.insertId,
      targetTable: 'buku_pedoman',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      message: `Mengunggah buku pedoman dengan judul "${judul}"`,
    });

    cache.del("buku_pedoman_all")
    
    res.json({ message: "Buku pedoman berhasil diunggah" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Gagal membuat buku pedoman" });
  }
}

export async function updateBukuPedoman(req, res) {
  const errorsVal = validationResult(req);
  if (!errorsVal.isEmpty()) {
    return res.status(400).json({ errors: errorsVal.array() });
  }

  const { id } = req.params;
  let { deskripsi, judul } = req.body;
  const newFilePath = req.file?.path;

  // Sanitasi input
  judul = sanitizeHtml(judul || '', { allowedTags: [], allowedAttributes: {} }).trim();
  deskripsi = sanitizeHtml(deskripsi || '', { allowedTags: [], allowedAttributes: {} }).trim();

  // Validasi
  const errors = {};
  if (!judul) errors.judul = "Judul wajib diisi";
  if (judul.length > 100) errors.judul = "Judul maksimal 100 karakter";
  if (deskripsi.length > 1000) errors.deskripsi = "Deskripsi maksimal 1000 karakter";
  if (req.file && req.file.size > 2 * 1024 * 1024) {
    errors.buku = "Ukuran file maksimal 2MB";
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }

  try {
    // Ambil data lama
    const [rows] = await db.query("SELECT * FROM buku_pedoman WHERE id = ?", [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: "Buku pedoman tidak ditemukan" });
    }

    const oldData = rows[0];
    const oldFileUrl = oldData.buku_url;
    let finalFileUrl = oldFileUrl;

    // Hapus file lama di Cloudinary jika ada file baru
    if (newFilePath && oldFileUrl) {
      const urlParts = oldFileUrl.split('/');
      const fileName = urlParts[urlParts.length - 1].split('.')[0]; // Hapus ekstensi
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
        console.error('Error saat hapus file dari Cloudinary:', err);
      }

      finalFileUrl = newFilePath;
    }

    // Update database
    await db.query(
      "UPDATE buku_pedoman SET buku_url = ?, judul = ?, deskripsi = ? WHERE id = ?",
      [finalFileUrl, judul, deskripsi, id]
    );
    
    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: 'update',
      targetId: id,
      targetTable: 'buku_pedoman',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      message: `Memperbarui buku pedoman dengan judul "${oldData.judul}"`,
    });
    
    cache.del('buku_pedoman_all'); 

    res.json({ message: "Buku pedoman berhasil diperbarui" });
  } catch (err) {
    console.error("Gagal update buku pedoman:", err);
    res.status(500).json({ message: "Gagal memperbarui buku pedoman" });
  }
}

export const deleteBukuPedoman = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;

  try {
    const [rows] = await db.query('SELECT * FROM buku_pedoman WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Data tidak ditemukan' });

    const buku_url = rows[0];

    if (buku_url.buku_url) {
      const urlParts = buku_url.buku_url.split('/');
      const fileName = urlParts[urlParts.length - 1].split('.')[0]; // Hapus ekstensi
      const folder = urlParts[urlParts.length - 2];
      const publicId = `${folder}/${fileName}`;

      try {
        const result = await cloudinary.uploader.destroy(publicId, {
          resource_type: 'raw',
        });

        if (result.result !== 'ok') {
          console.warn('Gagal hapus file dari Cloudinary:', result);
        }
      } catch (err) {
        console.error('Error saat hapus file dari Cloudinary:', err);
      }
    }

    // Hapus dari database
    await db.query('DELETE FROM buku_pedoman WHERE id = ?', [id]);

    // Invalidate cache
    
    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: 'delete',
      targetId: id,
      targetTable: 'buku_pedoman',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      message: `Menghapus buku pedoman dengan judul "${buku_url.judul}"`,
    });
    
    cache.del('buku_pedoman_all');
    res.json({ message: 'Data dan file berhasil dihapus' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal menghapus data' });
  }
};

export async function downloadBukuPedoman(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { url, filename } = req.query;

  try {
    const client = url.startsWith("https") ? https : http;

    client.get(url, (fileRes) => {
      if (fileRes.statusCode !== 200) {
        return res.status(500).json({ message: "Gagal mengunduh file" });
      }

      res.setHeader("Content-Disposition", `attachment; filename="${filename}.pdf"`);
      res.setHeader("Content-Type", "application/pdf");
      fileRes.pipe(res);
    }).on("error", (err) => {
      console.error("Download error:", err.message);
      res.status(500).json({ message: "Gagal mengunduh file" });
    });
  } catch (err) {
    console.error("Server error:", err.message);
    res.status(500).json({ message: "Gagal mengunduh file" });
  }
}