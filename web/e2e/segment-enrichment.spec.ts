import { test, expect } from '@playwright/test';

import {
  addFilter,
  buildSupabaseClientFromEnv,
  collectConsoleLogs,
  generateSegmentName,
  openExaWebSearch,
  openSegmentBuilder,
  runCli,
  verifySegmentInList,
  waitForAppReady,
  waitForPreviewUpdate,
} from './helpers';

const hasSupabaseEnv =
  Boolean(process.env.SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

test.describe('Segment → Enrichment end-to-end (specs/001-segment-search/e2e-test-plan)', () => {
  test.skip(
    !hasSupabaseEnv,
    'Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for full segment → enrichment e2e tests'
  );

  const supabase = buildSupabaseClientFromEnv();

  if (!supabase) {
    throw new Error('Supabase client could not be initialised from environment');
  }

  test('T029: Filter-based segment can be snapshotted and enriched (UI + CLI + DB)', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Step 1: Create segment via Database Search UI
    await openSegmentBuilder(page);
    await addFilter(page, 'employees.position', 'eq', 'CTO');
    await waitForPreviewUpdate(page, 1000);

    const logs = collectConsoleLogs(page);
    const segmentName = generateSegmentName('Test CTOs - Filter Based');

    await page.locator('input[placeholder*="segment name"]').fill(segmentName);
    await page.click('button:has-text("Create Segment")');
    await page.waitForSelector('text=Create Segment', { state: 'hidden', timeout: 5000 });
    await verifySegmentInList(page, segmentName);

    // Verify console log indicates segment creation
    await page.waitForTimeout(500);
    expect(
      logs.some(
        (msg) => msg.includes('Segment created successfully') || msg.includes(segmentName)
      )
    ).toBe(true);

    // Fetch segment from Supabase
    const { data: segmentRow, error: segmentError } = await supabase
      .from('segments')
      .select('id, name, filter_definition, version')
      .eq('name', segmentName)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    expect(segmentError).toBeNull();
    expect(segmentRow).toBeTruthy();

    const segmentId = segmentRow!.id as string;
    const segmentVersion = (segmentRow!.version as number) ?? 1;

    // filter_definition should match the CTO filter
    expect(Array.isArray(segmentRow!.filter_definition)).toBe(true);
    expect(segmentRow!.filter_definition).toEqual([
      { field: 'employees.position', operator: 'eq', value: 'CTO' },
    ]);

    // At this stage, no segment_members should exist yet for this segment/version
    const { count: membersBeforeCount, error: membersBeforeError } = await supabase
      .from('segment_members')
      .select('*', { head: true, count: 'exact' })
      .eq('segment_id', segmentId)
      .eq('segment_version', segmentVersion);

    expect(membersBeforeError).toBeNull();
    expect(membersBeforeCount ?? 0).toBe(0);

    // Step 2: Snapshot the segment via CLI
    const snapshotResult = await runCli([
      'segment:snapshot',
      '--segment-id',
      segmentId,
      '--allow-empty',
    ]);

    expect(snapshotResult.exitCode).toBe(0);

    // Verify segment_members created for this segment/version
    const { data: membersAfter, count: membersAfterCount, error: membersAfterError } =
      await supabase
        .from('segment_members')
        .select('id, contact_id, company_id', { count: 'exact' })
        .eq('segment_id', segmentId)
        .eq('segment_version', segmentVersion)
        .limit(20);

    expect(membersAfterError).toBeNull();
    expect((membersAfterCount ?? 0) > 0).toBe(true);
    expect(membersAfter && membersAfter.length > 0).toBe(true);

    const contactIds = Array.from(
      new Set((membersAfter ?? []).map((m) => m.contact_id).filter(Boolean) as string[])
    );
    const companyIds = Array.from(
      new Set((membersAfter ?? []).map((m) => m.company_id).filter(Boolean) as string[])
    );

    // Verify contacts in snapshot have position = 'CTO'
    if (contactIds.length > 0) {
      const { data: employees, error: employeesError } = await supabase
        .from('employees')
        .select('id, position')
        .in('id', contactIds);

      expect(employeesError).toBeNull();
      for (const emp of employees ?? []) {
        expect(emp.position).toBe('CTO');
      }
    }

    // Step 3: Run enrichment via CLI (mock adapter, runNow to execute immediately)
    const enrichResult = await runCli([
      'enrich:run',
      '--segment-id',
      segmentId,
      '--adapter',
      'mock',
      '--limit',
      '10',
      '--run-now',
    ]);

    expect(enrichResult.exitCode).toBe(0);

    let enrichPayload: any = null;
    try {
      enrichPayload = JSON.parse(enrichResult.stdout.trim());
    } catch {
      // If parsing fails, the CLI output is not in expected JSON format.
    }

    expect(enrichPayload).toBeTruthy();
    expect(enrichPayload.status === 'completed' || enrichPayload.status === 'queued').toBe(true);
    if (enrichPayload.status === 'completed') {
      expect(enrichPayload.summary).toBeTruthy();
    }

    // Verify enrichment job exists and is linked to segment
    const { data: jobRow, error: jobError } = await supabase
      .from('jobs')
      .select('id, type, status, segment_id, segment_version')
      .eq('segment_id', segmentId)
      .eq('type', 'enrich')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    expect(jobError).toBeNull();
    expect(jobRow).toBeTruthy();
    expect(jobRow!.segment_id).toBe(segmentId);

    // Verify companies in segment have company_research populated for at least some rows
    if (companyIds.length > 0) {
      const { data: companies, error: companiesError } = await supabase
        .from('companies')
        .select('id, company_research')
        .in('id', companyIds)
        .limit(20);

      expect(companiesError).toBeNull();
      expect(companies && companies.length > 0).toBe(true);
      expect((companies ?? []).some((c) => c.company_research !== null)).toBe(true);
    }

    // Verify employees in segment have ai_research_data populated for at least some rows
    if (contactIds.length > 0) {
      const { data: employeesAfterEnrich, error: employeesAfterEnrichError } = await supabase
        .from('employees')
        .select('id, ai_research_data')
        .in('id', contactIds)
        .limit(20);

      expect(employeesAfterEnrichError).toBeNull();
      expect(employeesAfterEnrich && employeesAfterEnrich.length > 0).toBe(true);
      expect((employeesAfterEnrich ?? []).some((e) => e.ai_research_data !== null)).toBe(true);
    }
  });

  test('T030: EXA Web Search segment can be enriched (UI + CLI + DB)', async ({ page }) => {
    if (!process.env.EXA_API_KEY) {
      test.skip();
    }

    await page.goto('/');
    await waitForAppReady(page);

    // Step 1: Create segment via EXA Web Search UI
    await openExaWebSearch(page);

    const searchQuery =
      'Find CTOs at Series A SaaS companies in San Francisco with 50-200 employees';
    await page.locator('textarea[placeholder*="Describe"]').fill(searchQuery);

    const logs = collectConsoleLogs(page);

    await page.click('button:has-text("Search")');
    await expect(page.locator('text=Searching')).toBeVisible({ timeout: 2000 });
    await page.waitForTimeout(5000);

    const hasResults = await page
      .locator('text=/Found .* companies/i')
      .isVisible()
      .catch(() => false);

    if (!hasResults) {
      // If EXA returns no results in this environment, skip the E2E portion.
      test.skip();
    }

    const segmentName = generateSegmentName('Test CTOs - EXA Web Search');
    await page.locator('input[placeholder*="segment name"]').fill(segmentName);
    await page.click('button:has-text("Save as Segment")');

    await page.waitForSelector('text=EXA Web Search', { state: 'hidden', timeout: 5000 });
    await verifySegmentInList(page, segmentName);

    await page.waitForTimeout(500);
    expect(
      logs.some(
        (msg) =>
          msg.includes('EXA segment saved successfully') ||
          msg.includes(segmentName)
      )
    ).toBe(true);

    // Fetch EXA segment from Supabase
    const { data: segmentRow, error: segmentError } = await supabase
      .from('segments')
      .select('id, name, filter_definition, version, description')
      .eq('name', segmentName)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    expect(segmentError).toBeNull();
    expect(segmentRow).toBeTruthy();

    const segmentId = segmentRow!.id as string;
    const segmentVersion = (segmentRow!.version as number) ?? 1;

    // EXA segments should have empty filter_definition and descriptive description
    expect(Array.isArray(segmentRow!.filter_definition)).toBe(true);
    expect(segmentRow!.filter_definition.length).toBe(0);
    expect(typeof segmentRow!.description).toBe('string');
    expect((segmentRow!.description as string).toLowerCase()).toContain('exa web search');

    // segment_members should be created immediately for EXA segments
    const { data: members, count: membersCount, error: membersError } = await supabase
      .from('segment_members')
      .select('id, contact_id, company_id, snapshot')
      .eq('segment_id', segmentId)
      .eq('segment_version', segmentVersion)
      .limit(50);

    expect(membersError).toBeNull();
    expect(members && members.length > 0).toBe(true);
    expect((membersCount ?? 0) > 0).toBe(true);

    const contactIds = Array.from(
      new Set((members ?? []).map((m) => m.contact_id).filter(Boolean) as string[])
    );
    const companyIds = Array.from(
      new Set((members ?? []).map((m) => m.company_id).filter(Boolean) as string[])
    );

    // Snapshot should include EXA source + query
    for (const m of members ?? []) {
      const snapshot: any = m.snapshot;
      expect(snapshot).toBeTruthy();
      expect(snapshot.source).toBe('exa');
      expect(typeof snapshot.query).toBe('string');
      expect(snapshot.query.length).toBeGreaterThan(0);
    }

    // Verify no duplicate companies by website within this segment
    if (companyIds.length > 0) {
      const { data: companies, error: companiesError } = await supabase
        .from('companies')
        .select('id, website')
        .in('id', companyIds);

      expect(companiesError).toBeNull();
      const seenWebsites = new Set<string>();
      for (const c of companies ?? []) {
        const website = (c.website as string | null) ?? '';
        if (!website) continue;
        expect(seenWebsites.has(website)).toBe(false);
        seenWebsites.add(website);
      }
    }

    // Verify no duplicate employees by work_email within this segment
    if (contactIds.length > 0) {
      const { data: employees, error: employeesError } = await supabase
        .from('employees')
        .select('id, work_email')
        .in('id', contactIds);

      expect(employeesError).toBeNull();
      const seenEmails = new Set<string>();
      for (const e of employees ?? []) {
        const email = (e.work_email as string | null) ?? '';
        if (!email) continue;
        expect(seenEmails.has(email)).toBe(false);
        seenEmails.add(email);
      }
    }

    // Step 2: Run enrichment via CLI (mock adapter, runNow)
    const enrichResult = await runCli([
      'enrich:run',
      '--segment-id',
      segmentId,
      '--adapter',
      'mock',
      '--limit',
      '10',
      '--run-now',
    ]);

    expect(enrichResult.exitCode).toBe(0);

    let enrichPayload: any = null;
    try {
      enrichPayload = JSON.parse(enrichResult.stdout.trim());
    } catch {
      // Ignore JSON parse errors; assertion below will fail if payload is unusable.
    }

    expect(enrichPayload).toBeTruthy();
    expect(enrichPayload.status === 'completed' || enrichPayload.status === 'queued').toBe(true);

    // Verify enrichment job exists
    const { data: jobRow, error: jobError } = await supabase
      .from('jobs')
      .select('id, type, status, segment_id, segment_version')
      .eq('segment_id', segmentId)
      .eq('type', 'enrich')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    expect(jobError).toBeNull();
    expect(jobRow).toBeTruthy();

    // Verify companies in EXA segment have company_research populated for at least some rows
    if (companyIds.length > 0) {
      const { data: companies, error: companiesError } = await supabase
        .from('companies')
        .select('id, company_research')
        .in('id', companyIds)
        .limit(20);

      expect(companiesError).toBeNull();
      expect(companies && companies.length > 0).toBe(true);
      expect((companies ?? []).some((c) => c.company_research !== null)).toBe(true);
    }

    // Verify employees in EXA segment have ai_research_data populated for at least some rows
    if (contactIds.length > 0) {
      const { data: employeesAfterEnrich, error: employeesAfterEnrichError } = await supabase
        .from('employees')
        .select('id, ai_research_data')
        .in('id', contactIds)
        .limit(20);

      expect(employeesAfterEnrichError).toBeNull();
      expect(employeesAfterEnrich && employeesAfterEnrich.length > 0).toBe(true);
      expect((employeesAfterEnrich ?? []).some((e) => e.ai_research_data !== null)).toBe(true);
    }
  });
});

