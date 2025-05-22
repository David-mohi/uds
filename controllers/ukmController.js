import db from "../config/db.js"
import bunny from "../config/bunny.js";
import sanitizeHtml from "sanitize-html";
import { validationResult } from "express-validator";
import { logActivity } from "./utils/logActivityAdmin.js";
import cache from "./utils/Cache.js";

export async function uploadUkm(req, res) {
  const { nama_ukm, deskripsi } = req.body;
  const gambar = req.uploadedFiles?.gambar?.[0];

  // Validasi
  if (!nama_ukm || !deskripsi) {
    return res.status(400).json({ message: "Nama UKM dan deskripsi wajib diisi" });
  }

  if (nama_ukm.length > 100) {
    return res.status(400).json({ message: "Nama UKM maksimal 100 karakter" });
  }

  if (deskripsi.length > 1000) {
    return res.status(400).json({ message: "Deskripsi maksimal 1000 karakter" });
  }

  // Validasi gambar opsional
  if (!gambar || !gambar.url) {
    return res.status(400).json({ message: "Gambar UKM harus diunggah" });
  }

  // Sanitasi
  const cleanNama = sanitizeHtml(nama_ukm.trim(), { allowedTags: [], allowedAttributes: {} });
  const cleanDeskripsi = sanitizeHtml(deskripsi.trim(), { allowedTags: [], allowedAttributes: {} });
  const cleanUrl = sanitizeHtml(gambar.url, { allowedTags: [], allowedAttributes: {} });

  try {
    const [result] = await db.query(
      `INSERT INTO ukm_mahasiswa(nama_ukm, gambar_url, deskripsi) VALUES (?, ?, ?)`,
      [cleanNama, cleanUrl, cleanDeskripsi]
    );

    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: "upload",
      targetId: result.insertId,
      targetTable: "ukm_mahasiswa",
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      message: `Mengunggah UKM dengan nama UKM "${cleanNama}"`,
    });
    
    cache.del("ukm_cache")
    
    res.status(200).json({ message: "Berhasil menambahkan data", id: result.insertId });
  } catch (error) {
    console.error("Gagal upload data UKM:", error);
    res.status(500).json({ message: "Terjadi kesalahan saat menyimpan data" });
  }
}

export async function getUkm(req, res) {
  try {
    const cacheKey = "ukm_cache"
    const cachedData = cache.get(cacheKey)
    if (cachedData) return res.json(cachedData);
    const [rows] = await db.query("SELECT * FROM ukm_mahasiswa ORDER BY id")
    cache.set(cacheKey, rows, 43200)
    res.json(rows)
  } catch (error) {
    console.error(err);
    res.status(500).json({ message: "Gagal mengambil data UKM" });
  }
}

export async function deleteUkm(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;

  try {
    const [rows] = await db.query('SELECT * FROM ukm_mahasiswa WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Data tidak ditemukan' });

    const data = rows[0];

    // Ambil base URL dari pull zone Bunny
    const pullZoneBase = bunny.pullZoneUrl.endsWith('/')
      ? bunny.pullZoneUrl
      : bunny.pullZoneUrl + '/';

    // Hapus gambar jika ada
    if (data.gambar_url) {
      const relativePath = data.gambar_url.replace(pullZoneBase, '');
      const deleteUrl = `${bunny.host}/${bunny.storageZone}/${relativePath}`;

      const response = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          AccessKey: bunny.apiKey,
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn('Gagal hapus bukti dari Bunny:', errText);
      } else {
        console.log('Bukti berhasil dihapus dari Bunny:', relativePath);
      }
    }

    await db.query('DELETE FROM ukm_mahasiswa WHERE id = ?', [id]);

    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: "upload",
      targetId: id,
      targetTable: "ukm_mahasiswa",
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      message: `Menghapus UKM dengan nama UKM "${data.nama_ukm}"`,
    });
    
    cache.del("ukm_cache")
    
    res.json({ message: 'Data dan file berhasil dihapus' });
  } catch (err) {
    console.error('Gagal menghapus data UKM:', err);
    res.status(500).json({ message: 'Gagal menghapus data' });
  }
};