import db from "../config/db.js"
import bcrypt from "bcryptjs";
import bunny from "../config/bunny.js";
import { validationResult } from "express-validator";
import sanitizeHtml from "sanitize-html";
import { logActivity } from "./utils/logActivityAdmin.js";

export async function semuaAkun(req, res) {
  try {
    const [result] = await db.query("SELECT username, nama, email, role, foto_url FROM users")
    res.json(result)
  } catch (error) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mendapatkan users' });
  }
}

export const addAkun = async (req, res) => {
  try {
    let { username, nama, email, password, role } = req.body;

    // Pastikan semua field wajib terisi
    if (!username || !nama || !email || !password) {
      return res.status(400).json({ message: 'Semua field harus diisi' });
    }

    // Trim dan normalisasi input
    username = username.trim();
    nama = nama.trim();
    email = email.trim().toLowerCase();

    // Sanitasi untuk mencegah XSS (hapus tag HTML)
    username = sanitizeHtml(username, { allowedTags: [], allowedAttributes: {} });
    nama = sanitizeHtml(nama, { allowedTags: [], allowedAttributes: {} });
    email = sanitizeHtml(email, { allowedTags: [], allowedAttributes: {} });
    role = role ? sanitizeHtml(role.trim().toLowerCase(), { allowedTags: [], allowedAttributes: {} }) : 'admin';

    // Validasi panjang input
    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ message: 'Username harus 3-30 karakter' });
    }
    if (nama.length < 3 || nama.length > 100) {
      return res.status(400).json({ message: 'Nama harus 3-100 karakter' });
    }

    // Validasi password
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password harus memiliki minimal 6 karakter' });
    }

    // Validasi format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Format email tidak valid' });
    }

    // Cek duplikasi username dan email
    const [isUsernameExisting] = await db.query('SELECT 1 FROM users WHERE username = ?', [username]);
    if (isUsernameExisting.length > 0) {
      return res.status(400).json({ message: 'Username sudah digunakan' });
    }

    const [isEmailExisting] = await db.query('SELECT 1 FROM users WHERE email = ?', [email]);
    if (isEmailExisting.length > 0) {
      return res.status(400).json({ message: 'Email sudah digunakan' });
    }

    // Validasi role (jika diisi)
    const validRoles = ['admin', 'si paling admin', 'jdih'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Role tidak valid' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Ambil URL gambar jika ada
    const uploadedFile = req.files?.gambar?.[0];
    const foto_url = uploadedFile?.fileUrl || uploadedFile?.uploadedUrl || null;

    // Insert ke database
    const [result] = await db.query(
      'INSERT INTO users (username, nama, email, password, role, foto_url) VALUES (?, ?, ?, ?, ?, ?)',
      [username, nama, email, hashedPassword, role, foto_url]
    );

    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: "upload",
      targetId: result.insertId,
      targetTable: "users",
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      message: `Menambahkan akun dengan username "${username}", nama "${nama}", dan dengan role "${role}"`,
    });

    res.status(201).json({ message: `Akun ${role} berhasil dibuat` });
  } catch (err) {
    console.error('Gagal menambahkan akun:', err);
    res.status(500).json({ message: 'Gagal membuat akun' });
  }
};

export async function deleteAkun(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username } = req.params;

  try {
    // Ambil foto_url dari user
    const [rows] = await db.query("SELECT foto_url FROM users WHERE username = ?", [username]);
    const [rows2] = await db.query("SELECT * FROM users WHERE username = ?", [username]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    const data = rows2[0]
    const fotoUrl = rows[0].foto_url;

    // Hapus akun dari database
    const [result] = await db.query("DELETE FROM users WHERE username = ?", [username]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    await logActivity({
      db,
      userId: req.user?.id,
      namaUser: req.user?.nama,
      action: "delete",
      targetId: username,
      targetTable: "users",
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      message: `Menghapus akun dengan username "${data.username}", nama "${data.nama}", dan dengan role "${data.role}"`,
    });

    // Jika ada foto_url, hapus dari Bunny
    if (fotoUrl) {
      try {
        const urlParts = fotoUrl.split('/');
        const fileName = urlParts[urlParts.length - 1];
        const folder = urlParts[urlParts.length - 2];
        const publicId = `${folder}/${fileName}`;

        const storageUrl = `${bunny.host}/${bunny.storageZone}/${publicId}`;

        const deleteResponse = await fetch(storageUrl, {
          method: 'DELETE',
          headers: {
            'AccessKey': bunny.apiKey
          }
        });

        if (!deleteResponse.ok) {
          console.warn("Gagal menghapus file dari Bunny:", await deleteResponse.text());
        }
      } catch (error) {
        console.warn("Kesalahan saat menghapus dari Bunny:", error);
      }
    }

    res.json({ message: "Akun berhasil dihapus" });

  } catch (err) {
    console.error("Gagal menghapus akun:", err);
    res.status(500).json({ message: "Gagal menghapus akun" });
  }
}

export async function updateAkun(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username } = req.params;
  const { nama, email, role } = req.body;

  try {
    const [result] = await db.query(
      "UPDATE users SET nama = ?, email = ?, role = ? WHERE username = ?",
      [nama, email, role, username]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }
    res.json({ message: "Akun berhasil diperbarui" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal memperbarui akun" });
  }
}

export const updateFoto = async (req, res) => {
  const username = req.user.username;
  const uploadedFile = req.uploadedFiles?.gambar?.[0];
  const newFileUrl = uploadedFile?.url;

  if (!newFileUrl) {
    return res.status(400).json({ message: 'Foto baru tidak ditemukan.' });
  }

  try {
    const [existing] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Akun tidak ditemukan' });
    }

    const user = existing[0];

    // Hapus foto lama jika ada
    if (user.foto_url) {
      try {
        const pullZoneBase = bunny.pullZoneUrl.endsWith('/') ? bunny.pullZoneUrl : bunny.pullZoneUrl + '/';
        const relativePath = user.foto_url.replace(pullZoneBase, '');
        const deleteUrl = `${bunny.host}/${bunny.storageZone}/${relativePath}`;

        const response = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: { AccessKey: bunny.apiKey },
        });

        if (!response.ok) {
          const errText = await response.text();
          console.warn('Gagal hapus foto lama dari Bunny:', errText);
        } else {
          console.log('Foto lama berhasil dihapus dari Bunny:', relativePath);
        }
      } catch (err) {
        console.error('Gagal kirim permintaan hapus foto lama:', err);
      }
    }

    // Update foto URL di database
    await db.query('UPDATE users SET foto_url = ? WHERE username = ?', [newFileUrl, username]);

    res.json({ message: 'Foto profil berhasil diperbarui'});
  } catch (err) {
    console.error('Gagal update foto profil:', err);
    res.status(500).json({ message: 'Terjadi kesalahan saat memperbarui foto profil' });
  }
};

export async function updatePassword(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username } = req.params;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ message: "Password tidak boleh kosong" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      "UPDATE users SET password = ? WHERE username = ?",
      [hashedPassword, username]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    res.json({ message: "Password berhasil diperbarui" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal memperbarui password" });
  }
}