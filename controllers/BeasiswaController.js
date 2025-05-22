import sanitizeHtml from "sanitize-html";
import db from "../config/db.js"
import bunny from "../config/bunny.js";
import { validationResult } from "express-validator";
import { logActivity } from "./utils/logActivityAdmin.js";
import cache from "./utils/Cache.js";

export const uploadDokumenBeasiswa = async (req, res) => {
  try {
    const { judul_beasiswa, deskripsi } = req.body;
    const uploadedDokumen = req.uploadedFiles?.dokumen?.[0];

    // Validasi
    if (!judul_beasiswa || !deskripsi) {
      return res.status(400).json({ error: "Judul dan deskripsi wajib diisi." });
    }

    if (judul_beasiswa.length > 155 || deskripsi.length > 1000) {
      return res.status(400).json({ error: "Field melebihi batas maksimal karakter." });
    }

    const sanitizedJudulBeasiswa = sanitizeHtml(judul_beasiswa.trim(), { allowedTags: [], allowedAttributes: {} });
    const sanitizedDeskripsi = sanitizeHtml(deskripsi.trim(), { allowedTags: [], allowedAttributes: {} });

    if (!uploadedDokumen) {
      return res.status(400).json({ error: "File dokumen tidak ditemukan." });
    }

    if (uploadedDokumen.size > 3 * 1024 * 1024) {
      return res.status(400).json({ error: "Ukuran dokumen maksimal 3MB." });
    }

    const dokumenUrl = uploadedDokumen.url;

    // Simpan ke database
    const [result] = await db.query(
      `INSERT INTO beasiswa (judul_beasiswa, deskripsi, dokumen_url)
       VALUES (?, ?, ?)`,
      [sanitizedJudulBeasiswa, sanitizedDeskripsi, dokumenUrl]
    );

    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: 'upload',
      targetId: result.insertId,
      targetTable: 'beasiswa',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      message: `Mengunggah dokumen beasiswa dengan judul "${sanitizedJudulBeasiswa}"`,
    });

    // Hapus cache setelah upload
    cache.del("dokumen_beasiswa_all");
    
    res.json({ message: "Dokumen beasiswa berhasil diupload." });
  } catch (err) {
    console.error("Gagal upload dokumen beasiswa:", err);
    res.status(500).json({ message: "Gagal upload dokumen beasiswa." });
  }
};

export const getDokumenBeasiswa = async (req, res) => {
  const cacheKey = "dokumen_beasiswa_all";

  // Cek cache 
  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    return res.json(cachedData);
  }

  try {
    const [results] = await db.query("SELECT * FROM beasiswa ORDER BY created_at DESC");

    // Simpan ke cache selama 5 menit (TTL default)
    cache.set(cacheKey, results, 76400);

    res.json(results);
  } catch (err) {
    console.error("Gagal mengambil dokumen beasiswa:", err);
    res.status(500).json({ message: "Gagal mengambil dokumen beasiswa." });
  }
}; //ss

export const updateDokumenBeasiswa = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const { id } = req.params;
  const { judul_beasiswa, deskripsi } = req.body;
  const uploadedDokumen = req.uploadedFiles?.dokumen?.[0];

  // Validasi input wajib
  if (!judul_beasiswa || !deskripsi) {
    return res.status(400).json({ error: "Judul dan deskripsi wajib diisi." });
  }

  // Batas Maksimal Karakter
  if (judul_beasiswa.length > 155 || deskripsi.length > 1000) {
    return res.status(400).json({ error: "Field melebihi batas maksimal karakter." });
  }

  // Sanitasi input
  const sanitizedjudul_beasiswa = sanitizeHtml(judul_beasiswa.trim(), { allowedTags: [], allowedAttributes: {} });
  const sanitizedDeskripsi = sanitizeHtml(deskripsi.trim(), { allowedTags: [], allowedAttributes: {} });

  // Validasi file (jika ada)
  if (uploadedDokumen && uploadedDokumen.size > 2 * 1024 * 1024) {
    return res.status(400).json({ error: "Ukuran dokumen maksimal 2MB." });
  }

  try {
    // Ambil data lama
    const [existing] = await db.query("SELECT * FROM beasiswa WHERE id = ?", [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: "Data dokumen beasiswa tidak ditemukan" });
    }

    const oldFileUrl = existing[0].dokumen_url;
    const pullZoneBase = bunny.pullZoneUrl.endsWith('/') ? bunny.pullZoneUrl : bunny.pullZoneUrl + '/';
    const newFileUrl = uploadedDokumen?.url;

    // Hapus file lama jika ada file baru
    if (newFileUrl && oldFileUrl) {
      try {
        const relativePath = oldFileUrl.replace(pullZoneBase, '');
        const deleteUrl = `${bunny.host}/${bunny.storageZone}/${relativePath}`;

        const resDel = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: {
            AccessKey: bunny.apiKey,
          },
        });

        if (!resDel.ok) {
          const errText = await resDel.text();
          console.warn(`Gagal hapus file lama ${oldFileUrl}:`, errText);
        }
        // console.log yang berhasil dihapus
      } catch (err) {
        console.error("Gagal hapus file lama dari Bunny:", err);
      }
    }

    // Bangun query UPDATE
    const fields = [
      "judul_beasiswa = ?",
      "deskripsi = ?",
    ];
    const values = [
      sanitizedjudul_beasiswa,
      sanitizedDeskripsi,
    ];

    if (newFileUrl) {
      fields.push("dokumen_url = ?");
      values.push(newFileUrl);
    }

    const updateQuery = `UPDATE beasiswa SET ${fields.join(', ')} WHERE id = ?`;
    values.push(id);

    await db.query(updateQuery, values);

    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: 'update',
      targetId: id,
      targetTable: 'beasiswa',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      message: `Mengupdate dokumen beasiswa`,
    });
    
    cache.del("dokumen_beasiswa_all");

    res.json({ message: "Dokumen beasiswa berhasil diperbarui." });
  } catch (err) {
    console.error("Error saat update dokumen beasiswa:", err);
    res.status(500).json({ message: "Terjadi kesalahan saat memperbarui data." });
  }
};

export const deleteDokumenBeasiswa = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;

  try {
    const [rows] = await db.query('SELECT * FROM beasiswa WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Data tidak ditemukan' });
    }

    const data = rows[0];
    const fileUrl = data.dokumen_url;

    // Hapus file dari Bunny jika ada
    if (fileUrl) {
      const pullZoneBase = bunny.pullZoneUrl.endsWith('/')
        ? bunny.pullZoneUrl
        : bunny.pullZoneUrl + '/';
      const relativePath = fileUrl.replace(pullZoneBase, '');
      const deleteUrl = `${bunny.host}/${bunny.storageZone}/${relativePath}`;

      try {
        const response = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: {
            AccessKey: bunny.apiKey,
          },
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error('Gagal hapus file:', errText);
        }
        // log sukses dihapus
      } catch (err) {
        console.error('Gagal mengirim permintaan ke Bunny:', err);
      }
    }

    // Hapus dari database (dilakukan apapun kondisi file)
    await db.query('DELETE FROM beasiswa WHERE id = ?', [id]);

    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: 'delete',
      targetId: id,
      targetTable: 'beasiswa',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      message: `Menghapus dokumen beasiswa dengan judul "${data.judul_beasiswa}"`,
    });

    cache.del("dokumen_beasiswa_all");

    res.status(200).json({ message: 'Data dan file berhasil dihapus' });
  } catch (error) {
    console.error('Error saat menghapus data dokumen Beasiswa:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat menghapus data' });
  }
};