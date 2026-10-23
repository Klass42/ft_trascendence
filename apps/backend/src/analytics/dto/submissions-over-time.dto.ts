import {
  IsDateString,
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
    const range = args.object as SubmissionsOverTimeDto;
    return analyticsDateRangeError(range.from, range.to) === null;
  }

  defaultMessage(args: ValidationArguments): string {
    const range = args.object as SubmissionsOverTimeDto;
    return analyticsDateRangeError(range.from, range.to) ?? 'El rango de fechas no es válido.';
  }
}

/** Optional ISO dates shared by the chart and CSV export. */
export class SubmissionsOverTimeDto {
  @IsOptional()
  @IsDateString()
  @Validate(AnalyticsDateRangeConstraint)
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
