import db from "../config/db.js";
import bunny from "../config/bunny.js";
import sanitizeHtml  from "sanitize-html"
import { validationResult, body } from "express-validator";
import { logActivity } from "./utils/logActivityAdmin.js";
import validator from 'validator';
import cache from "./utils/Cache.js";
const { isISO8601 } = validator;


export const validateCreateBerita = [
  body('judul').trim().notEmpty().isLength({ max: 100 }).withMessage('Judul wajib diisi'),
  body('konten').trim().notEmpty().withMessage('Konten wajib diisi'),
  body('kategori').trim().notEmpty().isLength({ max: 20 }).withMessage('Kategori wajib diisi'),
];

export const getBeritaTerkini = async (req, res) => {
  const LIMIT = 5;
  const cacheKey = `berita-terkini-limit-${LIMIT}`;

  try {
    // Cek dulu cache
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Kalau belum ada cache, ambil dari DB
    const query = `SELECT * FROM berita 
      WHERE kategori NOT IN ('pengumuman', 'agenda') 
      ORDER BY created_at DESC 
      LIMIT ?`;
    const [rows] = await db.query(query, [LIMIT]);

    // Simpan hasil ke cache
    cache.set(cacheKey, rows);

    res.json(rows);
  } catch (err) {
    console.error("Gagal ambil berita terkini:", err);
    res.status(500).json({ message: "Gagal ambil data berita terkini" });
  }
};

export const getSemuaBerita = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    let { page = 1, limit = 9, search = "", kategori = "" } = req.query;

    page = parseInt(page) || 1;
    limit = parseInt(limit) || 9;
    const offset = (page - 1) * limit;

    // **TRIM search dan kategori supaya bersih dari spasi**
    search = search.trim();
    kategori = kategori.trim();

    // Buat cache key berdasarkan param
    const cacheKey = `semuaBerita:${page}:${limit}:${search}:${kategori}`;

    // Cek dulu di cache
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    let query = "";
    let queryParams = [];
    let countQuery = "";
    let countParams = [];

    // Buat validasi search: harus ada isi dan bukan karakter wildcard '*'
    const isSearchValid = search.length > 0 && search !== "*";

    if (!isSearchValid) {
      // kalau search kosong atau '*' atau invalid, ambil semua berita tanpa fulltext
      query = "SELECT * FROM berita WHERE 1=1";
      countQuery = "SELECT COUNT(*) AS total FROM berita WHERE 1=1";

      if (kategori !== "") {
        query += " AND kategori = ?";
        countQuery += " AND kategori = ?";
        queryParams.push(kategori);
        countParams.push(kategori);
      }

      query += " ORDER BY id DESC LIMIT ? OFFSET ?";
      queryParams.push(limit, offset);
    } else {
      // Pakai fulltext search di judul
      query = "SELECT * FROM berita WHERE MATCH(judul) AGAINST(? IN BOOLEAN MODE)";
      countQuery = "SELECT COUNT(*) AS total FROM berita WHERE MATCH(judul) AGAINST(? IN BOOLEAN MODE)";
      queryParams.push(search);
      countParams.push(search);

      if (kategori !== "") {
        query += " AND kategori = ?";
        countQuery += " AND kategori = ?";
        queryParams.push(kategori);
        countParams.push(kategori);
      }

      query += " ORDER BY id DESC LIMIT ? OFFSET ?";
      queryParams.push(limit, offset);
    }

    const [rows] = await db.query(query, queryParams);
    const [[{ total }]] = await db.query(countQuery, countParams);
    const totalPages = Math.ceil(total / limit);

    const result = {
      rows,
      totalPages,
      currentPage: page,
    };

    // Simpan ke cache
    cache.set(cacheKey, result);

    res.json(result);
  } catch (err) {
    console.error("Gagal ambil semua berita:", err);
    res.status(500).json({ message: "Gagal ambil data berita" });
  }
};

export const getSemuaBeritaAdmin = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    let { page = 1, limit = 9, search = "", kategori = "", tahun = "" } = req.query;

    page = parseInt(page) || 1;
    limit = parseInt(limit) || 9;

    // cache key unik dari semua query params
    const cacheKey = `semuaBeritaAdmin:${page}:${limit}:${search}:${kategori}:${tahun}`;

    // Cek cache
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    const offset = (page - 1) * limit;

    let query = "";
    let queryParams = [];
    let countQuery = "";
    let countParams = [];

    if (!search || search === "*" || search.trim() === "") {
      query = `SELECT * FROM berita WHERE 1`;
      countQuery = `SELECT COUNT(*) AS total FROM berita WHERE 1`;
    } else {
      query = `SELECT * FROM berita WHERE MATCH(judul) AGAINST(? IN BOOLEAN MODE)`;
      countQuery = `SELECT COUNT(*) AS total FROM berita WHERE MATCH(judul) AGAINST(? IN BOOLEAN MODE)`;
      queryParams.push(search);
      countParams.push(search);
    }

    if (kategori && kategori !== "Semua Kategori") {
      query += ` AND kategori = ?`;
      countQuery += ` AND kategori = ?`;
      queryParams.push(kategori);
      countParams.push(kategori);
    }

    if (tahun) {
      query += ` AND tahun = ?`;
      countQuery += ` AND tahun = ?`;
      queryParams.push(tahun);
      countParams.push(tahun);
    }

    query += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
    queryParams.push(limit, offset);

    const [rows] = await db.query(query, queryParams);
    const [[{ total }]] = await db.query(countQuery, countParams);
    const totalPages = Math.ceil(total / limit);

    const result = {
      rows,
      totalPages,
      currentPage: page,
    };

    // Simpan hasil ke cache
    cache.set(cacheKey, result);

    res.json(result);
  } catch (err) {
    console.error("Gagal ambil semua berita admin:", err);
    res.status(500).json({ message: "Gagal ambil data berita" });
  }
};

export const getPengumuman = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    let { kategori = "" } = req.query;

    // Buat cache key unik berdasarkan parameter kategori
    const cacheKey = `pengumuman:${kategori}`;

    // Cek cache
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    let query = `SELECT * FROM berita`;
    const params = [];

    if (kategori) {
      query += ` WHERE kategori = ?`;
      params.push(kategori);
    }

    query += ` ORDER BY created_at DESC LIMIT 5`;

    const [rows] = await db.query(query, params);

    // Simpan ke cache
    cache.set(cacheKey, rows);

    res.json(rows);
  } catch (err) {
    console.error("Gagal ambil pengumuman:", err);
    res.status(500).json({ message: "Gagal ambil data pengumuman" });
  }
};

export const getAgenda = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    let { kategori = "" } = req.query;

    // cache key unik berdasarkan parameter kategori
    const cacheKey = `agenda:${kategori}`;

    // Cek cache
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    let query = `SELECT * FROM berita`;
    const params = [];

    if (kategori) {
      query += ` WHERE kategori = ?`;
      params.push(kategori);
    }

    query += ` ORDER BY created_at DESC LIMIT 5`;

    const [rows] = await db.query(query, params);

    // Simpan ke cache
    cache.set(cacheKey, rows);

    res.json(rows);
  } catch (err) {
    console.error("Gagal ambil agenda:", err);
    res.status(500).json({ message: "Gagal ambil data agenda" });
  }
};

export const getBeritaBySlug = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { slug } = req.params;

  // Cek cache
  const cached = cache.get(slug);
  if (cached) {
    return res.json(cached);
  }

  try {
    const [rows] = await db.query('SELECT * FROM berita WHERE slug = ?', [slug]);
    if (rows.length === 0) return res.status(404).json({ message: 'Berita tidak ditemukan' });

    // Simpan ke cache
    cache.set(slug, rows[0]);

    res.json(rows[0]);
  } catch (err) {
    console.error('Gagal ambil berita:', err);
    res.status(500).json({ message: 'Gagal ambil berita' });
  }
};

export const createBerita = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    let { judul, konten, kategori, tanggal_mulai, tanggal_selesai } = req.body;
    const slug = judul.toLowerCase().replace(/\s+/g, '-');

    // Parsing tanggal jika ada
    let mulai = tanggal_mulai ? new Date(tanggal_mulai) : null;
    let selesai = tanggal_selesai ? new Date(tanggal_selesai) : null;

    // Validasi logika tanggal hanya jika keduanya tersedia
    if (mulai && selesai && selesai < mulai) {
      return res.status(400).json({ message: 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai' });
    }

    // Ambil ID user login dari auth middleware
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: ID pengguna tidak ditemukan' });
    }

    // Ambil nama penulis dari tabel users
    const [[user]] = await db.query('SELECT nama FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    }
    const penulis = user.nama;

    // Sanitasi konten HTML
    konten = sanitizeHtml(konten, {
      allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'ul', 'li', 'br', 'ol', 'h1', 'h2', 'h3'],
      allowedAttributes: { a: ['href', 'target'] },
      allowedSchemes: ['http', 'https', 'mailto'],
    });

    // Validasi gambar
    const gambar = req.uploadedFiles?.gambar?.[0];
    if (gambar && gambar.size > 2 * 1024 * 1024) {
      return res.status(400).json({ message: 'Ukuran gambar maksimal 2MB' });
    }
    const gambarUrl = gambar?.url || null;

    // Validasi dokumen
    let dokumenList = [];
    const dokumenFiles = req.uploadedFiles?.dokumen;
    if (dokumenFiles) {
      const dokumens = Array.isArray(dokumenFiles) ? dokumenFiles : [dokumenFiles];
      for (const file of dokumens) {
        if (file.size > 2 * 1024 * 1024) {
          return res.status(400).json({ message: `Ukuran dokumen "${file.name}" melebihi 2MB` });
        }
        dokumenList.push({ name: file.name, url: file.url });
      }
    }

    // Simpan ke database
    const [result] = await db.query(
      `INSERT INTO berita (judul, slug, konten, gambar, dokumen, penulis, kategori, tanggal_mulai, tanggal_selesai)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        judul,
        slug,
        konten,
        gambarUrl,
        JSON.stringify(dokumenList),
        penulis,
        kategori,
        mulai || null,
        selesai || null,
      ]
    );

    await logActivity({
      db,
      userId,
      namaUser: penulis,
      action: "upload",
      targetId: result.insertId,
      targetTable: "berita",
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      message: `Mengunggah berita dengan judul "${judul}" dan kategori "${kategori}"`,
    });

    // Hapus cache yang relevan
    cache.keys().forEach((key) => {
      if (
        key.startsWith("semuaBerita:") ||
        key.startsWith("berita-terkini-limit-") ||
        key.startsWith("agenda:") ||
        key.startsWith("pengumuman:") ||
        key.startsWith("semuaBeritaAdmin:")
      ) {
        cache.del(key);
      }
    });

    res.status(201).json({ message: 'Berita berhasil ditambahkan', id: result.insertId });
  } catch (err) {
    console.error('Error tambah berita:', err);
    res.status(500).json({ message: 'Gagal tambah berita' });
  }
};

export const updateBerita = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { judul, konten, kategori, tanggal_mulai, tanggal_selesai } = req.body;
  const penulis = req.user.nama;
  const { id } = req.params;
  const slug = judul.toLowerCase().replace(/\s+/g, '-');

  const gambarBaru = req.uploadedFiles?.gambar?.[0]?.url || null;
  const dokumenBaru = req.uploadedFiles?.dokumen || [];

  try {
    const [check] = await db.query('SELECT * FROM berita WHERE id = ?', [id]);
    if (check.length === 0) {
      return res.status(404).json({ message: 'Berita tidak ditemukan' });
    }

    const beritaLama = check[0];
    const pullZoneBase = bunny.pullZoneUrl.endsWith('/') ? bunny.pullZoneUrl : bunny.pullZoneUrl + '/';

    // Hapus gambar lama jika ada gambar baru
    if (gambarBaru && beritaLama.gambar) {
      try {
        const gambarLama = typeof beritaLama.gambar === 'string' ? beritaLama.gambar : '';
        const relativePath = gambarLama.replace(pullZoneBase, '');
        const deleteUrl = `${bunny.host}/${bunny.storageZone}/${relativePath}`;

        const resDel = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: { AccessKey: bunny.apiKey },
        });

        if (!resDel.ok) {
          const errText = await resDel.text();
          console.warn(`Gagal hapus gambar ${gambarLama}:`, errText);
        } else {
          console.log(`Gambar lama berhasil dihapus: ${relativePath}`);
        }
      } catch (err) {
        console.error('Gagal hapus gambar lama:', err);
      }
    }

    // Hapus dokumen lama jika ada dokumen baru
    if (dokumenBaru.length > 0 && beritaLama.dokumen) {
      try {
        let dokumenLama = beritaLama.dokumen;
        if (typeof dokumenLama === 'string') dokumenLama = JSON.parse(dokumenLama);

        if (Array.isArray(dokumenLama)) {
          for (const doc of dokumenLama) {
            const relativePath = doc.url.replace(pullZoneBase, '');
            const deleteUrl = `${bunny.host}/${bunny.storageZone}/${relativePath}`;

            const resDel = await fetch(deleteUrl, {
              method: 'DELETE',
              headers: { AccessKey: bunny.apiKey },
            });

            if (!resDel.ok) {
              const errText = await resDel.text();
              console.warn(`Gagal hapus dokumen ${doc.url}:`, errText);
            } else {
              console.log(`Dokumen lama dihapus: ${relativePath}`);
            }
          }
        }
      } catch (err) {
        console.error('Gagal parse atau hapus dokumen lama:', err);
      }
    }

    const dokumenList = dokumenBaru.map(file => ({ name: file.name, url: file.url }));

    let query = 'UPDATE berita SET judul = ?, konten = ?, slug = ?, penulis = ?, kategori = ?, tanggal_mulai = ?, tanggal_selesai = ?';
    const params = [judul, konten, slug, penulis, kategori, tanggal_mulai, tanggal_selesai];

    if (gambarBaru) {
      query += ', gambar = ?';
      params.push(gambarBaru);
    }

    if (dokumenBaru.length > 0) {
      query += ', dokumen = ?';
      params.push(JSON.stringify(dokumenList));
    }

    query += ' WHERE id = ?';
    params.push(id);

    await db.query(query, params);

    let perubahan = [];
    if (beritaLama.judul !== judul) perubahan.push(`judul dari "${beritaLama.judul}" ke "${judul}"`);
    if (beritaLama.konten !== konten) perubahan.push(`konten telah diperbarui`);
    if (beritaLama.kategori !== kategori) perubahan.push(`kategori dari "${beritaLama.kategori}" ke "${kategori}"`);
    if ((beritaLama.tanggal_mulai && beritaLama.tanggal_mulai.toISOString().slice(0, 10)) !== tanggal_mulai)
      perubahan.push(`tanggal mulai dari "${beritaLama.tanggal_mulai.toISOString().slice(0,10)}" ke "${tanggal_mulai}"`);
    if ((beritaLama.tanggal_selesai && beritaLama.tanggal_selesai.toISOString().slice(0, 10)) !== tanggal_selesai)
      perubahan.push(`tanggal selesai dari "${beritaLama.tanggal_selesai.toISOString().slice(0,10)}" ke "${tanggal_selesai}"`);
    if (gambarBaru) perubahan.push(`mengganti gambar`);
    if (dokumenBaru.length > 0) perubahan.push(`mengganti dokumen`);

    const messageLog = perubahan.length > 0
      ? `Memperbarui berita (ID: ${id}): ${perubahan.join('; ')}`
      : `Melakukan update pada berita tanpa perubahan yang terdeteksi`;

    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: 'update',
      targetId: id,
      targetTable: 'berita',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      message: messageLog,
    });

    // Hapus cache slug berita yang diupdate
    if (beritaLama.slug) {
      cache.del(beritaLama.slug);
    }
    // Hapus cache slug baru kalau slug berubah
    if (slug !== beritaLama.slug) {
      cache.del(slug);
    }

    // Hapus cache list berita terkait
    cache.keys().forEach((key) => {
      if (
        key.startsWith("semuaBerita:") ||
        key.startsWith("berita-terkini-limit-") ||
        key.startsWith("agenda:") ||
        key.startsWith("pengumuman:") ||
        key.startsWith("semuaBeritaAdmin:")
      ) {
        cache.del(key);
      }
    });

    res.json({ message: 'Berita berhasil diperbarui' });
  } catch (err) {
    console.error('Gagal update berita:', err);
    res.status(500).json({ message: 'Gagal update berita' });
  }
};

export const deleteBerita = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  try {
    const [rows] = await db.query('SELECT * FROM berita WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Berita tidak ditemukan' });

    const berita = rows[0];
    const pullZoneBase = bunny.pullZoneUrl.endsWith('/') ? bunny.pullZoneUrl : bunny.pullZoneUrl + '/';

    // Hapus gambar dari Bunny
    if (berita.gambar) {
      try {
        const relativePath = berita.gambar.replace(pullZoneBase, '');
        const deleteUrl = `${bunny.host}/${bunny.storageZone}/${relativePath}`;

        const response = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: { AccessKey: bunny.apiKey },
        });

        if (!response.ok) {
          const errText = await response.text();
          console.warn('Gagal hapus gambar:', errText);
        }
      } catch (err) {
        console.error('Error hapus gambar:', err);
      }
    }

    // Hapus dokumen PDF dari Bunny
    if (berita.dokumen) {
      try {
        let dokumenList = typeof berita.dokumen === 'string' ? JSON.parse(berita.dokumen) : berita.dokumen;

        for (const doc of dokumenList) {
          if (!doc.url) continue;

          try {
            const relativePath = doc.url.replace(pullZoneBase, '');
            const deleteUrl = `${bunny.host}/${bunny.storageZone}/${relativePath}`;

            const response = await fetch(deleteUrl, {
              method: 'DELETE',
              headers: { AccessKey: bunny.apiKey },
            });

            if (!response.ok) {
              const errText = await response.text();
              console.warn(`Gagal hapus dokumen ${doc.url}:`, errText);
            }
          } catch (err) {
            console.error(`Error hapus dokumen ${doc.url}:`, err);
          }
        }
      } catch (err) {
        console.error('Gagal parse dokumen JSON:', err);
      }
    }

    // Hapus data berita dari database
    await db.query('DELETE FROM berita WHERE id = ?', [id]);

    // Log aktivitas
    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: 'delete',
      targetId: id,
      targetTable: 'berita',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      message: `Menghapus berita dengan judul "${berita.judul}" dan kategori "${berita.kategori}"`,
    });

    // Hapus cache slug berita yang dihapus
    if (berita.slug) {
      cache.del(berita.slug);
    }

    // Hapus cache list berita terkait
    cache.keys().forEach((key) => {
      if (
        key.startsWith("semuaBerita:") ||
        key.startsWith("berita-terkini-limit-") ||
        key.startsWith("agenda:") ||
        key.startsWith("pengumuman:") ||
        key.startsWith("semuaBeritaAdmin:")
      ) {
        cache.del(key);
      }
    });

    res.json({ message: 'Berita, gambar, dan dokumen berhasil dihapus' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal hapus berita' });
  }
};

export const deleteBeritaByDateRange = async (req, res) => {
  let { startDate, endDate } = req.body;

  if (!startDate || !endDate || !isISO8601(startDate) || !isISO8601(endDate)) {
    return res.status(400).json({ message: "Rentang tanggal tidak valid atau tidak lengkap" });
  }

  startDate = new Date(startDate).toISOString().split("T")[0];
  endDate = new Date(endDate).toISOString().split("T")[0];

  if (new Date(startDate) > new Date(endDate)) {
    return res.status(400).json({ message: "Tanggal awal tidak boleh lebih besar dari tanggal akhir" });
  }

  try {
    const [beritaList] = await db.query(
      `SELECT * FROM berita WHERE DATE(created_at) BETWEEN ? AND ?`,
      [startDate, endDate]
    );

    if (beritaList.length === 0) {
      return res.status(404).json({ message: "Tidak ada berita yang ditemukan dalam rentang tanggal tersebut." });
    }

    const pullZoneBase = bunny.pullZoneUrl.endsWith('/')
      ? bunny.pullZoneUrl
      : bunny.pullZoneUrl + '/';

    // Hapus file gambar dan dokumen
    for (const berita of beritaList) {
      if (berita.gambar) {
        try {
          const relativePath = berita.gambar.replace(pullZoneBase, '');
          const deleteUrl = `${bunny.host}/${bunny.storageZone}/${relativePath}`;

          const response = await fetch(deleteUrl, {
            method: 'DELETE',
            headers: { AccessKey: bunny.apiKey },
          });

          if (!response.ok) {
            const errText = await response.text();
            console.warn(`Gagal hapus gambar ${berita.gambar}:`, errText);
          }
        } catch (err) {
          console.error('Error hapus gambar:', err);
        }
      }

      if (berita.dokumen) {
        try {
          const dokumenList = typeof berita.dokumen === 'string' ? JSON.parse(berita.dokumen) : berita.dokumen;

          for (const doc of dokumenList) {
            if (!doc.url) continue;

            try {
              const relativePath = doc.url.replace(pullZoneBase, '');
              const deleteUrl = `${bunny.host}/${bunny.storageZone}/${relativePath}`;

              const response = await fetch(deleteUrl, {
                method: 'DELETE',
                headers: { AccessKey: bunny.apiKey },
              });

              if (!response.ok) {
                const errText = await response.text();
                console.warn(`Gagal hapus dokumen ${doc.url}:`, errText);
              }
            } catch (err) {
              console.error(`Error hapus dokumen ${doc.url}:`, err);
            }
          }
        } catch (err) {
          console.error('Gagal parse dokumen JSON:', err);
        }
      }

      // Hapus cache slug tiap berita
      if (berita.slug) {
        cache.del(berita.slug);
      }
    }

    // Hapus data berita dari database
    const [deleteResult] = await db.query(
      `DELETE FROM berita WHERE DATE(created_at) BETWEEN ? AND ?`,
      [startDate, endDate]
    );

    // Log aktivitas
    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: 'delete',
      targetId: null,
      targetTable: 'berita',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      message: `Menghapus ${beritaList.length} berita antara tanggal ${startDate} sampai dengan tanggal ${endDate}`,
    });

    // Hapus cache list yang relevan
    cache.keys().forEach((key) => {
      if (
        key.startsWith("semuaBerita:") ||
        key.startsWith("berita-terkini-limit-") ||
        key.startsWith("agenda:") ||
        key.startsWith("pengumuman:") ||
        key.startsWith("semuaBeritaAdmin:")
      ) {
        cache.del(key);
      }
    });

    res.json({
      message: `Berhasil menghapus ${deleteResult.affectedRows} berita beserta file terkait antara ${startDate} dan ${endDate}.`,
    });
  } catch (err) {
    console.error("Gagal menghapus berita berdasarkan rentang:", err);
    res.status(500).json({ message: "Terjadi kesalahan saat menghapus berita" });
  }
};