import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';
import { uploadBufferToCloudinary } from '../utils/cloudinary.js';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new ApiError(
        400,
        'Invalid file type. Only PDF, JPG, PNG, and WEBP files are allowed.'
      ),
      false
    );
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max per file
  },
});

/**
 * Middleware to push single uploaded file (req.file) to Cloudinary
 * and attach { url, publicId, docType } to req.uploadedFile.
 */
export const handleCloudinaryUpload = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ApiError(400, 'No document file provided');
    }

    const result = await uploadBufferToCloudinary(
      req.file.buffer,
      'lms_kyc_income_docs',
      req.file.originalname
    );

    req.uploadedFile = {
      docType: req.body.docType || 'GENERAL_PROOF',
      url: result.url,
      publicId: result.publicId,
    };

    next();
  } catch (error) {
    next(error);
  }
};
