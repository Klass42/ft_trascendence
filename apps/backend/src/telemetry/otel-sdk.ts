/**
 * OpenTelemetry SDK initialization (metrics → OTLP → collector → Prometheus).
 * MUST be imported BEFORE any other application code.
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { RuntimeNodeInstrumentation } from '@opentelemetry/instrumentation-runtime-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
} from '@opentelemetry/semantic-conventions';

const OTEL_COLLECTOR_URL =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://otel-collector:4318';

const resource = new Resource({
  [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'ft-backend',
  [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '0.1.0',
  [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: process.env.NODE_ENV || 'development',
});

const metricExporter = new OTLPMetricExporter({
  url: `${OTEL_COLLECTOR_URL}/v1/metrics`,
});

const sdk = new NodeSDK({
  resource,
  // Metrics only: no trace or log exporter (no Tempo/Loki in the stack).
  metricReader: new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 10000,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': {
        ignoreIncomingRequestHook: (req) => {
          // Ignore health checks from trace generation
          return req.url === '/health';
        },
      },
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
    // Runtime metrics: heap, GC, event loop lag, active handles
    new RuntimeNodeInstrumentation({
      monitoringPrecision: 5000,
    }),
  ],
});

sdk.start();
console.log('[OTel] SDK started successfully');

// Graceful shutdown
const shutdown = async () => {
  try {
    await sdk.shutdown();
    console.log('[OTel] SDK shut down successfully');
  } catch (err) {
    console.error('[OTel] Error shutting down SDK', err);
  } finally {
    process.exit(0);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { sdk };
