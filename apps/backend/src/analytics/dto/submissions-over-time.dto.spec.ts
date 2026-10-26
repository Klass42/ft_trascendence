import { validate } from 'class-validator';
import { SubmissionsOverTimeDto } from './submissions-over-time.dto';

function dto(from?: string, to?: string): SubmissionsOverTimeDto {
  const value = new SubmissionsOverTimeDto();
  value.from = from;
  value.to = to;
  return value;
}

describe('SubmissionsOverTimeDto', () => {
  it('accepts an ordered range up to 366 days', async () => {
    const errors = await validate(dto('2025-01-01', '2026-01-02'));
    expect(errors).toHaveLength(0);
  });

  it('rejects from after to with a clear message', async () => {
    const errors = await validate(dto('2025-01-02', '2025-01-01'));
    expect(errors[0].constraints?.analyticsDateRange)
      .toBe('La fecha «Desde» debe ser anterior o igual a «Hasta».');
  });

  it('rejects a range longer than 366 days', async () => {
    const errors = await validate(dto('2025-01-01', '2026-01-03'));
    expect(errors[0].constraints?.analyticsDateRange)
      .toBe('El rango de fechas no puede superar 366 días.');
  });

  it('validates each optional bound as an ISO date string', async () => {
    const errors = await validate(dto('ayer', '2025-01-02'));
    expect(errors[0].constraints?.isDateString).toBeDefined();
  });
});
