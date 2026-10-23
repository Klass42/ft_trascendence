import { validate } from 'class-validator';
import { ParseAuthTokenPipe } from '../pipes/parse-auth-token.pipe';
import { ParseIdPipe } from '../pipes/parse-id.pipe';
import { OrderedIdsDto } from '../dto/ordered-ids.dto';
import { AttachFileDto } from '@/courses/lessons/dto/attach-file.dto';
import { RegisterDto } from '@/auth/dto/register.dto';
import { LoginDto } from '@/auth/dto/login.dto';
import { PlatformLoginDto } from '@/auth/dto/platform-login.dto';
import { ResolveOrganizationDto } from '@/auth/dto/resolve-organization.dto';
import { AcceptInvitationDto } from '@/auth/dto/accept-invitation.dto';
import { CreateUserDto } from '@/users/dto/create-user.dto';
import { UpdateProfileDto } from '@/users/dto/update-profile.dto';
import { UpdateUserDto } from '@/users/dto/update-user.dto';
import { CreateInvitationDto } from '@/organizations/dto/create-invitation.dto';
import { UpdateOrganizationDto } from '@/organizations/dto/update-organization.dto';
import { LookupUserQueryDto } from '@/users/dto/lookup-user-query.dto';
import { CreatePlatformOrganizationDto } from '@/platform/dto/create-platform-organization.dto';
import { CreatePlatformOrganizationAdminDto } from '@/platform/dto/create-platform-organization-admin.dto';
import { UpdatePlatformOrganizationDto } from '@/platform/dto/update-platform-organization.dto';
import { CreateCourseDto } from '@/courses/dto/create-course.dto';
import { ListCoursesQueryDto } from '@/courses/dto/list-courses-query.dto';
import { UpdateCourseDto } from '@/courses/dto/update-course.dto';
import { CreateSubjectDto } from '@/courses/dto/create-subject.dto';
import { UpdateSubjectDto } from '@/courses/dto/update-subject.dto';
import { CreateSectionDto } from '@/courses/sections/dto/create-section.dto';
import { UpdateSectionDto } from '@/courses/sections/dto/update-section.dto';
import { CreateLessonDto } from '@/courses/lessons/dto/create-lesson.dto';
import { UpdateLessonDto } from '@/courses/lessons/dto/update-lesson.dto';
import { CreateResourceDto } from '@/resources/dto/create-resource.dto';
import { UpdateResourceDto } from '@/resources/dto/update-resource.dto';
import { CreateThreadDto } from '@/forums/dto/create-thread.dto';
import { CreatePostDto } from '@/forums/dto/create-post.dto';
import { CreateAssignmentDto } from '@/assignments/dto/create-assignment.dto';
import { UpdateAssignmentDto } from '@/assignments/dto/update-assignment.dto';

const oversized = (length: number) => 'x'.repeat(length);

const maxLengthCases: Array<[string, new () => object, string, unknown, string]> = [
  ['registration name', RegisterDto, 'name', oversized(101), 'El nombre no puede superar los 100 caracteres.'],
  ['registration email', RegisterDto, 'email', 'a'.repeat(248) + '@b.test', 'El correo electrónico no puede superar los 254 caracteres.'],
  ['registration organization code', RegisterDto, 'organizationSlug', oversized(101), 'El código de organización no puede superar los 100 caracteres.'],
  ['login email', LoginDto, 'email', 'a'.repeat(248) + '@b.test', 'El correo electrónico no puede superar los 254 caracteres.'],
  ['login organization code', LoginDto, 'organizationSlug', oversized(101), 'El código de organización no puede superar los 100 caracteres.'],
  ['platform login email', PlatformLoginDto, 'email', 'a'.repeat(248) + '@b.test', 'El correo electrónico no puede superar los 254 caracteres.'],
  ['organization resolution code', ResolveOrganizationDto, 'slug', oversized(101), 'El código de organización no puede superar los 100 caracteres.'],
  ['invitation registration name', AcceptInvitationDto, 'name', oversized(101), 'El nombre no puede superar los 100 caracteres.'],
  ['created user name', CreateUserDto, 'name', oversized(101), 'El nombre no puede superar los 100 caracteres.'],
  ['created user email', CreateUserDto, 'email', 'a'.repeat(248) + '@b.test', 'El correo electrónico no puede superar los 254 caracteres.'],
  ['profile name', UpdateProfileDto, 'name', oversized(101), 'El nombre no puede superar los 100 caracteres.'],
  ['profile description', UpdateProfileDto, 'bio', oversized(5001), 'La descripción no puede superar los 5000 caracteres.'],
  ['updated user name', UpdateUserDto, 'name', oversized(101), 'El nombre no puede superar los 100 caracteres.'],
  ['updated user email', UpdateUserDto, 'email', 'a'.repeat(248) + '@b.test', 'El correo electrónico no puede superar los 254 caracteres.'],
  ['updated user description', UpdateUserDto, 'bio', oversized(5001), 'La descripción no puede superar los 5000 caracteres.'],
  ['invitation email', CreateInvitationDto, 'email', 'a'.repeat(248) + '@b.test', 'El correo electrónico no puede superar los 254 caracteres.'],
  ['user lookup email', LookupUserQueryDto, 'email', 'a'.repeat(248) + '@b.test', 'El correo electrónico no puede superar los 254 caracteres.'],
  ['organization name', UpdateOrganizationDto, 'name', oversized(101), 'El nombre de la organización no puede superar los 100 caracteres.'],
  ['platform organization name', CreatePlatformOrganizationDto, 'name', oversized(101), 'El nombre de la organización no puede superar los 100 caracteres.'],
  ['platform organization code', CreatePlatformOrganizationDto, 'slug', `org-${'a'.repeat(97)}`, 'El código de organización no puede superar los 100 caracteres.'],
  ['platform admin name', CreatePlatformOrganizationDto, 'adminName', oversized(101), 'El nombre no puede superar los 100 caracteres.'],
  ['platform admin email', CreatePlatformOrganizationDto, 'adminEmail', 'a'.repeat(248) + '@b.test', 'El correo electrónico no puede superar los 254 caracteres.'],
  ['platform invitation email', CreatePlatformOrganizationAdminDto, 'email', 'a'.repeat(248) + '@b.test', 'El correo electrónico no puede superar los 254 caracteres.'],
  ['updated platform organization name', UpdatePlatformOrganizationDto, 'name', oversized(101), 'El nombre de la organización no puede superar los 100 caracteres.'],
  ['course name', CreateCourseDto, 'name', oversized(201), 'El nombre del curso no puede superar los 200 caracteres.'],
  ['course search', ListCoursesQueryDto, 'search', oversized(101), 'La búsqueda no puede superar los 100 caracteres.'],
  ['updated course name', UpdateCourseDto, 'name', oversized(201), 'El nombre del curso no puede superar los 200 caracteres.'],
  ['subject title', CreateSubjectDto, 'title', oversized(201), 'El título no puede superar los 200 caracteres.'],
  ['subject description', CreateSubjectDto, 'description', oversized(5001), 'La descripción no puede superar los 5000 caracteres.'],
  ['updated subject title', UpdateSubjectDto, 'title', oversized(201), 'El título no puede superar los 200 caracteres.'],
  ['updated subject description', UpdateSubjectDto, 'description', oversized(5001), 'La descripción no puede superar los 5000 caracteres.'],
  ['section title', CreateSectionDto, 'title', oversized(201), 'El título no puede superar los 200 caracteres.'],
  ['updated section title', UpdateSectionDto, 'title', oversized(201), 'El título no puede superar los 200 caracteres.'],
  ['lesson title', CreateLessonDto, 'title', oversized(201), 'El título no puede superar los 200 caracteres.'],
  ['updated lesson title', UpdateLessonDto, 'title', oversized(201), 'El título no puede superar los 200 caracteres.'],
  ['resource title', CreateResourceDto, 'title', oversized(201), 'El título no puede superar los 200 caracteres.'],
  ['resource description', CreateResourceDto, 'description', oversized(5001), 'La descripción no puede superar los 5000 caracteres.'],
  ['updated resource title', UpdateResourceDto, 'title', oversized(201), 'El título no puede superar los 200 caracteres.'],
  ['updated resource description', UpdateResourceDto, 'description', oversized(5001), 'La descripción no puede superar los 5000 caracteres.'],
  ['forum thread title', CreateThreadDto, 'title', oversized(201), 'El título no puede superar los 200 caracteres.'],
  ['forum opening description', CreateThreadDto, 'body', oversized(5001), 'La descripción no puede superar los 5000 caracteres.'],
  ['forum post description', CreatePostDto, 'body', oversized(5001), 'La descripción no puede superar los 5000 caracteres.'],
  ['assignment title', CreateAssignmentDto, 'title', oversized(201), 'El título no puede superar los 200 caracteres.'],
  ['assignment description', CreateAssignmentDto, 'description', oversized(5001), 'La descripción no puede superar los 5000 caracteres.'],
  ['updated assignment title', UpdateAssignmentDto, 'title', oversized(201), 'El título no puede superar los 200 caracteres.'],
  ['updated assignment description', UpdateAssignmentDto, 'description', oversized(5001), 'La descripción no puede superar los 5000 caracteres.'],
];

describe('request validation', () => {
  it.each(maxLengthCases)('rejects oversized %s with its Spanish message', async (_label, Dto, property, value, message) => {
    const dto = Object.assign(new Dto(), { [property]: value });
    const errors = await validate(dto);
    const fieldError = errors.find((error) => error.property === property);

    expect(Object.values(fieldError?.constraints ?? {})).toContain(message);
  });

  it('accepts cuid, uuid and seed ids and rejects malformed ids', () => {
    const pipe = new ParseIdPipe();
    const validIds = [`c${'a'.repeat(24)}`, '3f2b1c0e-8d4a-4b7e-9c1d-5a6e7f8091a2', 'user-student-0001'];

    for (const id of validIds) expect(pipe.transform(id)).toBe(id);
    for (const bad of ['../etc/passwd', 'a b', 'id;drop', '', 'x'.repeat(65)]) {
      expect(() => pipe.transform(bad)).toThrow('formato válido');
    }
  });

  it('accepts valid reorder ids and rejects invalid ids', async () => {
    const valid = Object.assign(new OrderedIdsDto(), { orderedIds: [`c${'a'.repeat(24)}`] });
    const invalid = Object.assign(new OrderedIdsDto(), { orderedIds: ['section 1'] });

    expect(await validate(valid)).toHaveLength(0);
    expect((await validate(invalid)).find((error) => error.property === 'orderedIds')).toBeDefined();
  });

  it('rejects malformed attachment ids', async () => {
    const invalid = Object.assign(new AttachFileDto(), { fileId: 'not a valid id' });

    expect((await validate(invalid)).find((error) => error.property === 'fileId')).toBeDefined();
  });

  it('validates supported invitation and email verification token formats', () => {
    const pipe = new ParseAuthTokenPipe();

    expect(pipe.transform('a'.repeat(64))).toBe('a'.repeat(64));
    expect(pipe.transform('A'.repeat(43))).toBe('A'.repeat(43));
    expect(() => pipe.transform('invalid-token')).toThrow('token no tiene un formato válido');
  });
});
