import type { TransformFnParams } from 'class-transformer';

/** Trim string inputs so whitespace-only values fail MinLength(1). */
export const trimString = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;
