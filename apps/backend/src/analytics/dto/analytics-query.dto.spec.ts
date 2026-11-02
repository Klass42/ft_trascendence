import { validate } from 'class-validator';
import { AnalyticsQueryDto } from './analytics-query.dto';

function dto(from?: string, to?: string, type?: string): AnalyticsQueryDto {
  const value = new AnalyticsQueryDto();
  value.from = from;
  value.to = to;
  value.type = type as AnalyticsQueryDto['type'];
  return value;
}

describe('AnalyticsQueryDto', () => {
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

  it('accepts a known activity type and no type at all', async () => {
    expect(await validate(dto(undefined, undefined, 'SPEAKING'))).toHaveLength(0);
    expect(await validate(dto())).toHaveLength(0);
  });

  it('rejects an unknown activity type', async () => {
    const errors = await validate(dto(undefined, undefined, 'EXAM'));
    expect(errors[0].constraints?.isEnum).toBeDefined();
  });
});
