const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { verifyToken } = require('../middleware/auth');
const { uploadFileToCloud, isCloudPath } = require('../utils/cloudStorage');

const signupUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many upload attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

const uploadsDir = path.join(__dirname, '../../uploads');
const logosDir = path.join(uploadsDir, 'logos');
const usersDir = path.join(uploadsDir, 'users');

[uploadsDir, logosDir, usersDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
});

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'];
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const randomBytes = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${Date.now()}-${randomBytes}${ext}`;
    cb(null, safeName);
  }
});

const upload = multer({
  storage: storage,
  limits: { 
    fileSize: 5 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error('Invalid file extension. Only JPG, PNG, WebP, and GIF allowed.'));
    }
    
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      return cb(new Error('Invalid file type. Only image files are allowed.'));
    }
    
    const sanitizedFilename = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    if (sanitizedFilename.includes('..') || sanitizedFilename.includes('/') || sanitizedFilename.includes('\\')) {
      return cb(new Error('Invalid filename'));
    }
    
    cb(null, true);
  }
});

async function uploadToCloudWithFallback(filePath, originalName, mimetype) {
  try {
    const cloudPath = await uploadFileToCloud(filePath, originalName, mimetype);
    return cloudPath;
  } catch (err) {
    console.error('☁️  Cloud upload failed, using local fallback:', err.message);
    return null;
  }
}

const signupUploadFields = upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'companyLogo', maxCount: 1 },
  { name: 'logo', maxCount: 1 }
]);

router.post('/upload-signup-photo', signupUploadLimiter, (req, res, next) => {
  signupUploadFields(req, res, async (err) => {
    if (err) {
      console.error('Signup photo upload error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size exceeds 5MB limit' });
      } else if (err.message && err.message.includes('Only image files')) {
        return res.status(400).json({ error: 'Only image files are allowed' });
      } else if (err.message && err.message.includes('Invalid')) {
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: 'File upload error', message: err.message });
    }
    
    let uploadedFile = null;
    const fieldNames = ['file', 'profilePhoto', 'companyLogo', 'logo'];
    for (const fieldName of fieldNames) {
      if (req.files && req.files[fieldName] && req.files[fieldName][0]) {
        uploadedFile = req.files[fieldName][0];
        console.log(`📷 Found file in field: ${fieldName}`);
        break;
      }
    }
    
    if (!uploadedFile) {
      console.error('No file in signup photo request. Fields received:', Object.keys(req.files || {}), 'Headers:', req.headers['content-type']);
      return res.status(400).json({ error: 'No file uploaded. Accepted fields: file, profilePhoto, companyLogo, logo' });
    }

    const cloudPath = await uploadToCloudWithFallback(uploadedFile.path, uploadedFile.originalname, uploadedFile.mimetype);
    const photoUrl = cloudPath || `/uploads/${uploadedFile.filename}`;
    
    console.log(`✅ Signup photo uploaded: ${photoUrl}`);

    res.json({
      success: true,
      photoUrl: photoUrl,
      url: photoUrl,
      filename: uploadedFile.filename,
      size: uploadedFile.size
    });
  });
});

const sharp = require('sharp');

const handleTripImageUpload = (req, res, next) => {
  upload.single('tripImage')(req, res, async (err) => {
    if (err) {
      console.error('Trip image upload error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size exceeds 5MB limit' });
      }
      return res.status(400).json({ error: 'File upload error', message: err.message });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const originalFilename = req.file.originalname.toLowerCase();
    
    const forbiddenPatterns = ['logo', 'avatar', 'profile', 'icon', 'thumbnail'];
    for (const pattern of forbiddenPatterns) {
      if (originalFilename.includes(pattern)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ 
          error: 'Invalid image type',
          message: `Trip images cannot be logos, avatars, or profile pictures. Please upload a photo that represents your trip experience.`
        });
      }
    }

    try {
      const metadata = await sharp(req.file.path).metadata();
      const { width, height } = metadata;
      
      if (width < 800) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ 
          error: 'Image too small',
          message: `Trip image must be at least 800 pixels wide. Your image is ${width}px wide.`
        });
      }

      const aspectRatio = width / height;
      if (aspectRatio >= 0.95 && aspectRatio <= 1.05) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ 
          error: 'Invalid aspect ratio',
          message: 'Square images (1:1 ratio) are not allowed for trip photos. Please use a landscape or portrait image that showcases the trip experience.'
        });
      }

      const cloudPath = await uploadToCloudWithFallback(req.file.path, req.file.originalname, req.file.mimetype);
      const photoUrl = cloudPath || `/uploads/${req.file.filename}`;
      
      console.log(`✅ Trip image uploaded: ${photoUrl} (${width}x${height}) by user ${req.user.userId}`);

      res.json({
        success: true,
        photoUrl: photoUrl,
        url: photoUrl,
        filename: req.file.filename,
        size: req.file.size,
        dimensions: { width, height }
      });
    } catch (imgError) {
      console.error('Image processing error:', imgError);
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ 
        error: 'Image processing failed',
        message: 'Could not process the image. Please try a different file.'
      });
    }
  });
};

router.post('/upload-trip-image', verifyToken, handleTripImageUpload);
router.post('/upload/upload-trip-image', verifyToken, handleTripImageUpload);

router.post('/upload-photo', verifyToken, (req, res, next) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      console.error('Multer error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size exceeds 5MB limit' });
      } else if (err.message && err.message.includes('Only image files')) {
        return res.status(400).json({ error: 'Only image files are allowed' });
      } else if (err.message && err.message.includes('Invalid')) {
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: 'File upload error', message: err.message });
    }
    
    if (!req.file) {
      console.error('No file in request. Headers:', req.headers);
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const cloudPath = await uploadToCloudWithFallback(req.file.path, req.file.originalname, req.file.mimetype);
    const photoUrl = cloudPath || `/uploads/${req.file.filename}`;
    
    console.log(`✅ Photo uploaded: ${photoUrl}${req.user ? ` by user ${req.user.userId}` : ' (anonymous)'}`);

    res.json({
      success: true,
      photoUrl: photoUrl,
      url: photoUrl,
      filename: req.file.filename,
      size: req.file.size
    });
  });
});

module.exports = router;
