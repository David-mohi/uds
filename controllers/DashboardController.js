import db from "../config/db.js"
import cache from "./utils/Cache.js";

export const getTotalBerita = async (req, res) => {
  try {
    const cacheKey = "dashboard_total_berita";
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const [rows] = await db.query("SELECT COUNT(*) AS total FROM berita");
    const total = rows[0]?.total || 0;

    const response = { totalBerita: total };
    cache.set(cacheKey, response);

    res.json(response);
  } catch (error) {
    console.error("Gagal mengambil total berita:", error);
    res.status(500).json({ message: "Gagal mengambil total berita" });
  }
};


export const getPengunjungHariIni = async (req, res) => {
  try {
    const cacheKey = "dashboard_pengunjung_hari_ini";
    const cached = cache.get(cacheKey);
    if (cached) return res.status(200).json(cached);

    const today = new Date().toISOString().slice(0, 10);
    const sql = `
      SELECT COUNT(*) AS total
      FROM pengunjung
      WHERE DATE(created_at) = ?
    `;
    const [rows] = await db.query(sql, [today]);
    const result = { total: rows[0].total };

    cache.set(cacheKey, result, 120); // 2 menit
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error mengambil pengunjung hari ini:", error);
    return res.status(500).json({ error: "Gagal mengambil data pengunjung" });
  }
};


export const getPengunjungGrafik = async (req, res) => {
  const { range } = req.query;
  const cacheKey = `dashboard_pengunjung_grafik_${range}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  let sql = "";

  if (range === "day") {
    sql = `
      SELECT HOUR(created_at) AS label, COUNT(*) AS total
      FROM pengunjung
      WHERE DATE(created_at) = CURDATE()
      GROUP BY HOUR(created_at)
      ORDER BY HOUR(created_at)
    `;
  } else if (range === "week") {
    sql = `
      SELECT DAYOFWEEK(created_at) AS label, COUNT(*) AS total
      FROM pengunjung
      WHERE YEARWEEK(created_at, 1) = YEARWEEK(CURDATE(), 1)
      GROUP BY DAYOFWEEK(created_at)
      ORDER BY DAYOFWEEK(created_at)
    `;
  } else if (range === "month") {
    sql = `
      SELECT DATE(created_at) AS label, COUNT(*) AS total
      FROM pengunjung
      WHERE MONTH(created_at) = MONTH(CURDATE())
        AND YEAR(created_at) = YEAR(CURDATE())
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at)
    `;
  } else {
    return res.status(400).json({ error: "Parameter range tidak valid" });
  }

  try {
    const [results] = await db.query(sql);
    cache.set(cacheKey, results, 180); // 3 menit
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengambil data pengunjung" });
  }
};

export const getRecentUploads = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const cacheKey = `dashboard_recent_uploads_${limit}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const [rows] = await db.query(
      `SELECT nama_user, message, created_at 
       FROM audit_logs 
       WHERE action = 'upload' 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [limit]
    );

    cache.set(cacheKey, rows, 180); // 3 menit
    res.json(rows);
  } catch (error) {
    console.error("Gagal mengambil aktivitas upload terbaru:", error);
    res.status(500).json({ message: "Gagal mengambil aktivitas upload terbaru" });
  }
};