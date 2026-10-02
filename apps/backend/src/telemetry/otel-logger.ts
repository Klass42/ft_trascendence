import { ConsoleLogger } from '@nestjs/common';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';

function toText(message: unknown): string {
  if (typeof message === 'string') return message;
  if (message instanceof Error) return message.message;
  try {
    return JSON.stringify(message);
  } catch {
    return String(message);
  }
}

/**
 * Nest logger that keeps the usual stdout output (`docker compose logs`) and
 * also emits every record through the OpenTelemetry Logs API. The SDK started
 * in otel-sdk.ts exports those records to the collector → Loki, and stamps
 * them with the active trace id so Grafana can jump between logs and traces.
 */
export class OtelLogger extends ConsoleLogger {
  private readonly otel = logs.getLogger('nest');

  log(message: unknown, ...rest: unknown[]): void {
    super.log(message, ...rest);
    this.emit(SeverityNumber.INFO, 'INFO', message, rest);
  }

  warn(message: unknown, ...rest: unknown[]): void {
    super.warn(message, ...rest);
    this.emit(SeverityNumber.WARN, 'WARN', message, rest);
  }

  error(message: unknown, ...rest: unknown[]): void {
    super.error(message, ...rest);
    this.emit(SeverityNumber.ERROR, 'ERROR', message, rest);
  }

  fatal(message: unknown, ...rest: unknown[]): void {
    super.fatal(message, ...rest);
    this.emit(SeverityNumber.FATAL, 'FATAL', message, rest);
  }

  debug(message: unknown, ...rest: unknown[]): void {
    super.debug(message, ...rest);
    this.emit(SeverityNumber.DEBUG, 'DEBUG', message, rest);
  }

  private emit(
    severityNumber: SeverityNumber,
    severityText: string,
    message: unknown,
    rest: unknown[],
  ): void {
    // Nest passes the logger context ("AuthService") as the last argument and,
    // for errors, the stack trace before it.
    const strings = rest.filter((value): value is string => typeof value === 'string');
    const context = strings.at(-1) ?? this.context ?? 'Application';
    const stack = severityNumber >= SeverityNumber.ERROR && strings.length > 1 ? strings[0] : undefined;

    this.otel.emit({
      severityNumber,
      severityText,
      body: toText(message),
      attributes: {
        'nest.context': context,
        ...(stack ? { 'exception.stacktrace': stack } : {}),
      },
    });
  }
}
