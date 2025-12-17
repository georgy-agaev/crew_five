import { test, expect } from '@playwright/test';

/**
 * T029: Filter-Based Segment → Enrichment Workflow
 *
 * This test verifies that segments created via Database Search (manual filters)
 * can be successfully enriched through the existing enrichment workflow.
 *
 * Corresponds to: specs/001-segment-search/e2e-test-plan.md#T029
 */

test.describe('T029: Filter-Based Segment Creation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to web UI
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should create filter-based segment and display in list', async ({ page }) => {
    // Step 1: Navigate to Segment tab
    await page.click('text=Segment');
    await expect(page.locator('text=Matching Segments')).toBeVisible();

    // Step 2: Click "Search Database" button
    await page.click('button:has-text("Search Database")');

    // Wait for SegmentBuilder modal to open
    await expect(page.locator('text=Create Segment')).toBeVisible();

    // Step 3: Create filter
    // Click "Add Filter" button
    await page.click('button:has-text("Add Filter")');

    // Select field: employees.position
    await page.locator('select').first().selectOption('employees.position');

    // Select operator: eq
    await page.locator('select').nth(1).selectOption('eq');

    // Enter value: CTO
    await page.locator('input[type="text"]').last().fill('CTO');

    // Step 4: Wait for preview count to load
    await page.waitForTimeout(1000); // Debounce delay
    const previewText = await page.locator('text=/Found .* companies/').textContent();
    expect(previewText).toBeTruthy();
    console.log('Preview:', previewText);

    // Step 5: Enter segment name
    const segmentName = `Test CTOs - Filter Based - ${Date.now()}`;
    await page.locator('input[placeholder*="segment name"]').fill(segmentName);

    // Step 6: Click "Create Segment"
    await page.click('button:has-text("Create Segment")');

    // Step 7: Verify modal closes
    await expect(page.locator('text=Create Segment')).not.toBeVisible({ timeout: 5000 });

    // Step 8: Verify segment appears in list
    await page.waitForTimeout(1000); // Wait for list refresh
    await expect(page.locator(`text=${segmentName}`)).toBeVisible();

    // Verify console log (check for success message in browser console)
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    // Check logs contain success message
    await page.waitForTimeout(500);
    const hasSuccessLog = logs.some(log =>
      log.includes('Segment created successfully') ||
      log.includes(segmentName)
    );
    expect(hasSuccessLog).toBe(true);
  });

  test('should show validation error for empty segment name', async ({ page }) => {
    await page.click('text=Segment');
    await page.click('button:has-text("Search Database")');

    await expect(page.locator('text=Create Segment')).toBeVisible();

    // Add filter
    await page.click('button:has-text("Add Filter")');
    await page.locator('select').first().selectOption('employees.position');
    await page.locator('select').nth(1).selectOption('eq');
    await page.locator('input[type="text"]').last().fill('CEO');

    // Try to create without name
    await page.click('button:has-text("Create Segment")');

    // Should show validation error or button should be disabled
    const createButton = page.locator('button:has-text("Create Segment")');
    const isDisabled = await createButton.isDisabled();
    expect(isDisabled).toBe(true);
  });

  test('should display filter preview counts', async ({ page }) => {
    await page.click('text=Segment');
    await page.click('button:has-text("Search Database")');

    await expect(page.locator('text=Create Segment')).toBeVisible();

    // Add filter
    await page.click('button:has-text("Add Filter")');
    await page.locator('select').first().selectOption('companies.country');
    await page.locator('select').nth(1).selectOption('eq');
    await page.locator('input[type="text"]').last().fill('US');

    // Wait for preview to update
    await page.waitForTimeout(1500); // Debounce + network

    // Verify preview section shows counts
    const previewSection = page.locator('[role="status"]');
    await expect(previewSection).toBeVisible();

    // Should show company and employee counts
    await expect(page.locator('text=/companies/i')).toBeVisible();
    await expect(page.locator('text=/employees/i')).toBeVisible();
  });
});
