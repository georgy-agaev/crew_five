# EXA Webset Service Usage

## Overview

The EXA Webset service wrapper (`src/services/exaWebset.ts`) provides a high-level interface for discovering companies and employees using the EXA Webset API.

## Prerequisites

Set the EXA API key in your environment:
```bash
export EXA_API_KEY="your-exa-api-key"
export EXA_API_BASE="https://api.exa.ai"  # Optional, defaults to https://api.exa.ai
```

## Basic Usage

```typescript
import { searchExaWebset, isExaWebsetConfigured } from './src/services/exaWebset';

// Check if EXA is configured
if (!isExaWebsetConfigured()) {
  console.error('EXA_API_KEY not configured');
  process.exit(1);
}

// Search for companies and employees
const result = await searchExaWebset({
  description: 'enterprise SaaS companies in healthcare',
  maxResults: 50,
});

console.log(`Found ${result.companies.length} companies and ${result.employees.length} employees`);
console.log(`Total results: ${result.totalResults}`);
console.log(`Query: ${result.query}`);

// Access company data
result.companies.forEach((company) => {
  console.log(`Company: ${company.name} (${company.domain})`);
  console.log(`  Confidence: ${company.confidenceScore}`);
  console.log(`  Source: ${company.sourceUrl}`);
});

// Access employee data
result.employees.forEach((employee) => {
  console.log(`Employee: ${employee.name}`);
  console.log(`  Role: ${employee.role}`);
  console.log(`  Company: ${employee.companyName}`);
  console.log(`  LinkedIn: ${employee.linkedinUrl}`);
  console.log(`  Confidence: ${employee.confidenceScore}`);
});
```

## Advanced Options

### Search Only Companies

```typescript
const result = await searchExaWebset({
  description: 'AI startups in San Francisco',
  maxResults: 100,
  includeCompanies: true,
  includeEmployees: false,
});
```

### Search Only Employees

```typescript
const result = await searchExaWebset({
  description: 'CTOs in fintech companies',
  maxResults: 50,
  includeCompanies: false,
  includeEmployees: true,
});
```

## Result Parsing

### Company Results

The service extracts company information from URLs and titles:

- **Domain**: Extracted from URL (www. prefix removed)
- **Name**: Cleaned from title (removes common suffixes like "About", "Products", etc.)
- **Confidence Score**: Based on result position (1.0 for first result, decreasing to 0.5)
- **Source URL**: Original URL from EXA result

### Employee Results

The service intelligently detects employee profiles:

- **LinkedIn Profiles**: Automatically detected and parsed
  - Name, role, and company extracted from title
  - LinkedIn URL preserved
- **Other Profiles**: Twitter, GitHub, etc.
- **Name Pattern**: "FirstName LastName - Role at Company"
- **Confidence Score**: Based on position and data completeness (0.3-1.0)

## Error Handling

```typescript
try {
  const result = await searchExaWebset({
    description: 'machine learning engineers',
  });
} catch (error) {
  if (error.message.includes('EXA_API_KEY')) {
    console.error('EXA API key not configured');
  } else if (error.message.includes('Exa request failed')) {
    console.error('EXA API request failed:', error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## API Reference

### `searchExaWebset(request: ExaWebsetSearchRequest): Promise<ExaWebsetSearchResult>`

Search for companies and employees using EXA Webset.

**Parameters:**
- `description` (required): Search query/segment description
- `maxResults` (optional): Maximum number of results (default: 100)
- `includeCompanies` (optional): Include company results (default: true)
- `includeEmployees` (optional): Include employee results (default: true)

**Returns:**
- `companies`: Array of company results
- `employees`: Array of employee results
- `totalResults`: Total number of items returned by EXA
- `query`: Original search query

**Throws:**
- Error if `description` is empty
- Error if `EXA_API_KEY` is not configured
- Error if EXA API request fails

### `isExaWebsetConfigured(): boolean`

Check if EXA API key is configured.

**Returns:** `true` if `EXA_API_KEY` is set and non-empty

## Implementation Details

### Profile Detection

The service uses intelligent heuristics to distinguish between company pages and employee profiles:

1. **LinkedIn URLs**: Always treated as employee profiles
2. **Professional Sites**: Twitter, GitHub, Xing, About.me
3. **Title Patterns**:
   - "FirstName LastName - Role at Company" → Employee
   - "Company Name - About" → Company

### Confidence Scoring

Confidence scores help prioritize results:

- **Companies**: 1.0 for first result, linearly decreasing to 0.5
- **Employees**: Base score (0.3-1.0) + bonuses for role (+0.1) and company name (+0.1)

### Data Cleaning

- URLs: www. prefix removed from domains
- Titles: Common suffixes (About, Products, Services, etc.) stripped from company names
- LinkedIn: | LinkedIn suffix removed from employee titles

## Testing

Run the test suite:

```bash
pnpm test exaWebset.test.ts
```

The tests cover:
- Webset creation and item fetching
- Company and employee parsing
- LinkedIn profile detection
- Domain extraction and cleaning
- Confidence score assignment
- Error handling
- Edge cases (invalid URLs, missing titles, etc.)
