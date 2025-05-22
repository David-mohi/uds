import db from '../config/db.js';
import sanitizeHtml from 'sanitize-html';
import { validationResult } from 'express-validator';
import { logActivity } from './utils/logActivityAdmin.js';
import cache from './utils/Cache.js';

export const getGelombangPendaftaran = async (req, res) => {
  try {
    const cacheKey = "pmb_list"
    const cachedData = cache.get(cacheKey)
    if (cachedData) {
      return res.json(cachedData)
    }

    const [results] = await db.query('SELECT * FROM gelombang_pendaftaran');
    cache.set(cacheKey, results, 86400)
    res.status(200).json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to retrieve data' });
  }
};

export const addGelombangPendaftaran = async (req, res) => {
  const { nama_gelombang, tanggal_mulai, tanggal_akhir, biaya_daftar } = req.body;

  // Validasi singkat dengan helper function
  const isValidDate = (date) => !isNaN(new Date(date).getTime());
  const isPositiveNumber = (num) => !isNaN(num) && Number(num) > 0;

  if (
    !nama_gelombang || typeof nama_gelombang !== 'string' || nama_gelombang.trim() === '' ||
    nama_gelombang.length > 255 ||
    !isValidDate(tanggal_mulai) ||
    !isValidDate(tanggal_akhir) ||
    !isPositiveNumber(biaya_daftar) ||
    biaya_daftar.toString().length > 20
  ) {
    return res.status(400).json({ message: 'Input tidak valid' });
  }

  // Sanitasi input
  const sanitizedNamaGelombang = sanitizeHtml(nama_gelombang);
  const sanitizedTanggalMulai = sanitizeHtml(tanggal_mulai);
  const sanitizedTanggalAkhir = sanitizeHtml(tanggal_akhir);
  const sanitizedBiayaDaftar = sanitizeHtml(biaya_daftar.toString());

  try {
    const query = 'INSERT INTO gelombang_pendaftaran (nama_gelombang, tanggal_mulai, tanggal_akhir, biaya_daftar) VALUES (?, ?, ?, ?)';
    const [result] = await db.query(query, [
      sanitizedNamaGelombang,
      sanitizedTanggalMulai,
      sanitizedTanggalAkhir,
      sanitizedBiayaDaftar
    ]);

    // Log aktivitas
    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: 'create',
      targetId: result.insertId,
      targetTable: 'gelombang_pendaftaran',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      message: `Mengupload gelombang pendaftaran dengan nama gelombang "${sanitizedNamaGelombang}"`,
    });

    cache.del("pmb_list")
    
    res.status(201).json({ message: 'Gelombang pendaftaran added', id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to add gelombang pendaftaran' });
  }
};

export const updateGelombangPendaftaran = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { nama_gelombang, tanggal_mulai, tanggal_akhir, biaya_daftar } = req.body;

  const isValidDate = (date) => !isNaN(new Date(date).getTime());
  const isPositiveNumber = (num) => !isNaN(num) && Number(num) > 0;

  if (
    !nama_gelombang || typeof nama_gelombang !== 'string' || nama_gelombang.trim() === '' ||
    nama_gelombang.length > 255 ||
    !isValidDate(tanggal_mulai) ||
    !isValidDate(tanggal_akhir) ||
    !isPositiveNumber(biaya_daftar) ||
    biaya_daftar.toString().length > 20
  ) {
    return res.status(400).json({ message: 'Input tidak valid' });
  }

  // Sanitasi input
  const sanitizedNamaGelombang = sanitizeHtml(nama_gelombang);
  const sanitizedTanggalMulai = sanitizeHtml(tanggal_mulai);
  const sanitizedTanggalAkhir = sanitizeHtml(tanggal_akhir);
  const sanitizedBiayaDaftar = sanitizeHtml(biaya_daftar.toString());

  try {
    const query = `
      UPDATE gelombang_pendaftaran 
      SET nama_gelombang = ?, tanggal_mulai = ?, tanggal_akhir = ?, biaya_daftar = ? 
      WHERE id = ?
    `;

    const [result] = await db.query(query, [
      sanitizedNamaGelombang,
      sanitizedTanggalMulai,
      sanitizedTanggalAkhir,
      sanitizedBiayaDaftar,
      id
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Gelombang pendaftaran not found' });
    }

    cache.del("pmb_list")
    
    res.status(200).json({ message: 'Gelombang pendaftaran updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update gelombang pendaftaran' });
  }
};
  
// Delete gelombang pendaftaran
export const deleteGelombangPendaftaran = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;

  try {
    // Ambil data dulu untuk log
    const [rows] = await db.query('SELECT * FROM gelombang_pendaftaran WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Gelombang pendaftaran tidak ditemukan' });
    }

    const data = rows[0];

    // Hapus data
    const [result] = await db.query('DELETE FROM gelombang_pendaftaran WHERE id = ?', [id]);

    // Catat log aktivitas
    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: 'delete',
      targetId: id,
      targetTable: 'gelombang_pendaftaran',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      message: `Menghapus gelombang pendaftaran dengan nama "${data.nama_gelombang}"`,
    });

    // Hapus cache
    cache.del("pmb_list");

    res.status(200).json({ message: 'Gelombang pendaftaran berhasil dihapus' });
  } catch (err) {
    console.error('Gagal menghapus gelombang pendaftaran:', err);
    res.status(500).json({ message: 'Terjadi kesalahan saat menghapus gelombang pendaftaran' });
  }
};
