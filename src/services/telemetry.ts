export interface TelemetryOptions {
  enabled?: boolean;
  sink?: (event: string, payload: Record<string, unknown>) => void;
}

const disallowedKeys = ['email', 'name', 'full_name'];

export function validateTelemetryContext(payload: Record<string, unknown>) {
  for (const key of Object.keys(payload)) {
    if (disallowedKeys.includes(key)) {
      throw new Error(`Telemetry payload contains potential PII key: ${key}`);
    }
  }
}

export function emitTelemetry(event: string, payload: Record<string, unknown>, opts: TelemetryOptions = {}) {
  if (!opts.enabled) return;
  validateTelemetryContext(payload);
  if (opts.sink) {
    opts.sink(event, payload);
  } else {
    console.log(JSON.stringify({ event, ...payload }));
  }
}
