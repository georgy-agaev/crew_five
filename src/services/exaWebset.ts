/**
 * EXA Webset Service
 *
 * Wrapper around EXA Webset API for segment discovery.
 * Transforms EXA search results into structured company/employee data.
 */

import { buildExaClientFromEnv } from '../integrations/exa';
import type {
  ExaWebsetSearchRequest,
  ExaWebsetSearchResult,
  ExaCompanyResult,
  ExaEmployeeResult,
} from '../types/exaWebset';

const DEFAULT_MAX_RESULTS = 100;
const WEBSET_NAME_PREFIX = 'crew_five_segment';

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    // Remove www. prefix if present
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

/**
 * Detect if item is likely an employee/person profile
 */
function isLikelyEmployeeProfile(url: string, title?: string): boolean {
  const domain = extractDomain(url);
  if (!domain) return false;

  // LinkedIn profiles are always employees
  if (domain.includes('linkedin.com')) return true;

  // Other professional profile sites
  const profileSites = ['twitter.com', 'github.com', 'xing.com', 'about.me'];
  if (profileSites.some((site) => domain.includes(site))) return true;

  // Title patterns that suggest person profile
  // Must be specific to avoid false positives with company pages
  if (title) {
    // Pattern: "FirstName LastName - Role at Company"
    // Requires at least two words before the dash for name
    const namePattern = /^[A-Z][a-z]+\s+[A-Z][a-z]+\s*[-–]\s*.+\bat\b/i;

    // Pattern: LinkedIn suffix
    const linkedInSuffix = /\|.*LinkedIn/i;

    return namePattern.test(title) || linkedInSuffix.test(title);
  }

  return false;
}

/**
 * Parse company information from EXA result item
 *
 * Strategy:
 * - Extract domain from URL
 * - Use title as company name if it looks like a company (e.g., "Company Name - About")
 * - Confidence decreases with result position
 */
function parseCompanyFromItem(
  item: { url: string; title?: string },
  index: number,
  total: number
): ExaCompanyResult | null {
  const domain = extractDomain(item.url);
  if (!domain) return null;

  // Skip if it looks like an employee profile
  if (isLikelyEmployeeProfile(item.url, item.title)) return null;

  // Extract company name from title
  // Common patterns: "Company Name | About", "Company Name - Products", etc.
  let name = domain;
  if (item.title) {
    // Remove common suffixes and clean up
    const cleaned = item.title
      .replace(/\s*[-|]\s*(About|Products|Services|Home|Homepage).*$/i, '')
      .trim();
    if (cleaned.length > 0 && cleaned.length < 100) {
      name = cleaned;
    }
  }

  // Confidence score based on position (1.0 for first result, decreasing)
  const confidenceScore = Math.max(0.5, 1.0 - (index / total) * 0.5);

  return {
    name,
    domain,
    confidenceScore,
    sourceUrl: item.url,
  };
}

/**
 * Parse employee information from EXA result item
 *
 * Strategy:
 * - Detect LinkedIn URLs and other professional profiles
 * - Extract name and role from title
 * - Link to company if domain suggests it
 */
function parseEmployeeFromItem(
  item: { url: string; title?: string },
  index: number,
  total: number
): ExaEmployeeResult | null {
  const domain = extractDomain(item.url);
  if (!domain) return null;

  // Only parse if it looks like an employee profile
  if (!isLikelyEmployeeProfile(item.url, item.title)) return null;

  // Detect LinkedIn profiles
  const isLinkedIn = domain.includes('linkedin.com');

  if (!isLinkedIn && !item.title) return null;

  let name = '';
  let role: string | undefined;
  let companyName: string | undefined;
  let linkedinUrl: string | undefined;

  if (isLinkedIn) {
    linkedinUrl = item.url;

    // Parse LinkedIn title: "Name - Role at Company | LinkedIn"
    if (item.title) {
      const cleaned = item.title.replace(/\s*\|\s*LinkedIn.*$/i, '').trim();
      const parts = cleaned.split(/\s*[-–]\s*/);

      if (parts.length >= 1) {
        name = parts[0].trim();
      }

      if (parts.length >= 2) {
        // Extract role and company from "Role at Company"
        const roleCompany = parts[1];
        const atMatch = roleCompany.match(/^(.+?)\s+at\s+(.+)$/i);
        if (atMatch) {
          role = atMatch[1].trim();
          companyName = atMatch[2].trim();
        } else {
          role = roleCompany.trim();
        }
      }
    }
  } else {
    // Generic profile page - try to extract from title
    if (item.title) {
      // Simple heuristic: first part before separator is likely name
      const parts = item.title.split(/\s*[-|]\s*/);
      if (parts.length >= 1) {
        name = parts[0].trim();
      }
      if (parts.length >= 2) {
        role = parts[1].trim();
      }
    }
  }

  // Skip if we couldn't extract a name
  if (!name) return null;

  // Confidence score based on position and data completeness
  let confidenceScore = Math.max(0.3, 1.0 - (index / total) * 0.5);
  if (role) confidenceScore += 0.1;
  if (companyName) confidenceScore += 0.1;
  confidenceScore = Math.min(1.0, confidenceScore);

  return {
    name,
    role,
    companyName,
    companyDomain: !isLinkedIn ? domain : undefined,
    linkedinUrl,
    confidenceScore,
    sourceUrl: item.url,
  };
}

/**
 * Search for companies and employees using EXA Webset
 *
 * Flow:
 * 1. Create webset with segment description as query
 * 2. Fetch webset items (URLs + titles)
 * 3. Parse items into companies and employees
 * 4. Return structured results
 *
 * @throws Error if EXA_API_KEY not configured
 * @throws Error if API request fails
 */
export async function searchExaWebset(
  request: ExaWebsetSearchRequest
): Promise<ExaWebsetSearchResult> {
  const {
    description,
    maxResults = DEFAULT_MAX_RESULTS,
    includeCompanies = true,
    includeEmployees = true,
  } = request;

  if (!description || description.trim().length === 0) {
    throw new Error('Description is required for EXA Webset search');
  }

  // Build EXA client (throws if EXA_API_KEY missing)
  const exaClient = buildExaClientFromEnv();

  // Create webset with timestamp to ensure uniqueness
  const websetName = `${WEBSET_NAME_PREFIX}_${Date.now()}`;
  const websetResponse = await exaClient.createWebset({
    name: websetName,
    queries: [description],
  });

  // Fetch items from webset
  const itemsResponse = await exaClient.getWebsetItems({
    websetId: websetResponse.id,
    limit: maxResults,
  });

  const items = itemsResponse.items || [];
  const totalResults = items.length;

  // Parse items into companies and employees
  const companies: ExaCompanyResult[] = [];
  const employees: ExaEmployeeResult[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // Try parsing as company
    if (includeCompanies) {
      const company = parseCompanyFromItem(item, i, totalResults);
      if (company) {
        companies.push(company);
      }
    }

    // Try parsing as employee
    if (includeEmployees) {
      const employee = parseEmployeeFromItem(item, i, totalResults);
      if (employee) {
        employees.push(employee);
      }
    }
  }

  return {
    companies,
    employees,
    totalResults,
    query: description,
  };
}

/**
 * Validate EXA Webset configuration
 *
 * @returns true if EXA_API_KEY is configured
 */
export function isExaWebsetConfigured(): boolean {
  return Boolean(process.env.EXA_API_KEY && process.env.EXA_API_KEY.trim().length > 0);
}
