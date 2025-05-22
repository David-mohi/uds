import db from '../config/db.js';
import sanitizeHtml from 'sanitize-html';
import { validationResult } from 'express-validator';
import { logActivity } from './utils/logActivityAdmin.js';
import cache from './utils/Cache.js';

// Ambil semua data jurusan pendaftaran
export const getJurusanPMB = async (req, res) => {
  try {
    const cacheKey = "jurusan_PMB_KEY"

    // Cek apakah data ada di cache
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    const [results] = await db.query('SELECT * FROM jurusan_pmb');

    cache.set(cacheKey, results, 21600);
    
    res.status(200).json(results);
  } catch (err) {
    console.error(err);  
    res.status(500).json({ message: 'Failed to retrieve jurusan pendaftaran data' });
  }
};

// Tambah jurusan pendaftaran baru
export const addJurusanPMB = async (req, res) => {
  const { fakultas, program_studi, biaya_spp } = req.body;

  // Sanitasi input untuk menghindari XSS atau konten tidak diinginkan
  const sanitizedFakultas = sanitizeHtml(fakultas, {
    allowedTags: [],
    allowedAttributes: {},
  });
  const sanitizedProgramStudi = sanitizeHtml(program_studi, {
    allowedTags: [],
    allowedAttributes: {},
  });

  // Validasi Input
  if (!sanitizedFakultas || !sanitizedProgramStudi || biaya_spp == null) {
    return res.status(400).json({ message: "Semua field wajib diisi" });
  }

  // Validasi Panjang Karakter
  if (sanitizedFakultas.length > 100) {
    return res.status(400).json({ message: "Fakultas maksimal 100 karakter" });
  }
  
  if (sanitizedProgramStudi.length > 100) {
    return res.status(400).json({ message: "Program studi maksimal 100 karakter" });
  }

  // Validasi Biaya SPP
  if (isNaN(biaya_spp) || biaya_spp <= 0) {
    return res.status(400).json({ message: "Biaya SPP harus lebih besar dari 0" });
  }

  // Validasi Panjang Karakter Biaya
  if (biaya_spp.toString().length > 10) {
    return res.status(400).json({ message: "Biaya SPP maksimal 10 digit" });
  }

  try {
    // Insert data ke database
    const query = 'INSERT INTO jurusan_pmb (fakultas, program_studi, biaya_spp) VALUES (?, ?, ?)';
    const [result] = await db.query(query, [sanitizedFakultas, sanitizedProgramStudi, biaya_spp]);

    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: "upload",
      targetId: result.insertId,
      targetTable: "jurusan_pmb",
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      message: `Mengunggah jurusan PMB dengan nama prodi "${sanitizedProgramStudi}" fakultas "${sanitizedFakultas}"`,
    });

    cache.del("jurusan_PMB_KEY")
    
    res.status(201).json({ message: 'Jurusan pendaftaran added', id: result.insertId });

  } catch (err) {
    console.error(err);  
    res.status(500).json({ message: 'Failed to add jurusan pendaftaran' });
  }
};

export const updateJurusanPMB = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { fakultas, program_studi, biaya_spp } = req.body;

  // Sanitasi
  const sanitizedFakultas = sanitizeHtml(fakultas, {
    allowedTags: [],
    allowedAttributes: {},
  });
  const sanitizedProgramStudi = sanitizeHtml(program_studi, {
    allowedTags: [],
    allowedAttributes: {},
  });

  // Validasi Input
  if (!sanitizedFakultas || !sanitizedProgramStudi || biaya_spp == null) {
    return res.status(400).json({ message: "Semua field wajib diisi" });
  }

  // Validasi Panjang Karakter
  if (sanitizedFakultas.length > 100) {
    return res.status(400).json({ message: "Fakultas maksimal 100 karakter" });
  }
  
  if (sanitizedProgramStudi.length > 100) {
    return res.status(400).json({ message: "Program studi maksimal 100 karakter" });
  }

  // Validasi Biaya SPP (harus angka dan lebih besar dari 0)
  if (isNaN(biaya_spp) || biaya_spp <= 0) {
    return res.status(400).json({ message: "Biaya SPP harus lebih besar dari 0" });
  }

  // Validasi Panjang Karakter Biaya (jika dibutuhkan)
  if (biaya_spp.toString().length > 10) {
    return res.status(400).json({ message: "Biaya SPP maksimal 10 digit" });
  }

  try {
    // Update data di database
    const query = 'UPDATE jurusan_pmb SET fakultas = ?, program_studi = ?, biaya_spp = ? WHERE id = ?';
    const [result] = await db.query(query, [sanitizedFakultas, sanitizedProgramStudi, biaya_spp, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Jurusan pendaftaran not found' });
    }

    cache.del("jurusan_PMB_KEY")
    
    res.status(200).json({ message: 'Jurusan pendaftaran updated' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update jurusan pendaftaran' });
  }
};

export const deleteJurusanPMB = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;

  try {
    const [rows] = await db.query('SELECT * FROM jurusan_pmb WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'jurusan tidak ditemukan' });
    }

    const data = rows[0];
    
    const query = 'DELETE FROM jurusan_pmb WHERE id = ?';
    const [result] = await db.query(query, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Jurusan pendaftaran not found' });
    }

    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: "delete",
      targetId: id,
      targetTable: "jurusan_pmb",
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      message: `Menghapus jurusan pmb dengan nama prodi "${data.program_studi}"`,
    });
    
    cache.del("jurusan_PMB_KEY")
    
    res.status(200).json({ message: 'Jurusan pendaftaran deleted' });
  } catch (err) {
    console.error(err);  
    res.status(500).json({ message: 'Failed to delete jurusan pendaftaran' });
  }
};