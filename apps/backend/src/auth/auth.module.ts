import { Module } from '@nestjs/common';

// Owner: Jorge (@SrJorgeG) — Identity & Access (see docs/planning/Jorge.md)
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthThrottlerModule } from './auth-rate-limit';

@Module({
  imports: [AuthThrottlerModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
