import multer from 'multer';
import bunny from '../config/bunny.js';
import path from 'path';
import crypto from 'crypto';

// Fungsi upload ke Bunny.net
export const uploadToBunny = async (file, folderName) => {
  const fileExtension = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

  if (!allowedExtensions.includes(fileExtension)) {
    throw new Error(`File extension "${fileExtension}" is not allowed`);
  }

  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new Error(`MIME type "${file.mimetype}" is not allowed`);
  }

  const safeFileName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${fileExtension}`;
  const fullPath = `${folderName}/${safeFileName}`.replace(/\/+/g, '/');
  const url = `${bunny.host}/${bunny.storageZone}/${fullPath}`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'AccessKey': bunny.apiKey,
      'Content-Type': file.mimetype || 'application/octet-stream',
    },
    body: file.buffer,
  });

  if (!res.ok) {
    throw new Error(`Failed to upload to Bunny.net: ${res.statusText}`);
  }

  file.uploadedUrl = `${bunny.pullZoneUrl}/${fullPath}`;
  file.originalName = file.originalname;

  return file;
};

// Middleware untuk upload dengan ukuran file maksimal 1MB
export const createUploaderBunny = (fields, folderName) => {
  const MAX_FILE_SIZE = 3 * 1024 * 1024; // 1MB

  // Konfigurasi multer
  const uploader = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE }, // Membatasi ukuran file maksimal 1MB
  }).fields(fields);

  return [
    uploader,
    async (req, res, next) => {
      try {
        const allFiles = [];

        for (const field of fields) {
          const files = req.files?.[field.name];
          if (files && files.length > 0) {
            for (const file of files) {
              const uploaded = await uploadToBunny(file, folderName);
              file.fileUrl = uploaded.uploadedUrl;
              file.originalName = uploaded.originalName;
              allFiles.push({ field: field.name, ...file });
            }
          }
        }

        // Kembalikan hasilnya dalam struktur yang mudah diakses
        req.uploadedFiles = allFiles.reduce((acc, file) => {
          if (!acc[file.field]) acc[file.field] = [];
          acc[file.field].push({
            url: file.fileUrl,
            name: file.originalName,
          });
          return acc;
        }, {});

        next();
      } catch (err) {
        console.error('Upload ke Bunny gagal:', err);
        res.status(500).json({ error: 'Upload gagal', detail: err.message });
      }
    }
  ];
};