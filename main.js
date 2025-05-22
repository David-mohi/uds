import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from "helmet"
import path from "path"
import fs from "fs"
import beritaRoutes from './routes/beritaRoutes.js';
import authRoutes from './routes/authRoutes.js';
import sliderRoutes from './routes/sliderRoutes.js';
import organisasiRoutes from './routes/organisasiRoutes.js';
import akademikRoutes from './routes/KalenderAkademikRoutes.js';
import kuliahOnlineRoutes from './routes/perkuliahanOnlineRoutes.js';
import skripsiRoutes from './routes/panduanSkripsiRoutes.js';
import kerjasamaRoutes from './routes/kerjasamaRoutes.js';
import linkRoutes from './routes/linkKerjasama.js';
import ukmRoutes from './routes/ukmRoutes.js';
import akreditasiRoutes from './routes/akreditasiRoutes.js';
import pengaduanRoutes from './routes/pengaduanRoutes.js';
import PMBRoutes from './routes/gelombangPMBRoutes.js';
import jurusanPMBRoutes from './routes/jurusanPMBRoutes.js';
import jdihRoutes from './routes/jdihRoutes.js';
import pedomanRoutes from './routes/bukuPedomanRoutes.js';
import registerRoutes from './routes/RegisterAccRoutes.js';
import cookieParser from 'cookie-parser';
import dashboardRoutes from './routes/dashboardRoutes.js';
import activityRoutes from './routes/logActivityRoutes.js';
import sdmRoutes from './routes/dokumenSDMRoutes.js';
import adminAuditRoutes from './routes/adminAuditRoutes.js';
import beasiswaRoutes from './routes/BeasiswaRoutes.js';
import csurf from 'csurf';
import CSRFRoutes from './routes/CSRFRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT;
const origin2 = process.env.ORIGIN2;
const allowedOrigins = [origin2];

// Aktifkan semua proteksi default Helmet
app.use(helmet());

// Tambahkan konfigurasi khusus Content-Security-Policy secara terpisah
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'", origin2],
    scriptSrc: ["'self'", origin2],
    styleSrc: ["'self'", origin2],
    connectSrc: ["'self'", origin2],
    frameAncestors: ["'self'", origin2],
    mediaSrc: ["'self'", origin2],
    imgSrc: ["'self'", "data:"],
    fontSrc: ["'self'", "https:", "data:"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    scriptSrcAttr: ["'none'"],
    // upgradeInsecureRequests: [], // bisa diaktifkan jika semua sumber HTTPS
    // blockAllMixedContent: []     // jika kamu ingin blok semua mixed content
  }
}));

app.disable("x-powered-by");

app.use(express.json());
app.use(cookieParser());

const csrfProtection = csurf({
  cookie: {
    httpOnly: true,
    secure: false, //process.env.NODE_ENV === 'production', // hanya HTTPS di production
    sameSite: 'lax',
  },
});

// Pasang middleware CSRF
app.use(csrfProtection);
app.use(express.urlencoded({ extended: true }));

app.use(cors({
  origin: (origin, callback) => {
    const allowed = !origin || allowedOrigins.includes(origin);
    callback(allowed ? null : new Error("Not allowed by CORS"), allowed);
  },
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "Range", "Cookie", "CSRF-Token"],
  exposedHeaders: ["Content-Range", "Accept-Ranges", "Content-Length"]
}));

const uploadsPath = path.resolve("uploads");
app.use("/uploads", express.static(uploadsPath, {
  setHeaders(res) {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("X-Content-Type-Options", "nosniff");
  }
}));

// ROUTES
const API_PREFIX = process.env.API_PREFIX

app.use(`${API_PREFIX}/csrf`, CSRFRoutes);
app.use(`${API_PREFIX}/berita`, beritaRoutes);
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/hero`, sliderRoutes);
app.use(`${API_PREFIX}/struktur-organisasi`, organisasiRoutes);
app.use(`${API_PREFIX}/kalender-akademik`, akademikRoutes);
app.use(`${API_PREFIX}/kuliah-online`, kuliahOnlineRoutes);
app.use(`${API_PREFIX}/panduan-skripsi`, skripsiRoutes);
app.use(`${API_PREFIX}/kerjasama`, kerjasamaRoutes);
app.use(`${API_PREFIX}/link-kerjasama`, linkRoutes);
app.use(`${API_PREFIX}/ukm`, ukmRoutes);
app.use(`${API_PREFIX}/akreditasi`, akreditasiRoutes);
app.use(`${API_PREFIX}/pengaduan`, pengaduanRoutes);
app.use(`${API_PREFIX}/gelombang-pmb`, PMBRoutes);
app.use(`${API_PREFIX}/jurusan-pmb`, jurusanPMBRoutes);
app.use(`${API_PREFIX}/jdih`, jdihRoutes);
app.use(`${API_PREFIX}/pedoman`, pedomanRoutes);
app.use(`${API_PREFIX}/register-acc`, registerRoutes);
app.use(`${API_PREFIX}/dashboard`, dashboardRoutes)
app.use(`${API_PREFIX}/act-logging`, activityRoutes)
app.use(`${API_PREFIX}/audit-admin-logs`, adminAuditRoutes)
app.use(`${API_PREFIX}/dokumen-sdm`, sdmRoutes)
app.use(`${API_PREFIX}/beasiswa`, beasiswaRoutes)

app.listen(PORT, "127.0.0.1", () => {
  console.log("Server is running");
});