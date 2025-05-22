import db from '../config/db.js';
import sanitize from 'sanitize-html';
import bunny from '../config/bunny.js';
import { validationResult } from 'express-validator';
import cache from './utils/Cache.js';
import crypto from "crypto"

const CACHE_PREFIX = 'pengaduan_list:';

export const createPengaduan = async (req, res) => {
  try {
    const { nama, email, kategori, captchaToken, isi_pengaduan: rawIsi } = req.body;

    if (!kategori || !rawIsi || !captchaToken) {
      return res.status(400).json({ message: 'Kategori, isi pengaduan, dan captcha wajib diisi.' });
    }

    // Verifikasi reCAPTCHA
    const secretKey = process.env.RECAPTCHA_SECRET;
    const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${captchaToken}`;
    const captchaResponse = await fetch(verifyUrl, { method: 'POST' });
    const captchaData = await captchaResponse.json();

    if (!captchaData.success || captchaData.score < 0.5) {
      return res.status(400).json({ message: 'Verifikasi CAPTCHA gagal. Silakan coba lagi.' });
    }

    // Sanitasi dan validasi isi pengaduan
    const isi_pengaduan = sanitize(rawIsi.trim(), { allowedTags: [], allowedAttributes: {} });
    if (isi_pengaduan.length > 1000) {
      return res.status(400).json({ message: 'Isi pengaduan maksimal 1000 karakter.' });
    }

    const cleanNama = nama ? sanitize(nama.trim(), { allowedTags: [], allowedAttributes: {} }) : null;
    const cleanEmail = email ? sanitize(email.trim(), { allowedTags: [], allowedAttributes: {} }) : null;

    if (cleanNama && cleanNama.length > 100) {
      return res.status(400).json({ message: 'Nama maksimal 100 karakter.' });
    }
    if (cleanEmail && cleanEmail.length > 100) {
      return res.status(400).json({ message: 'Email maksimal 100 karakter.' });
    }
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ message: 'Format email tidak valid.' });
    }

    const file = req.files?.gambar?.[0];
    const maxSize = 2 * 1024 * 1024;
    if (file && file.size > maxSize) {
      return res.status(400).json({
        message: `Ukuran file maksimal 2MB, file yang diunggah: 2MB`,
      });
    }

    const bukti_upload = req.uploadedFiles?.gambar?.[0]?.url || null;

    const [result] = await db.query(
      'INSERT INTO pengaduan (nama, email, kategori, isi_pengaduan, bukti_upload) VALUES (?, ?, ?, ?, ?)',
      [cleanNama, cleanEmail, kategori, isi_pengaduan, bukti_upload]
    );

    // Hapus cache list pengaduan setelah create
    const keys = cache.keys();
    const keysToDelete = keys.filter(key => key.startsWith(CACHE_PREFIX));
    keysToDelete.forEach(key => cache.del(key));

    res.status(201).json({ message: 'Pengaduan berhasil dikirim', id: result.insertId });

  } catch (error) {
    console.error("Gagal memproses pengaduan:", error);
    res.status(500).json({ message: 'Terjadi kesalahan saat mengirim pengaduan' });
  }
};

export const getAllPengaduan = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Convert status dari string ke number, jika ada
    const statusFilter = req.query.status !== undefined ? Number(req.query.status) : undefined;

    // Buat cache key unik berdasar parameter
    const cacheKeyRaw = JSON.stringify({ page, limit, status: statusFilter });
    const cacheKey = `${CACHE_PREFIX}${crypto.createHash("md5").update(cacheKeyRaw).digest("hex")}`;

    // Cek cache
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    let countQuery = 'SELECT COUNT(*) as total FROM pengaduan';
    let dataQuery = 'SELECT * FROM pengaduan';
    let queryParams = [];
    let countParams = [];

    if (statusFilter !== undefined) {
      countQuery += ' WHERE status = ?';
      dataQuery += ' WHERE status = ?';
      queryParams.push(statusFilter);
      countParams.push(statusFilter);
    }

    dataQuery += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(limit, offset);

    const [[{ total }]] = await db.query(countQuery, countParams);
    const [rows] = await db.query(dataQuery, queryParams);

    const response = {
      data: rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    cache.set(cacheKey, response, 60);

    res.status(200).json(response);
  } catch (error) {
    console.error('Error di getAllPengaduan:', error);
    res.status(500).json({ message: 'Gagal mengambil data pengaduan', error: error.message });
  }
};

export const deletePengaduan = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;

  try {
    const [rows] = await db.query('SELECT * FROM pengaduan WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Data tidak ditemukan' });

    const data = rows[0];

    // hapus file lampiran
    const pullZoneBase = process.env.BUNNY_PULL_ZONE_URL.endsWith('/')
      ? process.env.BUNNY_PULL_ZONE_URL
      : process.env.BUNNY_PULL_ZONE_URL + '/';

    if (data.bukti_upload) {
      const relativePath = data.bukti_upload.replace(pullZoneBase, '');
      const deleteUrl = `${process.env.BUNNY_HOST}/${process.env.BUNNY_STORAGE_ZONE}/${relativePath}`;

      const response = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          AccessKey: process.env.BUNNY_API_KEY,
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn('Gagal hapus bukti dari Bunny:', errText);
      } else {
        console.log('Bukti berhasil dihapus dari Bunny:', relativePath);
      }
    }

    // Hapus data pengaduan dari DB
    await db.query('DELETE FROM pengaduan WHERE id = ?', [id]);

    // Hapus semua cache list pengaduan
    const keys = cache.keys();
    const keysToDelete = keys.filter(key => key.startsWith(CACHE_PREFIX));
    keysToDelete.forEach(key => cache.del(key));

    res.json({ message: 'Data dan file berhasil dihapus' });

  } catch (err) {
    console.error('Gagal menghapus data pengaduan:', err);
    res.status(500).json({ message: 'Gagal menghapus data' });
  }
};

export const updateStatusPengaduan = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { status } = req.body;

  try {
    const [result] = await db.query(
      'UPDATE pengaduan SET status = ? WHERE id = ?',
      [status ? 1 : 0, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
    }

    // Hapus cache list pengaduan setelah update status
    const keys = cache.keys();
    const keysToDelete = keys.filter(key => key.startsWith(CACHE_PREFIX));
    keysToDelete.forEach(key => cache.del(key));

    res.json({ success: true, message: 'Status berhasil diperbarui' });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ success: false, error: 'Gagal memperbarui status' });
  }
};