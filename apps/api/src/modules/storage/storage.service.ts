import {
  Injectable,
  Logger,
  OnModuleInit,
  BadRequestException,
} from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface ValidatedImage {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: 'jpg' | 'png' | 'webp';
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;
  private readonly defaultBucket: string;

  constructor() {
    const endpointHost = process.env.MINIO_ENDPOINT || 'localhost';
    const endpointPort = process.env.MINIO_PORT || '9000';
    const useSsl = process.env.MINIO_USE_SSL === 'true';
    const protocol = useSsl ? 'https' : 'http';

    this.defaultBucket = process.env.MINIO_BUCKET_PROOFS || 'loading-proofs';

    this.s3Client = new S3Client({
      endpoint: `${protocol}://${endpointHost}:${endpointPort}`,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.MINIO_ROOT_USER || 'logix_minio_admin',
        secretAccessKey:
          process.env.MINIO_ROOT_PASSWORD || 'logix_minio_secret_key',
      },
    });
  }

  async onModuleInit() {
    try {
      await this.ensureBucket(this.defaultBucket);
      this.logger.log(
        `MinIO storage initialized with private bucket "${this.defaultBucket}"`,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to connect to MinIO on startup: ${(err as Error).message}. Will retry on request.`,
      );
    }
  }

  /**
   * Validate image buffer with strict magic bytes verification (Adjustment 2)
   */
  validateImageBuffer(buffer: Buffer): ValidatedImage {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Tệp tải lên rỗng.');
    }

    if (buffer.length > 10 * 1024 * 1024) {
      throw new BadRequestException(
        'Kích thước ảnh vượt quá giới hạn tối đa cho phép (10MB).',
      );
    }

    // Check JPEG magic bytes: FF D8 FF
    if (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    ) {
      return { mimeType: 'image/jpeg', extension: 'jpg' };
    }

    // Check PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return { mimeType: 'image/png', extension: 'png' };
    }

    // Check WebP magic bytes: RIFF....WEBP (0-3 is RIFF, 8-11 is WEBP)
    if (
      buffer.length >= 12 &&
      buffer[0] === 0x52 && // R
      buffer[1] === 0x49 && // I
      buffer[2] === 0x46 && // F
      buffer[3] === 0x46 && // F
      buffer[8] === 0x57 && // W
      buffer[9] === 0x45 && // E
      buffer[10] === 0x42 && // B
      buffer[11] === 0x50 // P
    ) {
      return { mimeType: 'image/webp', extension: 'webp' };
    }

    throw new BadRequestException(
      'Định dạng tệp không hợp lệ. Hệ thống chỉ chấp nhận ảnh định dạng JPEG, PNG hoặc WebP hợp lệ.',
    );
  }

  async ensureBucket(bucket: string): Promise<void> {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      try {
        await this.s3Client.send(new CreateBucketCommand({ Bucket: bucket }));
        this.logger.log(`Created MinIO private bucket: ${bucket}`);
      } catch (err: any) {
        // BucketAlreadyOwnedByYou is fine
        if (err.name !== 'BucketAlreadyOwnedByYou') {
          this.logger.warn(`Could not create bucket ${bucket}: ${err.message}`);
        }
      }
    }
  }

  async uploadFile(
    key: string,
    buffer: Buffer,
    contentType: string,
    bucket = this.defaultBucket,
  ): Promise<{ fileKey: string; fileSize: number }> {
    await this.ensureBucket(bucket);

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    return { fileKey: key, fileSize: buffer.length };
  }

  /**
   * Sinh Presigned URL với thời hạn mặc định 15 phút (900s)
   */
  async getPresignedDownloadUrl(
    key: string,
    expiresInSeconds = 900,
    bucket = this.defaultBucket,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    return getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });
  }

  async downloadBuffer(
    key: string,
    bucket = this.defaultBucket,
  ): Promise<Buffer> {
    const response = await this.s3Client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    const stream = response.Body as any;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
  }
}
