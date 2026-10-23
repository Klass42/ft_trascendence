import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const AUTH_TOKEN_PATTERN = /^(?:[a-fA-F0-9]{64}|[A-Za-z0-9_-]{43})$/;

@Injectable()
export class ParseAuthTokenPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!AUTH_TOKEN_PATTERN.test(value)) {
      throw new BadRequestException('El token no tiene un formato válido.');
    }
    return value;
  }
}
