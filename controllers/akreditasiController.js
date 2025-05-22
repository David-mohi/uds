import db from '../config/db.js';
import bunny from '../config/bunny.js';
import sanitizeHtml from "sanitize-html"
import { validationResult } from 'express-validator';
import { logActivity } from './utils/logActivityAdmin.js';
import cache from "./utils/Cache.js"

export const getAkreditasi = async (req, res) => {
  try {
    const cacheKey = 'akreditasi-list';
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    const [rows] = await db.query("SELECT * FROM akreditasi ORDER BY fakultas, prodi");
    cache.set(cacheKey, rows, 86400); // cache ttl 24 jam
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


// export const getAkreditasiByProdi = async (req, res) => {
//   const errors = validationResult(req);
//   if (!errors.isEmpty()) {
//     return res.status(400).json({ errors: errors.array() });
//   }
//   let { prodi } = req.params;

//   try {
//     prodi = prodi.replace(/-/g, ' ').toLowerCase();

//     const [rows] = await db.query(
//       "SELECT * FROM akreditasi WHERE LOWER(prodi) = ?",
//       [prodi]
//     );

//     if (rows.length === 0) {
//       return res.status(404).json({ message: "Data tidak ditemukan" });
//     }

//     res.json(rows[0]);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: err.message });
//   }
// };

export const uploadAkreditasi = async (req, res) => {
  try {
    const { prodi, fakultas, status_akreditasi } = req.body;
    const uploadedDokumen = req.uploadedFiles?.dokumen?.[0];

    if (!prodi || !fakultas || !status_akreditasi) {
      return res.status(400).json({ error: "Semua field wajib diisi." });
    }

    if (prodi.length > 50 || fakultas.length > 50 || status_akreditasi.length > 15) {
      return res.status(400).json({ error: "Field melebihi batas maksimal karakter." });
    }

    const sanitizedProdi = sanitizeHtml(prodi.trim(), { allowedTags: [], allowedAttributes: {} });
    const sanitizedFakultas = sanitizeHtml(fakultas.trim(), { allowedTags: [], allowedAttributes: {} });
    const sanitizedStatus = sanitizeHtml(status_akreditasi.trim(), { allowedTags: [], allowedAttributes: {} });

    if (!uploadedDokumen) {
      return res.status(400).json({ error: "File dokumen tidak ditemukan." });
    }

    if (uploadedDokumen.size > 2 * 1024 * 1024) {
      return res.status(400).json({ error: "Ukuran dokumen maksimal 2MB." });
    }

    const sertifikatUrl = uploadedDokumen.url;
    const originalName = uploadedDokumen.name;

    const [result] = await db.query(
      `INSERT INTO akreditasi (prodi, fakultas, status_akreditasi, sertifikat_url, sertifikat_asli)
       VALUES (?, ?, ?, ?, ?)`,
      [sanitizedProdi, sanitizedFakultas, sanitizedStatus, sertifikatUrl, originalName]
    );

    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: "create",
      targetId: result.insertId,
      targetTable: "akreditasi",
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      message: `Mengupload akreditasi untuk prodi "${sanitizedProdi}" fakultas "${sanitizedFakultas}"`,
    });

    cache.del("akreditasi-list")
    
    res.json({ message: "Akreditasi berhasil diupload" });
  } catch (err) {
    console.error("Gagal upload akreditasi:", err);
    res.status(500).json({ message: "Gagal upload akreditasi." });
  }
};


export const deleteAkreditasi = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;

  try {
    const [rows] = await db.query('SELECT * FROM akreditasi WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Data tidak ditemukan' });

    const data = rows[0];
    const fileUrl = data.sertifikat_url;

    if (fileUrl) {
      const pullZoneBase = bunny.pullZoneUrl.endsWith('/') ? bunny.pullZoneUrl : bunny.pullZoneUrl + '/';
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
          console.error('Gagal hapus file dari Bunny:', errText);
        } else {
          console.log('File berhasil dihapus dari Bunny:', relativePath);
        }
      } catch (err) {
        console.error('Gagal mengirim permintaan ke Bunny:', err);
      }
    }

    await db.query('DELETE FROM akreditasi WHERE id = ?', [id]);

    // Audit Log
    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: "delete",
      targetId: id,
      targetTable: "akreditasi",
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      message: `Menghapus akreditasi untuk prodi "${data.prodi}" fakultas "${data.fakultas}"`,
    });

    cache.del("akreditasi-list")
    
    res.status(200).json({ message: 'Data dan file berhasil dihapus' });
  } catch (error) {
    console.error('Error saat menghapus data akreditasi:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat menghapus data' });
  }
};

export const updateAkreditasi = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const { id } = req.params;
  const { prodi, fakultas, status_akreditasi } = req.body;
  const uploadedDokumen = req.uploadedFiles?.dokumen?.[0];

  // Validasi input wajib
  if (!prodi || !fakultas || !status_akreditasi) {
    return res.status(400).json({ error: "Semua field wajib diisi." });
  }

  // Batas Maksimal Karakter
  if (prodi.length > 50 || fakultas.length > 50 || status_akreditasi.length > 15) {
    return res.status(400).json({ error: "Field melebihi batas maksimal karakter." });
  }

  // Sanitasi input
  const sanitizedProdi = sanitizeHtml(prodi, { allowedTags: [], allowedAttributes: {} });
  const sanitizedFakultas = sanitizeHtml(fakultas, { allowedTags: [], allowedAttributes: {} });
  const sanitizedStatus = sanitizeHtml(status_akreditasi, { allowedTags: [], allowedAttributes: {} });

  // Validasi file (jika ada)
  if (uploadedDokumen && uploadedDokumen.size > 2 * 1024 * 1024) {
    return res.status(400).json({ error: "Ukuran dokumen maksimal 2MB." });
  }

  try {
    // Cek data lama
    const [existing] = await db.query("SELECT * FROM akreditasi WHERE id = ?", [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: "Data akreditasi tidak ditemukan" });
    }

    const oldFileUrl = existing[0].sertifikat_url;
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
          console.warn(`Gagal hapus sertifikat lama ${oldFileUrl}:`, errText);
        } else {
          console.log(`Sertifikat lama berhasil dihapus: ${relativePath}`);
        }
      } catch (err) {
        console.error('Gagal hapus file lama dari Bunny:', err);
      }
    }

    // Bangun query UPDATE
    const fields = [
      "prodi = ?",
      "fakultas = ?",
      "status_akreditasi = ?",
    ];
    const values = [
      sanitizedProdi,
      sanitizedFakultas,
      sanitizedStatus,
    ];

    if (newFileUrl) {
      fields.push("sertifikat_url = ?");
      values.push(newFileUrl);
    }

    if (uploadedDokumen?.name) {
      fields.push("sertifikat_asli = ?");
      values.push(uploadedDokumen.name);
    }

    const updateQuery = `UPDATE akreditasi SET ${fields.join(', ')} WHERE id = ?`;
    values.push(id);

    await db.query(updateQuery, values);

    // 🔒 Audit Log
    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: "update",
      targetId: id,
      targetTable: "akreditasi",
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      message: `Memperbarui akreditasi untuk prodi "${existing[0].prodi}" fakultas "${existing[0].fakultas}"`,
    });
    
    cache.del("akreditasi-list")
    
    res.json({ message: "Akreditasi berhasil diperbarui" });
  } catch (err) {
    console.error('Error saat update akreditasi:', err);
    res.status(500).json({ message: "Terjadi kesalahan saat memperbarui data" });
  }
};