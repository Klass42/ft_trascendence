import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { StorageService, StoredFile } from './storage.service';

export interface S3StorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  signedUrlTtlSeconds: number;
}

type S3CommandClient = Pick<S3Client, 'send'>;

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function s3StorageConfigFromEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): S3StorageConfig {
  const endpoint = env.S3_ENDPOINT?.trim();
  // Keep the old project variable names working while exposing the standard
  // AWS names to new deployments.
  const accessKeyId = env.S3_ACCESS_KEY_ID?.trim() ?? env.S3_ACCESS_KEY?.trim();
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY?.trim() ?? env.S3_SECRET_KEY?.trim();
  if (!endpoint) throw new Error('S3_ENDPOINT is required when object storage is enabled');
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are required when object storage is enabled');
  }

  return {
    endpoint,
    region: env.S3_REGION?.trim() || 'us-east-1',
    bucket: env.S3_BUCKET?.trim() || 'ft-uploads',
    accessKeyId,
    secretAccessKey,
    // Garage and most local S3-compatible services use path-style buckets.
    forcePathStyle: env.S3_FORCE_PATH_STYLE?.toLowerCase() !== 'false',
    signedUrlTtlSeconds: Math.min(
      positiveInteger(env.S3_SIGNED_URL_TTL_SECONDS, 300),
      3600,
    ),
  };
}

@Injectable()
export class S3StorageDriver extends StorageService {
  private readonly logger = new Logger(S3StorageDriver.name);
  private readonly client: S3CommandClient;
  private readonly config: S3StorageConfig;

  constructor(config = s3StorageConfigFromEnvironment(), client?: S3CommandClient) {
    super();
    this.config = config;
    this.client = client ?? new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: config.forcePathStyle,
    });
  }

  async putObject(
    file: Express.Multer.File,
    organizationId: string,
  ): Promise<StoredFile> {
    const objectKey = `${organizationId}/${randomUUID()}`;
    try {
      await this.client.send(new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: objectKey,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentLength: file.size,
      }));
      return { bucket: this.config.bucket, objectKey };
    } catch (error) {
      this.logger.error(`Failed to upload object ${objectKey}`, error instanceof Error ? error.stack : undefined);
      throw new ServiceUnavailableException('Unable to store the uploaded file');
    }
  }

  async getSignedUrl(objectKey: string): Promise<string> {
    try {
      return await getSignedUrl(
        this.client as S3Client,
        new GetObjectCommand({ Bucket: this.config.bucket, Key: objectKey }),
        { expiresIn: this.config.signedUrlTtlSeconds },
      );
    } catch (error) {
      this.logger.error(`Failed to sign object URL for ${objectKey}`, error instanceof Error ? error.stack : undefined);
      throw new ServiceUnavailableException('Unable to access the stored file');
    }
  }

  async deleteObject(objectKey: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: objectKey,
      }));
    } catch (error) {
      this.logger.error(`Failed to delete object ${objectKey}`, error instanceof Error ? error.stack : undefined);
      throw new ServiceUnavailableException('Unable to delete the stored file');
    }
  }
}
