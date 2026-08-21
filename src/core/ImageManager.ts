import { v2 as cloudinary } from 'cloudinary';

// Configuración leída directamente de las variables de entorno de Railway
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export class ImageManager {
  /**
   * Sube una imagen y aplica transformación automática para banners (1600x400)
   */
  static async uploadBanner(buffer: Buffer): Promise<string> {
    return this.upload(buffer, {
      folder: 'banners',
      transformation: [{ width: 1600, height: 400, crop: 'fill', gravity: 'center' }]
    });
  }

  /**
   * Sube una imagen y aplica transformación automática para perfil (400x400)
   */
  static async uploadProfile(buffer: Buffer): Promise<string> {
    return this.upload(buffer, {
      folder: 'profiles',
      transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }]
    });
  }

  private static async upload(buffer: Buffer, options: any): Promise<string> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { ...options, resource_type: 'image' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result!.secure_url);
        }
      ).end(buffer);
    });
  }
}
