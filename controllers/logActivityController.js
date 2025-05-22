import db from "../config/db.js";
import { validationResult } from "express-validator";
import cache from "./utils/Cache.js";
import crypto from "crypto"
import { Parser } from "json2csv";
import { logActivity } from "../controllers/utils/logActivityAdmin.js"

export const logVisit = async (req, res) => {
  try {
    const forwarded = req.headers["x-forwarded-for"];
    const ip = forwarded ? forwarded.split(",")[0].trim() : req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    const checkSql = `
      SELECT COUNT(*) AS total 
      FROM pengunjung 
      WHERE ip_address = ? 
        AND user_agent = ? 
        AND DATE(created_at) = ?
    `;

    const [results] = await db.query(checkSql, [ip, userAgent, today]);
    const sudahAda = results[0].total > 0;

    if (sudahAda) {
      return res.status(200).json({ message: "Sudah tercatat hari ini" });
    }

    const insertSql = "INSERT INTO pengunjung (ip_address, user_agent) VALUES (?, ?)";
    await db.query(insertSql, [ip, userAgent]);

    res.status(200).json({ message: "Kunjungan dicatat" });
  } catch (error) {
    console.error("Gagal mencatat kunjungan:", error);
    res.status(500).json({ error: "Gagal mencatat kunjungan" });
  }
};

export const getVisitors = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    ip_address,
    user_agent,
    start,
    end,
    page = 1,
    limit = 15
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Generate unique cache key berdasarkan query
  const cacheKeyRaw = JSON.stringify({ ip_address, user_agent, start, end, page, limit });
  const cacheKey = `visitors:${crypto.createHash("md5").update(cacheKeyRaw).digest("hex")}`;

  // Cek cache
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    let query = `SELECT * FROM pengunjung WHERE 1=1`;
    const params = [];

    if (ip_address) {
      query += ` AND ip_address LIKE ?`;
      params.push(`%${ip_address}%`);
    }

    if (user_agent) {
      query += ` AND user_agent LIKE ?`;
      params.push(`%${user_agent}%`);
    }

    if (start && end) {
      query += ` AND created_at BETWEEN ? AND ?`;
      params.push(start, end);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const [result] = await db.query(query, params);

    // Count total untuk pagination
    let countQuery = `SELECT COUNT(*) as total FROM pengunjung WHERE 1=1`;
    const countParams = [];

    if (ip_address) {
      countQuery += ` AND ip_address LIKE ?`;
      countParams.push(`%${ip_address}%`);
    }

    if (user_agent) {
      countQuery += ` AND user_agent LIKE ?`;
      countParams.push(`%${user_agent}%`);
    }

    if (start && end) {
      countQuery += ` AND created_at BETWEEN ? AND ?`;
      countParams.push(start, end);
    }

    const [countResult] = await db.query(countQuery, countParams);
    const total = countResult[0].total;

    const response = {
      data: result,
      page: parseInt(page),
      limit: parseInt(limit),
      total
    };

    // Simpan ke cache
    cache.set(cacheKey, response, 60);

    res.json(response);
  } catch (error) {
    console.error("Gagal mengambil data pengunjung:", error);
    res.status(500).json({ message: "Gagal mengambil data pengunjung" });
  }
};

export const exportVisitorsCSV = async (req, res) => {
  try {
    const [logs] = await db.query(`
      SELECT id, ip_address, user_agent, created_at
      FROM pengunjung
      ORDER BY created_at DESC
    `);

    const parser = new Parser({ fields: ['id', 'ip_address', 'user_agent', 'created_at'] });
    const csv = parser.parse(logs);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="pengunjung_logs.csv"');
    res.status(200).send(csv);
  } catch (err) {
    console.error('Gagal ekspor pengunjung:', err);
    res.status(500).json({ message: 'Gagal ekspor data pengunjung' });
  }
};

export const deleteVisitorsByDateRange = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { startDate, endDate } = req.body;

  if (!startDate || !endDate) {
    return res.status(400).json({ message: "Start dan end date wajib diisi." });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({ message: "Format tanggal tidak valid." });
  }

  const startDateStr = start.toISOString().split("T")[0];
  const endDateStr = end.toISOString().split("T")[0];

  if (start > end) {
    return res.status(400).json({ message: "Tanggal awal tidak boleh lebih besar dari tanggal akhir" });
  }

  try {
    const [toDelete] = await db.query(
      `SELECT id FROM pengunjung WHERE DATE(created_at) BETWEEN ? AND ?`,
      [startDateStr, endDateStr]
    );

    if (!toDelete.length) {
      return res.status(404).json({ message: "Tidak ada data pengunjung dalam rentang tanggal tersebut." });
    }

    const [deleteResult] = await db.query(
      `DELETE FROM pengunjung WHERE DATE(created_at) BETWEEN ? AND ?`,
      [startDateStr, endDateStr]
    );

    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: "delete",
      targetId: null,
      targetTable: "pengunjung",
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      message: `Menghapus ${toDelete.length} data pengunjung antara ${startDateStr} sampai ${endDateStr}`,
    });

    const cacheKeyRaw = JSON.stringify({ ip_address, user_agent, start, end, page, limit });
    const cacheKey = `visitors:${crypto.createHash("md5").update(cacheKeyRaw).digest("hex")}`;
    cache.del(cacheKey);

    res.json({
      message: `Berhasil menghapus ${deleteResult.affectedRows} pengunjung antara ${startDateStr} dan ${endDateStr}.`,
    });
  } catch (err) {
    console.error("Gagal menghapus data pengunjung:", err);
    res.status(500).json({ message: "Terjadi kesalahan saat menghapus data pengunjung" });
  }
};