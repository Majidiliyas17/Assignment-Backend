import { v2 as cloudinary } from 'cloudinary';
import { env } from './env';

const cloudName = env.CLOUDINARY_CLOUD_NAME;
const apiKey = env.CLOUDINARY_API_KEY;
const apiSecret = env.CLOUDINARY_API_SECRET;

export const isCloudinaryConfigured = Boolean(cloudName && apiKey && apiSecret);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: cloudName!,
    api_key: apiKey!,
    api_secret: apiSecret!,
    secure: true,
  });
}

export const cloudinaryClient = cloudinary;