import { StreamableFile } from '@nestjs/common';
import { Readable } from 'node:stream';
import { IS_PUBLIC_KEY } from '@/common/auth/public.decorator';
import { FilesController } from '../files.controller';

describe('FilesController content endpoint', () => {
  it('streams a signed file with its real name and private safety headers', async () => {
    const stream = Readable.from([Buffer.from('content')]);
    const files = {
      getContent: jest.fn(async () => ({
        file: {
          originalName: 'material de clase.pdf',
          contentType: 'application/pdf',
          sizeBytes: 7n,
        },
        stream,
      })),
    };
    const controller = new FilesController(files as never);
    const response = { setHeader: jest.fn() };
    const query = { organizationId: 'org-a', expires: '1792000000', signature: 'a'.repeat(64) };

    const result = await controller.getContent('file-a', query, response as never);

    expect(files.getContent).toHaveBeenCalledWith('file-a', 'org-a', query.expires, query.signature);
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(response.setHeader).toHaveBeenCalledWith('Content-Length', '7');
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      expect.stringContaining("filename*=UTF-8''material%20de%20clase.pdf"),
    );
    expect(response.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
    expect(result).toBeInstanceOf(StreamableFile);
    expect(result.getStream()).toBe(stream);
  });

  it('requires the short-lived capability on a public browser image route', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, FilesController.prototype.getContent)).toBe(true);
  });
});
