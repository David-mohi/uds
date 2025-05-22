import db from "../config/db.js";
import bunny from "../config/bunny.js";
import sanitizeHtml from "sanitize-html";
import { validationResult } from "express-validator";
import { logActivity } from "./utils/logActivityAdmin.js";
import cache from "./utils/Cache.js";


export const uploadHeroSlider = async (req, res) => {
  try {
    const rawJudul = req.body.judul;
    const gambar = req.uploadedFiles?.gambar?.[0]?.url;

    if (!gambar) {
      return res.status(400).json({ message: "Gambar tidak ditemukan" });
    }

    const judul = sanitizeHtml(rawJudul || "", {
      allowedTags: [],
      allowedAttributes: {},
    }).trim();

    if (!judul) {
      return res.status(400).json({ message: "Judul wajib diisi" });
    }

    if (judul.length > 100) {
      return res.status(400).json({ message: "Judul maksimal 100 karakter" });
    }

    const [result] = await db.query(
      "INSERT INTO hero_slider (judul, gambar) VALUES (?, ?)",
      [judul, gambar]
    );

    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: "upload",
      targetId: result.insertId,
      targetTable: "hero_slider",
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      message: `Mengunggah gambar slider dengan judul "${judul}"`,
    });

    cache.del("slider_cache");
    cache.del("slider_active_cache");

    res.status(201).json({ message: "Gambar berhasil diupload" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal menyimpan hero slider" });
  }
};

export const getActiveHeroSlider = async (req, res) => {
  const LIMIT = 4;
  const cacheKey = "slider_active_cache";

  try {
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const [rows] = await db.query(
      "SELECT * FROM hero_slider WHERE is_active = 1 ORDER BY created_at DESC LIMIT ?",
      [LIMIT]
    );

    cache.set(cacheKey, rows, 72000);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal mengambil data hero slider" });
  }
};

export const getHeroSlider = async (req, res) => {
  const LIMIT = 6;
  const cacheKey = "slider_cache";

  try {
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const [rows] = await db.query(
      "SELECT * FROM hero_slider ORDER BY created_at DESC LIMIT ?",
      [LIMIT]
    );

    cache.set(cacheKey, rows, 72000);
    res.json(rows);
  } catch (err) {
    console.error("Gagal mengambil data hero slider:", err);
    res.status(500).json({ message: "Gagal mengambil data hero slider" });
  }
};

export const updateHero = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { id } = req.params;
  const rawJudul = req.body.judul;
  const is_active = req.body.is_active;
  const uploadedGambar = req.uploadedFiles?.gambar?.[0];
  const newFileUrl = uploadedGambar?.url;

  try {
    const [existing] = await db.query("SELECT * FROM hero_slider WHERE id = ?", [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: "Data hero tidak ditemukan" });
    }

    const hero = existing[0];
    const fields = [];
    const values = [];

    if (rawJudul !== undefined) {
      const judul = sanitizeHtml(rawJudul || "", {
        allowedTags: [],
        allowedAttributes: {},
      }).trim();

      if (!judul) return res.status(400).json({ message: "Judul tidak boleh kosong" });
      if (judul.length > 100) return res.status(400).json({ message: "Judul maksimal 100 karakter" });

      fields.push("judul = ?");
      values.push(judul);
    }

    if (is_active !== undefined) {
      if (![0, 1, "0", "1"].includes(is_active)) {
        return res.status(400).json({ message: "Nilai is_active tidak valid (harus 0 atau 1)" });
      }
      fields.push("is_active = ?");
      values.push(is_active);
    }

    if (newFileUrl && hero.gambar) {
      try {
        const pullZoneBase = bunny.pullZoneUrl.endsWith("/") ? bunny.pullZoneUrl : bunny.pullZoneUrl + "/";
        const relativePath = hero.gambar.replace(pullZoneBase, "");
        const deleteUrl = `${bunny.host}/${bunny.storageZone}/${relativePath}`;

        const response = await fetch(deleteUrl, {
          method: "DELETE",
          headers: { AccessKey: bunny.apiKey },
        });

        if (!response.ok) {
          const errText = await response.text();
          console.warn("Gagal hapus gambar lama dari Bunny:", errText);
        }
      } catch (err) {
        console.error("Gagal hapus gambar lama:", err);
      }

      fields.push("gambar = ?");
      values.push(newFileUrl);
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: "Tidak ada data yang diupdate" });
    }

    await db.query(`UPDATE hero_slider SET ${fields.join(", ")} WHERE id = ?`, [...values, id]);

    cache.del("slider_cache");
    cache.del("slider_active_cache");

    res.json({ message: "Data hero berhasil diupdate" });
  } catch (err) {
    console.error("Gagal update hero:", err);
    res.status(500).json({ message: "Terjadi kesalahan saat memperbarui data hero" });
  }
};

export const updateActiveHero = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { id } = req.params;
  const { is_active } = req.body;

  try {
    const [existing] = await db.query("SELECT * FROM hero_slider WHERE id = ?", [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: "Data hero tidak ditemukan" });
    }

    await db.query("UPDATE hero_slider SET is_active = ? WHERE id = ?", [is_active, id]);

    cache.del("slider_cache");
    cache.del("slider_active_cache");

    res.json({ message: "Status hero berhasil diubah" });
  } catch (err) {
    console.error("Gagal update hero:", err);
    res.status(500).json({ message: "Terjadi kesalahan saat memperbarui status hero" });
  }
};

export const deleteHeroSlider = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { id } = req.params;

  try {
    const [rows] = await db.query("SELECT * FROM hero_slider WHERE id = ?", [id]);
    if (rows.length === 0) return res.status(404).json({ message: "Data tidak ditemukan" });

    const data = rows[0];

    if (data.gambar) {
      try {
        const pullZoneBase = bunny.pullZoneUrl.endsWith("/") ? bunny.pullZoneUrl : bunny.pullZoneUrl + "/";
        const relativePath = data.gambar.replace(pullZoneBase, "");
        const deleteUrl = `${bunny.host}/${bunny.storageZone}/${relativePath}`;

        const response = await fetch(deleteUrl, {
          method: "DELETE",
          headers: { AccessKey: bunny.apiKey },
        });

        if (!response.ok) {
          const errText = await response.text();
          console.warn("Gagal hapus gambar dari Bunny:", errText);
        }
      } catch (err) {
        console.error("Gagal hapus gambar:", err);
      }
    }

    await db.query("DELETE FROM hero_slider WHERE id = ?", [id]);

    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: "delete",
      targetId: id,
      targetTable: "hero_slider",
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      message: `Menghapus gambar slider dengan judul "${data.judul}"`,
    });

    cache.del("slider_cache");
    cache.del("slider_active_cache");

    res.json({ message: "Data dan file berhasil dihapus" });
  } catch (err) {
    console.error("Gagal menghapus data Hero:", err);
    res.status(500).json({ message: "Gagal menghapus data" });
  }
};