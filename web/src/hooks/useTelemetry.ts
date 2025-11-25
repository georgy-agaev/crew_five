const piiKeys = ['email', 'name', 'full_name'];

export function useTelemetry(enabled: boolean, sink?: (event: string, payload: Record<string, unknown>) => void) {
  return (event: string, payload: Record<string, unknown>) => {
    if (!enabled) return;
    for (const key of Object.keys(payload)) {
      if (piiKeys.includes(key)) {
        throw new Error(`Telemetry payload contains potential PII: ${key}`);
      }
    }
    if (sink) {
      sink(event, payload);
    } else {
      console.log(JSON.stringify({ event, ...payload }));
    }
  };
}
