import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { StorageService, StoredFile } from './storage.service';

export interface S3StorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

type S3CommandClient = Pick<S3Client, 'send'>;

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

  async getObject(objectKey: string): Promise<Readable> {
    try {
      const result = await this.client.send(new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: objectKey,
      }));
      if (!result.Body) throw new Error('Object response did not include a body');
      return result.Body as unknown as Readable;
    } catch (error) {
      this.logger.error(`Failed to read object ${objectKey}`, error instanceof Error ? error.stack : undefined);
      throw new ServiceUnavailableException('Unable to read the stored file');
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
