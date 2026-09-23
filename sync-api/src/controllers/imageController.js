import cloudinary from '../config/cloudinaryConfig.js';
import streamifier from 'streamifier';

export const uploadImage = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const { folder = 'pos_images' } = req.body;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        format: 'webp',
        quality: 'auto'
      },
      (error, result) => {
        if (error) {
          console.error('[ImageController] Cloudinary upload error:', error);
          return res.status(500).json({ error: 'Failed to upload image' });
        }
        return res.status(200).json({ 
          url: result.secure_url,
          public_id: result.public_id
        });
      }
    );

    streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
  } catch (error) {
    console.error('[ImageController] Internal error:', error);
    return res.status(500).json({ error: 'Internal server error during image upload' });
  }
};
