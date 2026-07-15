import { Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

// Owner: Jorge (@SrJorgeG) — Identity & Access (see docs/planning/Jorge.md)
@Module({
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
})
export class OrganizationsModule {}
