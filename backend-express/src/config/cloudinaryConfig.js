const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const dotenv = require('dotenv');

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'auction_arena_uploads', // The name of the folder in Cloudinary
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'gif'],
        public_id: (req, file) => file.fieldname + '-' + Date.now(),
    },
});

module.exports = {
    cloudinary,
    storage,
};
