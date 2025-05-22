import db from "../config/db.js";
import { convertLogsToCSV } from "./utils/auditLogExport.js";
import { validationResult } from "express-validator";
import { logActivity } from "./utils/logActivityAdmin.js";

export const getLogActivityAdmin = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    nama_user,
    action,
    target_table,
    start,
    end,
    page = 1,
    limit = 10
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let query = `SELECT * FROM audit_logs WHERE 1=1`;
    const params = [];

    if (nama_user) {
      query += ` AND nama_user LIKE ?`;
      params.push(`%${nama_user}%`);
    }

    if (action) {
      query += ` AND action = ?`;
      params.push(action);
    }

    if (target_table) {
      query += ` AND target_table = ?`;
      params.push(target_table);
    }

    if (start && end) {
      query += ` AND created_at BETWEEN ? AND ?`;
      params.push(start, end);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const [result] = await db.query(query, params);

    // Ambil total count untuk keperluan frontend (misalnya buat total halaman)
    let countQuery = `SELECT COUNT(*) as total FROM audit_logs WHERE 1=1`;
    const countParams = [];

    if (nama_user) {
      countQuery += ` AND nama_user LIKE ?`;
      countParams.push(`%${nama_user}%`);
    }

    if (action) {
      countQuery += ` AND action = ?`;
      countParams.push(action);
    }

    if (target_table) {
      countQuery += ` AND target_table = ?`;
      countParams.push(target_table);
    }

    if (start && end) {
      countQuery += ` AND created_at BETWEEN ? AND ?`;
      countParams.push(start, end);
    }

    const [countResult] = await db.query(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      data: result,
      page: parseInt(page),
      limit: parseInt(limit),
      total
    });
  } catch (error) {
    console.error("Gagal mengambil data audit aktivitas:", error);
    res.status(500).json({ message: "Gagal mengambil data audit aktivitas" });
  }
};

export const exportAuditLogs = async (req, res) => {
  try {
    const [logs] = await db.query(`
      SELECT *
      FROM audit_logs
      ORDER BY created_at DESC
    `);

    const csv = convertLogsToCSV(logs);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit_logs.csv"');
    res.status(200).send(csv);
  } catch (err) {
    console.error('Gagal ekspor CSV:', err);
    res.status(500).json({ message: 'Gagal ekspor audit log' });
  }
};

export const delAuditLogsByDateRange = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  let { startDate, endDate } = req.body;

  startDate = new Date(startDate).toISOString().split('T')[0];
  endDate = new Date(endDate).toISOString().split('T')[0];

  if (new Date(startDate) > new Date(endDate)) {
    return res.status(400).json({ message: "Tanggal awal tidak boleh lebih besar dari tanggal akhir" });
  }

  try {
    // Ambil data berita yang akan dihapus
    const [logList] = await db.query(
      `SELECT id FROM audit_logs WHERE DATE(created_at) BETWEEN ? AND ?`,
      [startDate, endDate]
    );

    // Jika tidak ada data, kirim response
    if (!logList.length) {
      return res.status(404).json({ message: "Tidak ada berita yang ditemukan dalam rentang tanggal tersebut." });
    }

    // Hapus berita
    const [deleteResult] = await db.query(
      `DELETE FROM audit_logs WHERE DATE(created_at) BETWEEN ? AND ?`,
      [startDate, endDate]
    );

    // Log aktivitas
    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: 'delete',
      targetId: null,
      targetTable: 'audit_logs',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      message: `Menghapus ${logList.length} admin log antara tanggal ${startDate} sampai dengan tanggal ${endDate}`,
    });

    res.json({
      message: `Berhasil menghapus ${deleteResult.affectedRows} berita antara ${startDate} dan ${endDate}.`,
    });
  } catch (err) {
    console.error("Gagal menghapus berita berdasarkan rentang:", err);
    res.status(500).json({ message: "Terjadi kesalahan saat menghapus berita" });
  }
};