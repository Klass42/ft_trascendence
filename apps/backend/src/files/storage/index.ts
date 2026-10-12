import { StorageService } from './storage.service';
import { LocalStorageDriver } from './local-driver.service';
import { S3StorageDriver } from './s3-driver.service';

export { StorageService, StoredFile } from './storage.service';

export function createStorageDriver(): StorageService {
  // Local disk is the safe, fully self-contained development default. S3 is
  // opt-in because merely having an endpoint in a shared .env must not make
  // the app depend on a storage service that is not part of the current stack.
  if (process.env.STORAGE_DRIVER?.toLowerCase() === 's3') {
    return new S3StorageDriver();
  }
  return new LocalStorageDriver();
}
