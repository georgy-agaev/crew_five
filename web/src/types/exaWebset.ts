/**
 * EXA Webset types for web-based segment discovery
 * Based on spec requirements for EXA Webset integration
 */

export interface ExaCompanyResult {
  name: string;
  domain?: string;
  location?: string;
  industry?: string;
  size?: string;
  confidenceScore?: number;
  sourceUrl?: string;
}

export interface ExaEmployeeResult {
  name: string;
  role?: string;
  title?: string;
  companyName?: string;
  companyDomain?: string;
  location?: string;
  email?: string;
  linkedinUrl?: string;
  confidenceScore?: number;
  sourceUrl?: string;
}

export interface ExaWebsetSearchResult {
  companies: ExaCompanyResult[];
  employees: ExaEmployeeResult[];
  totalResults: number;
  query: string;
}

export interface ExaWebsetSearchRequest {
  description: string;
  maxResults?: number;
  includeCompanies?: boolean;
  includeEmployees?: boolean;
}
