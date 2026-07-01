import { Injectable } from '@nestjs/common';
import { metrics, trace, Span, SpanStatusCode } from '@opentelemetry/api';

@Injectable()
export class TelemetryService {
  private readonly meter = metrics.getMeter('ft-backend');
  private readonly tracer = trace.getTracer('ft-backend');

  // Custom metrics
  private readonly httpRequestCounter = this.meter.createCounter(
    'http_requests_total',
    { description: 'Total number of HTTP requests' },
  );

  private readonly httpRequestDuration = this.meter.createHistogram(
    'http_request_duration_ms',
    {
      description: 'HTTP request duration in milliseconds',
      unit: 'ms',
    },
  );

  private readonly activeConnections = this.meter.createUpDownCounter(
    'active_connections',
    { description: 'Number of active connections' },
  );

  recordRequest(method: string, route: string, statusCode: number): void {
    this.httpRequestCounter.add(1, { method, route, status_code: statusCode });
  }

  recordDuration(
    method: string,
    route: string,
    durationMs: number,
  ): void {
    this.httpRequestDuration.record(durationMs, { method, route });
  }

  incrementConnections(): void {
    this.activeConnections.add(1);
  }

  decrementConnections(): void {
    this.activeConnections.add(-1);
  }

  startSpan(name: string): Span {
    return this.tracer.startSpan(name);
  }

  endSpan(span: Span, error?: Error): void {
    if (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.recordException(error);
    }
    span.end();
  }
}
