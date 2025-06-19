import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import logger from '../utils/logger';

export interface UploadOptions {
  folder: string;
  resource_type?: 'image' | 'video' | 'raw' | 'auto';
  public_id?: string;
  transformation?: any[];
  quality?: string | number;
  format?: string;
}

export interface UploadResult {
  public_id: string;
  secure_url: string;
  width?: number;
  height?: number;
  format?: string;
  resource_type: string;
  bytes: number;
}

class CloudinaryService {
  constructor() {
    // Configure Cloudinary
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    this.verifyConnection();
  }

  private async verifyConnection(): Promise<void> {
    try {
      await cloudinary.api.ping();
      logger.info('✅ Cloudinary service connected successfully');
    } catch (error) {
      logger.error('❌ Cloudinary service connection failed:', error);
    }
  }

  /**
   * Upload file buffer to Cloudinary
   */
  async uploadBuffer(
    buffer: Buffer,
    options: UploadOptions,
  ): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: options.folder,
          resource_type: options.resource_type || 'auto',
          public_id: options.public_id,
          transformation: options.transformation,
          quality: options.quality,
          format: options.format,
          allowed_formats:
            options.resource_type === 'image'
              ? ['jpg', 'jpeg', 'png', 'gif', 'webp']
              : undefined,
        },
        (error, result) => {
          if (error) {
            logger.error('Cloudinary upload failed:', error);
            reject(error);
          } else if (result) {
            logger.info(`File uploaded to Cloudinary: ${result.secure_url}`);
            resolve({
              public_id: result.public_id,
              secure_url: result.secure_url,
              width: result.width,
              height: result.height,
              format: result.format,
              resource_type: result.resource_type,
              bytes: result.bytes,
            });
          }
        },
      );

      const stream = Readable.from(buffer);
      stream.pipe(uploadStream);
    });
  }

  /**
   * Upload user avatar
   */
  async uploadAvatar(buffer: Buffer, userId: string): Promise<UploadResult> {
    return this.uploadBuffer(buffer, {
      folder: 'twilsta/users/avatars',
      public_id: `avatar_${userId}`,
      resource_type: 'image',
      transformation: [
        { width: 400, height: 400, crop: 'fill', gravity: 'face' },
        { quality: 'auto:good' },
        { format: 'webp' },
      ],
    });
  }

  /**
   * Upload user cover image
   */
  async uploadCoverImage(
    buffer: Buffer,
    userId: string,
  ): Promise<UploadResult> {
    return this.uploadBuffer(buffer, {
      folder: 'twilsta/users/covers',
      public_id: `cover_${userId}`,
      resource_type: 'image',
      transformation: [
        { width: 1200, height: 400, crop: 'fill' },
        { quality: 'auto:good' },
        { format: 'webp' },
      ],
    });
  }

  /**
   * Upload post media
   */
  async uploadPostMedia(
    buffer: Buffer,
    postId: string,
    mediaType: 'image' | 'video',
  ): Promise<UploadResult> {
    const transformations =
      mediaType === 'image'
        ? [
            { width: 1080, crop: 'limit' },
            { quality: 'auto:good' },
            { format: 'webp' },
          ]
        : [{ width: 720, crop: 'limit' }, { quality: 'auto:good' }];

    return this.uploadBuffer(buffer, {
      folder: `twilsta/posts/${mediaType}s`,
      public_id: `${mediaType}_${postId}_${Date.now()}`,
      resource_type: mediaType,
      transformation: transformations,
    });
  }

  /**
   * Upload message attachment
   */
  async uploadMessageAttachment(
    buffer: Buffer,
    messageId: string,
    fileName: string,
  ): Promise<UploadResult> {
    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);

    return this.uploadBuffer(buffer, {
      folder: 'twilsta/messages/attachments',
      public_id: `attachment_${messageId}_${Date.now()}`,
      resource_type: isImage ? 'image' : 'raw',
      transformation: isImage
        ? [{ width: 800, crop: 'limit' }, { quality: 'auto:good' }]
        : undefined,
    });
  }

  /**
   * Delete file from Cloudinary
   */
  async deleteFile(
    publicId: string,
    resourceType: 'image' | 'video' | 'raw' = 'image',
  ): Promise<boolean> {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      });

      if (result.result === 'ok') {
        logger.info(`File deleted from Cloudinary: ${publicId}`);
        return true;
      } else {
        logger.warn(
          `Failed to delete file from Cloudinary: ${publicId}`,
          result,
        );
        return false;
      }
    } catch (error) {
      logger.error('Error deleting file from Cloudinary:', error);
      return false;
    }
  }

  /**
   * Get optimized URL with transformations
   */
  getOptimizedUrl(publicId: string, transformations: any[] = []): string {
    return cloudinary.url(publicId, {
      transformation: transformations,
      secure: true,
    });
  }

  /**
   * Generate thumbnail URL
   */
  getThumbnailUrl(
    publicId: string,
    width: number = 150,
    height: number = 150,
  ): string {
    return cloudinary.url(publicId, {
      transformation: [
        { width, height, crop: 'fill' },
        { quality: 'auto:eco' },
        { format: 'webp' },
      ],
      secure: true,
    });
  }

  /**
   * Clean up old files by prefix
   */
  async cleanupOldFiles(
    prefix: string,
    keepCount: number = 5,
  ): Promise<number> {
    try {
      const result = await cloudinary.api.resources({
        type: 'upload',
        prefix,
        max_results: 100,
      });

      if (result.resources.length <= keepCount) {
        return 0;
      }

      // Sort by created date and delete older files
      const sortedResources = result.resources.sort(
        (a: any, b: any) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      const filesToDelete = sortedResources.slice(keepCount);
      let deletedCount = 0;

      for (const file of filesToDelete) {
        const deleted = await this.deleteFile(
          file.public_id,
          file.resource_type,
        );
        if (deleted) deletedCount++;
      }

      logger.info(
        `Cleaned up ${deletedCount} old files with prefix: ${prefix}`,
      );
      return deletedCount;
    } catch (error) {
      logger.error('Error cleaning up old files:', error);
      return 0;
    }
  }

  /**
   * Get file info
   */
  async getFileInfo(publicId: string): Promise<any> {
    try {
      const result = await cloudinary.api.resource(publicId);
      return result;
    } catch (error) {
      logger.error('Error getting file info:', error);
      return null;
    }
  }

  /**
   * Generate upload signature for client-side uploads
   */
  generateSignature(params: any): string {
    return cloudinary.utils.api_sign_request(
      params,
      process.env.CLOUDINARY_API_SECRET!,
    );
  }

  /**
   * Extract public ID from Cloudinary URL
   */
  extractPublicIdFromUrl(url: string): string {
    try {
      // Extract public ID from Cloudinary URL
      // Example: https://res.cloudinary.com/demo/image/upload/v1234567890/folder/public_id.jpg
      const matches = url.match(
        /\/([^\/]+)\.(jpg|jpeg|png|gif|webp|mp4|mov|avi|mp3|wav)$/i,
      );
      if (matches) {
        return matches[1];
      }

      // Fallback: extract everything after the last slash and before the extension
      const parts = url.split('/');
      const lastPart = parts[parts.length - 1];
      return lastPart.split('.')[0];
    } catch (error) {
      logger.error('Error extracting public ID from URL:', error);
      return '';
    }
  }

  /**
   * Upload file from multer request
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: string,
    resourceType: 'image' | 'video' | 'auto' = 'auto',
  ): Promise<UploadResult> {
    return this.uploadBuffer(file.buffer, {
      folder: `twilsta/${folder}`,
      resource_type: resourceType,
      public_id: `${folder.replace('/', '_')}_${Date.now()}`,
    });
  }
}

export default new CloudinaryService();
