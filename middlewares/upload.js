import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';

export const createUploader = (folderName) => {
  const storage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
      return {
        folder: folderName,
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        resource_type: file.mimetype === "application/pdf" ? "raw" : "image",
      };
    },
  });

  return multer({ storage });
};

export const createPdfUploader = (folderName) => {
  const storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: folderName,
      allowed_formats: ["pdf"],
      resource_type: "raw",
      access_mode: "public"
    },
  });
  
  return multer({storage})
}

// Fleksibel (gambar atau pdf sekaligus)
export const createFlexibleUploader = (folderName) => {
  const storage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => ({
      folder: folderName,
      allowed_formats: ["jpg", "jpeg", "png", "pdf"],
      resource_type: file.mimetype === "application/pdf" ? "raw" : "image",
    }),
  });

  return multer({ storage });
};