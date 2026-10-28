import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateLessonDto } from '../dto/create-lesson.dto';
import { UpdateLessonDto } from '../dto/update-lesson.dto';

const videoErrors = async (cls: typeof CreateLessonDto | typeof UpdateLessonDto, body: object) => {
  const errors = await validate(plainToInstance(cls, { title: 'Lección', ...body }));
  return errors.filter((error) => error.property === 'videoUrl');
};

describe.each([
  ['CreateLessonDto', CreateLessonDto],
  ['UpdateLessonDto', UpdateLessonDto],
])('%s videoUrl', (_name, cls) => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
    ['https://vimeo.com/76979871'],
    ['https://cdn.example.com/clip.mp4'],
  ])('accepts %s', async (url) => {
    expect(await videoErrors(cls, { videoUrl: url })).toHaveLength(0);
  });

  it.each([[undefined], [null], ['']])('allows %p (no video / clear)', async (value) => {
    expect(await videoErrors(cls, { videoUrl: value })).toHaveLength(0);
  });

  it.each([
    ['no-es-url'],
    ['http://example.com/a.mp4'],
    ['javascript:alert(1)'],
    ['ftp://example.com/a.mp4'],
    ['//example.com/a.mp4'],
  ])('rejects %s with a Spanish message', async (url) => {
    const errors = await videoErrors(cls, { videoUrl: url });
    expect(errors).toHaveLength(1);
    expect(Object.values(errors[0].constraints ?? {}).join(' ')).toContain('URL del vídeo');
  });

  it('rejects URLs over 2000 characters', async () => {
    const errors = await videoErrors(cls, { videoUrl: `https://example.com/${'a'.repeat(2000)}` });
    expect(errors).toHaveLength(1);
  });
});
