import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadToCloudinary = (buffer, folder = 'medease', options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, ...options },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
};

/** Use for PDFs and other raw files (resource_type: 'raw'). Uses data URI so the file is stored and delivered as PDF. */
export const uploadRawToCloudinary = (buffer, folder = 'medease') => {
  const base64 = buffer.toString('base64');
  const dataUri = `data:application/pdf;base64,${base64}`;
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      dataUri,
      { folder, resource_type: 'raw' },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
  });
};

export default cloudinary;
