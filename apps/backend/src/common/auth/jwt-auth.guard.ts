import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Validates access JWT. In Epic 1 nobody signs tokens yet, so any request
 * reaching this guard without a valid bearer token returns 401 — correct.
 * Epic 2 enables token issuance; no code change needed here.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
