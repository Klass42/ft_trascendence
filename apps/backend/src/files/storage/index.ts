import { StorageService } from './storage.service';
import { LocalStorageDriver } from './local-driver.service';
import { S3StorageDriver } from './s3-driver.service';

export { StorageService, StoredFile } from './storage.service';

export function createStorageDriver(): StorageService {
  if (process.env.S3_ENDPOINT) {
    return new S3StorageDriver();
  }
  return new LocalStorageDriver();
}
