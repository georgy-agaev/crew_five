import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  isProcessCompaniesTriggerConfigured,
  processCompaniesTriggerInternals,
  triggerProcessCompanies,
} from './processCompaniesTrigger.js';

describe('processCompaniesTrigger', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('runs OUTREACH_PROCESS_COMPANY_CMD and parses JSON stdout', async () => {
    vi.stubEnv(
      'OUTREACH_PROCESS_COMPANY_CMD',
      'python3 /Users/georgyagaev/Projects/Outreach/scripts/process_companies_cli.py'
    );
    const execSpy = vi.spyOn(processCompaniesTriggerInternals, 'execFileAsync').mockResolvedValue({
      stdout: '{"accepted":true,"total":2,"completed":1,"failed":0,"skipped":1,"results":[{"companyId":"co-1","status":"completed"}],"errors":[]}\n',
      stderr: '',
    });

    expect(isProcessCompaniesTriggerConfigured()).toBe(true);

    const result = await triggerProcessCompanies({
      companyIds: ['co-1', 'co-2'],
      mode: 'full',
    });

    expect(execSpy).toHaveBeenCalledWith(
      '/bin/sh',
      [
        '-lc',
        "python3 /Users/georgyagaev/Projects/Outreach/scripts/process_companies_cli.py --company-ids 'co-1,co-2' --mode full",
      ],
      { maxBuffer: 4 * 1024 * 1024 }
    );
    expect(result.accepted).toBe(true);
    expect(result.total).toBe(2);
    expect(result.completed).toBe(1);
  });
});
