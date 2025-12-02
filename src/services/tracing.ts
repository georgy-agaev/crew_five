/* eslint-disable security-node/detect-crlf */
/* eslint-disable security/detect-non-literal-fs-filename */
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export interface TraceContext {
  span: string;
  service: string;
  model?: string;
}

export interface TraceRecord extends TraceContext {
  trace_id: string;
  status: 'ok' | 'error';
  latency_ms: number;
  timestamp: string;
  error?: string;
}

interface TraceHandle extends TraceContext {
  trace_id: string;
  started_at: number;
}

const defaultCap = 1000;
let emittedCount = 0;

export function isTracingEnabled(env = process.env) {
  return env.TRACE_ENABLED === 'true';
}

export function getTraceConfig(env = process.env) {
  return {
    file: env.TRACE_FILE,
    cap: env.TRACE_MAX ? Number(env.TRACE_MAX) : defaultCap,
  };
}

export function startTrace(context: TraceContext): TraceHandle {
  return {
    trace_id: randomUUID(),
    started_at: Date.now(),
    ...context,
  };
}

export function finishTrace(handle: TraceHandle, status: 'ok' | 'error', error?: string): TraceRecord {
  return {
    trace_id: handle.trace_id,
    span: handle.span,
    service: handle.service,
    model: handle.model,
    status,
    latency_ms: Date.now() - handle.started_at,
    timestamp: new Date().toISOString(),
    error,
  };
}

export function emitTrace(record: TraceRecord, env = process.env) {
  const cfg = getTraceConfig(env);
  if (emittedCount >= (cfg.cap ?? defaultCap)) return;
  emittedCount += 1;
  const line = JSON.stringify(record);
  if (cfg.file) {
    const abs = path.isAbsolute(cfg.file) ? cfg.file : path.join(process.cwd(), cfg.file);
    fs.appendFileSync(abs, line + '\n');
  } else {
    console.log(line);
  }
}
