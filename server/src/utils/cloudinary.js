import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

const configureCloudinary = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
};

export const uploadBufferToCloudinary = (
  fileBuffer,
  folder = 'lms_documents',
  originalName = 'document'
) => {
  configureCloudinary();

  return new Promise((resolve, reject) => {
    const sanitizedName = originalName
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_');

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto',
        public_id: `${Date.now()}_${sanitizedName}`,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    Readable.from(fileBuffer).pipe(uploadStream);
  });
};

export const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return null;
  configureCloudinary();
  return cloudinary.uploader.destroy(publicId);
};

export default cloudinary;
