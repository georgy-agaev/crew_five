import { Page } from '@playwright/test';

/**
 * E2E Test Helpers for Segment Workflows
 */

/**
 * Wait for the web UI to be fully loaded
 */
export async function waitForAppReady(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('text=Segment', { timeout: 10000 });
}

/**
 * Navigate to the Segment tab
 */
export async function navigateToSegmentTab(page: Page) {
  await page.click('text=Segment');
  await page.waitForSelector('text=Matching Segments');
}

/**
 * Open the SegmentBuilder modal (Database Search)
 */
export async function openSegmentBuilder(page: Page) {
  await navigateToSegmentTab(page);
  await page.click('button:has-text("Search Database")');
  await page.waitForSelector('text=Create Segment');
}

/**
 * Open the EXA Web Search modal
 */
export async function openExaWebSearch(page: Page) {
  await navigateToSegmentTab(page);
  await page.click('button:has-text("EXA Web Search")');
  await page.waitForSelector('text=EXA Web Search');
}

/**
 * Add a filter to the segment builder
 */
export async function addFilter(
  page: Page,
  field: string,
  operator: string,
  value: string
) {
  await page.click('button:has-text("Add Filter")');

  const selects = page.locator('select');
  await selects.first().selectOption(field);
  await selects.nth(1).selectOption(operator);

  await page.locator('input[type="text"]').last().fill(value);
}

/**
 * Wait for filter preview to update
 */
export async function waitForPreviewUpdate(page: Page, timeoutMs: number = 1500) {
  await page.waitForTimeout(timeoutMs); // Debounce + API call
}

/**
 * Create a segment with given name
 */
export async function createSegment(page: Page, name: string) {
  await page.locator('input[placeholder*="segment name"]').fill(name);
  await page.click('button:has-text("Create Segment")');
  await page.waitForSelector('text=Create Segment', { state: 'hidden', timeout: 5000 });
}

/**
 * Verify segment appears in the segment list
 */
export async function verifySegmentInList(page: Page, segmentName: string) {
  await page.waitForTimeout(1000); // Wait for list refresh
  await page.waitForSelector(`text=${segmentName}`);
}

/**
 * Get console logs from the page
 */
export function collectConsoleLogs(page: Page): string[] {
  const logs: string[] = [];
  page.on('console', msg => logs.push(msg.text()));
  return logs;
}

/**
 * Verify a success log message
 */
export function hasSuccessLog(logs: string[], segmentName: string): boolean {
  return logs.some(log =>
    log.includes('successfully') && log.includes(segmentName)
  );
}

/**
 * Generate a unique segment name for testing
 */
export function generateSegmentName(prefix: string): string {
  return `${prefix} - ${Date.now()}`;
}
