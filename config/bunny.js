import dotenv from 'dotenv';
dotenv.config();

const bunny = {
  storageZone: process.env.BUNNY_STORAGE_ZONE,
  apiKey: process.env.BUNNY_API_KEY,
  host: process.env.BUNNY_STORAGE_HOST,
  pullZoneUrl: process.env.BUNNY_PULL_ZONE_NAME
};

export default bunny;