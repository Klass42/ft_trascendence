import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ID_PATTERN } from '../validation/id';

@Injectable()
export class ParseIdPipe implements PipeTransform<string | undefined, string | undefined> {
  transform(value: string | undefined): string | undefined {
    if (value === undefined) return undefined;
    if (!ID_PATTERN.test(value)) {
      throw new BadRequestException('El identificador debe tener un formato válido.');
    }
    return value;
  }
}
