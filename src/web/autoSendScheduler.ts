import type { CampaignAutoSendSweepResult } from '../services/campaignAutoSend.js';
import { formatErrorMessage } from '../lib/formatErrorMessage.js';

const DEFAULT_AUTO_SEND_INTERVAL_MINUTES = 10;
const DEFAULT_AUTO_SEND_BATCH_LIMIT = 25;

export interface AutoSendSchedulerDeps {
  runCampaignAutoSendSweep?: (params: {
    batchLimit?: number;
  }) => Promise<CampaignAutoSendSweepResult>;
}

export interface AutoSendSchedulerHandle {
  stop: () => void;
  readonly intervalMs: number;
  readonly batchLimit: number;
}

function parseBooleanEnv(value: string | undefined) {
  return value === '1' || value === 'true';
}

function parsePositiveIntegerEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function startAutoSendScheduler(
  deps: AutoSendSchedulerDeps,
  options: {
    intervalMs: number;
    batchLimit: number;
    logger?: Pick<Console, 'log' | 'error'>;
  }
): AutoSendSchedulerHandle | null {
  if (!deps.runCampaignAutoSendSweep) {
    return null;
  }

  const runCampaignAutoSendSweep = deps.runCampaignAutoSendSweep;
  const logger = options.logger ?? console;
  let running = false;

  const tick = async () => {
    if (running) {
      return;
    }
    running = true;
    try {
      const result = await runCampaignAutoSendSweep({ batchLimit: options.batchLimit });
      logger.log(
        `[web adapter] auto-send sweep completed (checked=${result.summary.checkedCount}, triggered=${result.summary.triggeredCount}, errors=${result.summary.errorCount})`
      );
    } catch (error) {
      logger.error(`[web adapter] auto-send sweep failed: ${formatErrorMessage(error)}`);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => {
    void tick();
  }, options.intervalMs);
  timer.unref?.();

  return {
    stop: () => clearInterval(timer),
    intervalMs: options.intervalMs,
    batchLimit: options.batchLimit,
  };
}

export function startAutoSendSchedulerFromEnv(
  deps: AutoSendSchedulerDeps,
  options: {
    logger?: Pick<Console, 'log' | 'error'>;
    mode?: 'live' | 'mock';
  } = {}
): AutoSendSchedulerHandle | null {
  if (options.mode === 'mock' || !parseBooleanEnv(process.env.AUTO_SEND_ENABLED)) {
    return null;
  }

  const intervalMinutes = parsePositiveIntegerEnv(
    process.env.AUTO_SEND_INTERVAL_MINUTES,
    DEFAULT_AUTO_SEND_INTERVAL_MINUTES
  );
  const batchLimit = parsePositiveIntegerEnv(
    process.env.AUTO_SEND_BATCH_LIMIT,
    DEFAULT_AUTO_SEND_BATCH_LIMIT
  );
  const intervalMs = intervalMinutes * 60 * 1000;
  const scheduler = startAutoSendScheduler(deps, {
    intervalMs,
    batchLimit,
    logger: options.logger,
  });

  if (scheduler) {
    (options.logger ?? console).log(
      `[web adapter] auto-send scheduler enabled (interval=${intervalMinutes}m, batchLimit=${batchLimit})`
    );
  }

  return scheduler;
}
