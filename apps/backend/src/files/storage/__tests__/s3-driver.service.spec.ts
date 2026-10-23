import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { ServiceUnavailableException } from '@nestjs/common';
import { Readable } from 'node:stream';
import {
  S3StorageConfig,
  S3StorageDriver,
  s3StorageConfigFromEnvironment,
} from '../s3-driver.service';

const config: S3StorageConfig = {
  endpoint: 'http://garage:3900',
  region: 'us-east-1',
  bucket: 'uploads',
  accessKeyId: 'access-key',
  secretAccessKey: 'secret-key',
  forcePathStyle: true,
};

const file = {
  originalname: 'notes.pdf',
  mimetype: 'application/pdf',
  size: 3,
  buffer: Buffer.from('pdf'),
} as Express.Multer.File;

describe('S3StorageDriver', () => {
  const send = jest.fn();
  let driver: S3StorageDriver;

  beforeEach(() => {
    jest.clearAllMocks();
    send.mockResolvedValue({});
    driver = new S3StorageDriver(config, { send });
  });

  it('uploads to a UUID key scoped by organization without using the original filename', async () => {
    const stored = await driver.putObject(file, 'org-1');

    expect(stored.bucket).toBe('uploads');
    expect(stored.objectKey).toMatch(/^org-1\/[0-9a-f-]{36}$/);
    expect(stored.objectKey).not.toContain(file.originalname);
    const command = send.mock.calls[0][0] as PutObjectCommand;
    expect(command.input).toEqual(expect.objectContaining({
      Bucket: 'uploads',
      Key: stored.objectKey,
      Body: file.buffer,
      ContentType: 'application/pdf',
      ContentLength: 3,
    }));
  });

  it('streams objects through the authenticated backend endpoint', async () => {
    const body = Readable.from([Buffer.from('pdf')]);
    send.mockResolvedValueOnce({ Body: body });

    await expect(driver.getObject('org-1/file-id')).resolves.toBe(body);
    const command = send.mock.calls[0][0] as GetObjectCommand;
    expect(command.input).toEqual({ Bucket: 'uploads', Key: 'org-1/file-id' });
  });

  it('sends a delete command for an object', async () => {
    await driver.deleteObject('org-1/file-id');
    const command = send.mock.calls[0][0] as DeleteObjectCommand;
    expect(command.input).toEqual({ Bucket: 'uploads', Key: 'org-1/file-id' });
  });

  it('turns object-storage failures into useful HTTP errors', async () => {
    send.mockRejectedValueOnce(new Error('Garage unavailable'));
    await expect(driver.putObject(file, 'org-1')).rejects.toThrow(ServiceUnavailableException);

    send.mockRejectedValueOnce(new Error('Garage unavailable'));
    await expect(driver.getObject('org-1/file-id')).rejects.toThrow(ServiceUnavailableException);
  });
});

describe('s3StorageConfigFromEnvironment', () => {
  it('requires an endpoint and credentials', () => {
    expect(() => s3StorageConfigFromEnvironment({})).toThrow('S3_ENDPOINT');
    expect(() => s3StorageConfigFromEnvironment({ S3_ENDPOINT: 'http://garage' })).toThrow('S3_ACCESS_KEY_ID');
  });

  it('defaults to Garage-compatible path-style requests', () => {
    expect(s3StorageConfigFromEnvironment({
      S3_ENDPOINT: 'http://garage',
      S3_ACCESS_KEY_ID: 'key',
      S3_SECRET_ACCESS_KEY: 'secret',
    })).toMatchObject({
      bucket: 'ft-uploads',
      region: 'us-east-1',
      forcePathStyle: true,
    });
  });

  it('accepts the legacy Compose credential names during the transition', () => {
    expect(s3StorageConfigFromEnvironment({
      S3_ENDPOINT: 'http://garage',
      S3_ACCESS_KEY: 'key',
      S3_SECRET_KEY: 'secret',
    })).toMatchObject({ accessKeyId: 'key', secretAccessKey: 'secret' });
  });
});
