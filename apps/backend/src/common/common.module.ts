import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { JwtStrategy } from './auth/jwt.strategy';
import { RolesGuard } from './auth/roles.guard';
import { DevAuthGuard } from './auth/dev-auth.guard';
import { AppAuthGuard } from './auth/app-auth.guard';

/**
 * Global Identity & Access primitives. Imports JwtModule (configured via env) so
 * JwtAuthGuard can verify tokens in Epic 2; exports the guards + strategy so any
 * feature module can @UseGuards them without re-importing.
 */
@Global()
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  providers: [JwtAuthGuard, RolesGuard, DevAuthGuard, AppAuthGuard, JwtStrategy],
  exports: [JwtAuthGuard, RolesGuard, DevAuthGuard, AppAuthGuard, JwtStrategy, JwtModule],
})
export class CommonModule {}