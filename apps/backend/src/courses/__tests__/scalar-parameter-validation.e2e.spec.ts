import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import type { AuthUser } from '@/common/auth';
import { CourseAccessService } from '../course-access.service';
import { EnrollmentsController } from '../enrollments/enrollments.controller';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { SectionsController } from '../sections/sections.controller';
import { SectionsService } from '../sections/sections.service';

const USER: AuthUser = {
  userId: `c${'u'.repeat(24)}`,
  email: 'student@example.test',
  name: 'Student',
  avatarUrl: null,
  organizationId: `c${'o'.repeat(24)}`,
  role: 'STUDENT',
  emailNotificationsEnabled: true,
  preferredLanguage: 'es',
};

describe('course scalar parameter validation (e2e)', () => {
  let app: INestApplication;
  const sectionsService = { reorder: jest.fn() };
  const enrollmentsService = { getProgress: jest.fn() };
  const courseAccess = {
    assertSubjectStaff: jest.fn(),
    assertSubjectReadable: jest.fn(),
  };
  const subjectId = `c${'s'.repeat(24)}`;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [SectionsController, EnrollmentsController],
      providers: [
        { provide: SectionsService, useValue: sectionsService },
        { provide: EnrollmentsService, useValue: enrollmentsService },
        { provide: CourseAccessService, useValue: courseAccess },
      ],
    }).compile();

    app = module.createNestApplication();
    app.use((req: { user?: AuthUser }, _res: unknown, next: () => void) => {
      req.user = USER;
      next();
    });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects malformed subject ids before controller access checks', async () => {
    await request(app.getHttpServer())
      .patch('/subjects/not%20a%20valid%20id/sections/reorder')
      .send({ orderedIds: [`c${'a'.repeat(24)}`] })
      .expect(400);

    expect(courseAccess.assertSubjectStaff).not.toHaveBeenCalled();
    expect(sectionsService.reorder).not.toHaveBeenCalled();
  });

  it('rejects malformed orderedIds and userId values', async () => {
    await request(app.getHttpServer())
      .patch(`/subjects/${subjectId}/sections/reorder`)
      .send({ orderedIds: ['section 1'] })
      .expect(400);
    expect(sectionsService.reorder).not.toHaveBeenCalled();

    await request(app.getHttpServer())
      .get(`/subjects/${subjectId}/progress`)
      .query({ userId: 'user 1' })
      .expect(400);
    expect(enrollmentsService.getProgress).not.toHaveBeenCalled();
  });
});
