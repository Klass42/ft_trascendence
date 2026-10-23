import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { LocalStorageDriver } from '../local-driver.service';

describe('LocalStorageDriver', () => {
  const originalUploadDir = process.env.UPLOAD_DIR;
  let uploadDir: string;
  let driver: LocalStorageDriver;

  beforeEach(async () => {
    uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'files-local-'));
    process.env.UPLOAD_DIR = uploadDir;
    driver = new LocalStorageDriver();
  });

  afterEach(async () => {
    await fs.rm(uploadDir, { recursive: true, force: true });
    if (originalUploadDir === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = originalUploadDir;
  });

  it('stores and streams bytes from the organization-scoped UUID key', async () => {
    const file = {
      originalname: '../../private.pdf',
      mimetype: 'application/pdf',
      size: 7,
      buffer: Buffer.from('content'),
    } as Express.Multer.File;
    const stored = await driver.putObject(file, 'org-a');

    expect(stored.objectKey).toMatch(/^org-a\/[0-9a-f-]{36}$/);
    const stream = await driver.getObject(stored.objectKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks)).toEqual(file.buffer);

    await driver.deleteObject(stored.objectKey);
    await expect(driver.getObject(stored.objectKey)).rejects.toThrow('File not found');
  });

  it('rejects object keys that escape the storage root', async () => {
    await expect(driver.getObject('../outside')).rejects.toThrow('Invalid storage object key');
  });
});
