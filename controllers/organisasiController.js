import db from '../config/db.js';
import bunny from "../config/bunny.js";
import sanitizeHtml from 'sanitize-html';
import validator from "validator"
import { validationResult } from 'express-validator';
import { logActivity } from './utils/logActivityAdmin.js';
import cache from './utils/Cache.js';

export const addStrukturOrganisasi = async (req, res) => {
  const { nama, jabatan, urutan } = req.body;

  // Validasi wajib isi
  if (!nama || !jabatan) {
    return res.status(400).json({ message: "Nama dan jabatan wajib diisi." });
  }

  // Validasi panjang maksimal
  if (nama.length > 100 || jabatan.length > 100) {
    return res.status(400).json({ message: "Nama dan jabatan maksimal 100 karakter." });
  }

  // Validasi urutan (boleh kosong, tapi kalau ada harus angka positif)
  if (urutan && !validator.isInt(urutan.toString(), { min: 1 })) {
    return res.status(400).json({ message: "Urutan harus berupa angka positif." });
  }

  // Sanitasi input
  const cleanNama = sanitizeHtml(nama.trim(), { allowedTags: [], allowedAttributes: {} });
  const cleanJabatan = sanitizeHtml(jabatan.trim(), { allowedTags: [], allowedAttributes: {} });
  const cleanUrutan = urutan ? parseInt(urutan) : null;

  try {
    const [result] = await db.query(
      "INSERT INTO struktur_organisasi (nama, jabatan, urutan) VALUES (?, ?, ?)",
      [cleanNama, cleanJabatan, cleanUrutan]
    );

    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: "upload",
      targetId: result.insertId,
      targetTable: "struktur_organisasi",
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      message: `Mengunggah anggota struktur organisasi dengan nama "${cleanNama}" dan dengan jabatan ${cleanJabatan}`,
    });

    cache.del("organisasi_cache")
    
    res.status(201).json({ message: "Struktur organisasi berhasil ditambahkan" });
  } catch (error) {
    console.error("Gagal menambahkan struktur organisasi:", error);
    res.status(500).json({ message: "Gagal menambahkan struktur organisasi" });
  }
};

export const getStrukturOrganisasi = async (req, res) => {
  try {
    const cacheKey = "organisasi_cache"
    const cachedData = cache.get(cacheKey)
    if (cachedData) {
      return res.status(200).json(cachedData)
    }

    const [rows] = await db.query('SELECT * FROM struktur_organisasi ORDER BY urutan ASC');

    cache.set(cacheKey, rows, 43200)
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal mengambil data struktur organisasi' });
  }
};

export const deleteStrukturOrganisasi = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;

  try {
    const [rows] = await db.query("SELECT * FROM struktur_organisasi WHERE id = ?", [id])
    if (rows.length === 0) return res.status(404).json({ message: "Data tidak ditemukan"})
    
    const data = rows[0]
    
    await db.query('DELETE FROM struktur_organisasi WHERE id = ?', [id]);

    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: "delete",
      targetId: id,
      targetTable: "struktur_organisasi",
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      message: `Menghapus anggota struktur organisasi dengan nama "${data.nama}" dan dengan jabatan ${data.jabatan}`,
    });
    
    cache.del("organisasi_cache")
    cache.del("organisasi_gambar")
    
    res.json({ message: 'Data dan gambar berhasil dihapus' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal menghapus data' });
  }
};

export async function getGambarStruktur(req, res) {
  const cacheKey = "organisasi_gambar"
  const cachedData = cache.get(cacheKey)
  if (cachedData) {
    return res.status(200).json(cachedData)
  }

  try {
    const [row] = await db.query("SELECT * FROM gambar_struktur")
    cache.set(cacheKey, row, 43200)
    res.json(row)
  } catch (error) {
    console.error("Terjadi kesalahan", err)
    res.status(500).json({message: "Terjadi kesalhan saat mengambil data."})
  }
}

export async function uploadGambarStruktur(req, res) {
  const { judul } = req.body;
  const gambar = req.uploadedFiles?.gambar?.[0];

  // Validasi gambar
  if (!gambar) {
    return res.status(400).json({ message: "Gambar harus diunggah." });
  }

  // Validasi ukuran gambar maksimal 5MB
  const MAX_FILE_SIZE = 1 * 1024 * 1024; // 5MB
  if (gambar.size > MAX_FILE_SIZE) {
    return res.status(400).json({ message: "Ukuran file gambar maksimal 5MB." });
  }

  // Validasi judul
  if (!judul || judul.trim().length > 100) {
    return res.status(400).json({ message: "Judul wajib diisi dan maksimal 100 karakter." });
  }

  // Sanitasi input judul
  const sanitizedJudul = sanitizeHtml(judul.trim(), { allowedTags: [], allowedAttributes: {} });

  try {
    const [row] = await db.query(
      "INSERT INTO gambar_struktur (judul, gambar_url) VALUES (?, ?)",
      [sanitizedJudul, gambar.url]
    );

    cache.del("organisasi_cache")
    cache.del("organisasi_gambar")
    res.json({ message: "Gambar struktur berhasil ditambahkan", id: row.insertId });
  } catch (error) {
    console.error("Terjadi kesalahan:", error);
    res.status(500).json({ message: "Terjadi kesalahan saat menyimpan data gambar struktur." });
  }
}

export const deleteGambarStruktur = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;

  try {
    const [rows] = await db.query('SELECT * FROM gambar_struktur WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Berita tidak ditemukan' });

    const struktur = rows[0];

    // Hapus gambar dari Bunny jika ada
    if (struktur.gambar_url) {
      const pullZoneBase = bunny.pullZoneUrl.endsWith('/') ? bunny.pullZoneUrl : bunny.pullZoneUrl + '/';
      const relativePath = struktur.gambar_url.replace(pullZoneBase, '');
      const deleteUrl = `${bunny.host}/${bunny.storageZone}/${relativePath}`;
    
      const response = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          AccessKey: bunny.apiKey,
        },
      });
    
      if (!response.ok) {
        const errText = await response.text();
        console.warn('Gagal hapus gambar dari Bunny:', errText);
      }
    }    

    await db.query('DELETE FROM gambar_struktur WHERE id = ?', [id]);
    cache.del("organisasi_cache")
    cache.del("organisasi_gambar")
    res.json({ message: 'Gambar struktur berhasil dihapus' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal hapus berita' });
  }
};