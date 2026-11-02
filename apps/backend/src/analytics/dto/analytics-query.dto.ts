import { ActivityType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  Validate,
} from 'class-validator';
import { analyticsDateRangeError } from '../date-range';

@ValidatorConstraint({ name: 'analyticsDateRange', async: false })
class AnalyticsDateRangeConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const range = args.object as AnalyticsQueryDto;
    return analyticsDateRangeError(range.from, range.to) === null;
  }

  defaultMessage(args: ValidationArguments): string {
    const range = args.object as AnalyticsQueryDto;
    return analyticsDateRangeError(range.from, range.to) ?? 'El rango de fechas no es válido.';
  }
}

/**
 * Filters shared by every analytics endpoint (KPIs, charts and CSV): an optional
 * ISO date range and an optional activity type.
 */
export class AnalyticsQueryDto {
  @IsOptional()
  @IsDateString()
  @Validate(AnalyticsDateRangeConstraint)
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsEnum(ActivityType)
  type?: ActivityType;
}
