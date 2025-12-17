import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ChatClient, ChatMessage } from './chatClient';

export interface IcpCoachProfileInput {
  name: string;
  description?: string;
  websiteUrl?: string;
  valueProp?: string;
  /**
   * Optional identifier of the coach prompt variant used for this run.
   * This is carried through jobs/analytics; the LLM scaffold remains fixed.
   */
  promptId?: string;
  /**
   * Optional free-form text provided by the user when running the coach.
   * When present, this is used as the primary user message.
   */
  userPrompt?: string;
  /**
   * Optional override for the base system prompt text, typically loaded from
   * the prompt_registry when a promptId is selected in the UI.
   */
  promptTextOverride?: string;
}

export interface IcpCoachPhase1ValueProp {
  valueProp: string;
}

export interface IcpCoachPhase2IndustryAndSize {
  industries?: string[];
  companySizes?: string[];
  exampleCompanies?: Array<{ name: string; reason?: string }>;
}

export interface IcpCoachPhase2Icp {
  industryAndSize?: IcpCoachPhase2IndustryAndSize;
  pains?: string[];
  decisionMakers?: Array<{ role: string; concerns?: string[] | string }>;
  successFactors?: string[];
  disqualifiers?: string[];
  caseStudies?: Array<Record<string, unknown>>;
}

export interface IcpCoachPhase3Triggers {
  triggers?: string[] | string;
  dataSources?: Array<Record<string, unknown>> | Record<string, unknown>;
}

export interface IcpCoachProfilePhases {
  phase1?: IcpCoachPhase1ValueProp;
  phase2?: IcpCoachPhase2Icp;
  phase3?: IcpCoachPhase3Triggers;
}

export interface IcpCoachProfilePayload {
  name: string;
  description?: string;
  companyCriteria: Record<string, unknown>;
  personaCriteria: Record<string, unknown>;
  triggers?: unknown;
  dataSources?: unknown;
  phases?: IcpCoachProfilePhases;
}

export interface IcpCoachHypothesisInput {
  icpProfileId: string;
  icpDescription?: string;
  /**
   * Optional identifier of the coach prompt variant used for this run.
   */
  promptId?: string;
  /**
   * Optional free-form user message for the hypothesis coach.
   */
  userPrompt?: string;
  /**
   * Optional override for the base system prompt text.
   */
  promptTextOverride?: string;
}

export interface IcpCoachPhase4Offers {
  offers?: Array<{
    personaRole: string;
    context?: string;
    offer: string;
  }>;
}

export interface IcpCoachPhase5Critiques {
  critiques?: Array<{
    offerIndex: number;
    roast: string;
    suggestion: string;
  }>;
}

export interface IcpCoachHypothesisPhases {
  phase4?: IcpCoachPhase4Offers;
  phase5?: IcpCoachPhase5Critiques;
}

export interface IcpCoachHypothesisPayload {
  hypothesisLabel: string;
  searchConfig: {
    [key: string]: unknown;
    phases?: IcpCoachHypothesisPhases;
  };
}

let cachedPrompt: string | null = null;

export async function loadIcpCoachPrompt(): Promise<string> {
  if (cachedPrompt) return cachedPrompt;
  const filename = fileURLToPath(import.meta.url);
  const dir = dirname(filename);
  const promptPath = join(dir, '../../prompts/ICP_Persona_Reseach_Coach_v1_0.md');
  const contents = await readFile(promptPath, 'utf8');
  cachedPrompt = contents;
  return contents;
}

export function buildIcpCoachSystemPrompt(basePrompt: string): string {
  const header =
    'You are running in EXPRESS JSON MODE for ICP coaching.\n' +
    'Run phases 1–3 internally. Do NOT ask the user any questions.\n' +
    'Return ONLY a valid JSON object with keys { name, description, companyCriteria, personaCriteria, triggers, dataSources }.\n\n';
  return `${header}${basePrompt}`;
}

function buildProfileMessages(prompt: string, input: IcpCoachProfileInput): ChatMessage[] {
  const system: ChatMessage = {
    role: 'system',
    content: prompt,
  };

  const userParts = [
    `ICP profile name: ${input.name}`,
    input.description ? `Description: ${input.description}` : null,
    input.websiteUrl ? `Website URL: ${input.websiteUrl}` : null,
    input.valueProp ? `Value proposition: ${input.valueProp}` : null,
  ].filter(Boolean) as string[];

  const user: ChatMessage = {
    role: 'user',
    content: userParts.join('\n'),
  };

  return [system, user];
}

function buildHypothesisMessages(prompt: string, input: IcpCoachHypothesisInput): ChatMessage[] {
  const system: ChatMessage = {
    role: 'system',
    content: prompt,
  };

  const userLines = [
    `ICP profile id: ${input.icpProfileId}`,
    input.icpDescription ? `ICP description: ${input.icpDescription}` : null,
    'Generate a single JSON object with { hypothesisLabel, searchConfig } only.',
  ].filter(Boolean) as string[];

  const user: ChatMessage = {
    role: 'user',
    content: userLines.join('\n'),
  };

  return [system, user];
}

function parseJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('ICP coach returned non-JSON response');
  }
}

function validateProfilePayload(obj: any, fallbackName: string): IcpCoachProfilePayload {
  const name = typeof obj.name === 'string' && obj.name.trim().length > 0 ? obj.name : fallbackName;
  const companyCriteria = obj.companyCriteria;
  const personaCriteria = obj.personaCriteria;

  if (!companyCriteria || typeof companyCriteria !== 'object') {
    throw new Error('ICP coach returned payload missing companyCriteria');
  }
  if (!personaCriteria || typeof personaCriteria !== 'object') {
    throw new Error('ICP coach returned payload missing personaCriteria');
  }

  const payload: IcpCoachProfilePayload = {
    name,
    description: typeof obj.description === 'string' ? obj.description : undefined,
    companyCriteria: companyCriteria as Record<string, unknown>,
    personaCriteria: personaCriteria as Record<string, unknown>,
  };

  if ('triggers' in obj) {
    payload.triggers = obj.triggers;
  }
  if ('dataSources' in obj) {
    payload.dataSources = obj.dataSources;
  }

  if (obj.phases && typeof obj.phases === 'object') {
    payload.phases = obj.phases as IcpCoachProfilePhases;
  }

  return payload;
}

function validateHypothesisPayload(obj: any): IcpCoachHypothesisPayload {
  if (!obj || typeof obj !== 'object') {
    throw new Error('ICP coach returned invalid hypothesis payload');
  }
  if (typeof obj.hypothesisLabel !== 'string' || obj.hypothesisLabel.trim().length === 0) {
    throw new Error('ICP coach returned payload missing hypothesisLabel');
  }
  if (!obj.searchConfig || typeof obj.searchConfig !== 'object') {
    throw new Error('ICP coach returned payload missing searchConfig');
  }
  return {
    hypothesisLabel: obj.hypothesisLabel,
    searchConfig: obj.searchConfig as {
      [key: string]: unknown;
      phases?: IcpCoachHypothesisPhases;
    },
  };
}

export async function runIcpCoachProfileLlm(
  chatClient: ChatClient,
  input: IcpCoachProfileInput
): Promise<IcpCoachProfilePayload> {
  const basePrompt = input.promptTextOverride ?? (await loadIcpCoachPrompt());
  const systemPrompt = buildIcpCoachSystemPrompt(basePrompt);
  const messages: ChatMessage[] =
    input.userPrompt && input.userPrompt.trim().length > 0
      ? [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: input.userPrompt },
        ]
      : buildProfileMessages(systemPrompt, input);
  const raw = await chatClient.complete(messages);
  const obj = parseJson(raw);
  return validateProfilePayload(obj, input.name);
}

export async function runIcpCoachHypothesisLlm(
  chatClient: ChatClient,
  input: IcpCoachHypothesisInput
): Promise<IcpCoachHypothesisPayload> {
  const basePrompt = input.promptTextOverride ?? (await loadIcpCoachPrompt());
  const systemPrompt = buildIcpCoachSystemPrompt(basePrompt);
  const messages: ChatMessage[] =
    input.userPrompt && input.userPrompt.trim().length > 0
      ? [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: input.userPrompt },
        ]
      : buildHypothesisMessages(systemPrompt, input);
  const raw = await chatClient.complete(messages);
  const obj = parseJson(raw);
  return validateHypothesisPayload(obj);
}

// Segment Filter Generation via Coach

export interface FilterSuggestionRequest {
  userDescription: string;
  icpProfileId?: string;
  icpContext?: string;
  maxSuggestions?: number;
}

export interface FilterSuggestion {
  filters: Array<{ field: string; operator: string; value: unknown }>;
  rationale?: string;
  targetAudience?: string;
}

function buildFilterGenerationSystemPrompt(): string {
  const prompt = `You are an AI assistant that helps generate segment filter configurations for B2B sales targeting.

# Your Task
Generate 1-3 filter configuration suggestions based on the user's description. Each suggestion should target a specific audience segment using database filters.

# Filter Rules
1. **Allowed field prefixes:**
   - employees.* (e.g., employees.role, employees.seniority, employees.department)
   - companies.* (e.g., companies.industry, companies.size, companies.region, companies.revenue)

2. **Allowed operators:**
   - eq: Exact match (for strings, numbers)
   - in: Value is in array (requires array value)
   - not_in: Value is not in array (requires array value)
   - gte: Greater than or equal (requires number value)
   - lte: Less than or equal (requires number value)

3. **Common field examples:**
   - employees.role: "CTO", "VP Engineering", "Head of Product"
   - employees.seniority: "C-Level", "VP", "Director", "Manager"
   - employees.department: "Engineering", "Sales", "Marketing", "Product"
   - companies.industry: "SaaS", "FinTech", "HealthTech", "E-commerce"
   - companies.size: "Enterprise", "Mid-Market", "SMB"
   - companies.employee_count: 100, 500, 1000 (numeric)
   - companies.region: "North America", "EMEA", "APAC"

# Output Format
Return ONLY a valid JSON object with this structure:
{
  "suggestions": [
    {
      "filters": [
        {"field": "employees.role", "operator": "in", "value": ["CTO", "VP Engineering"]},
        {"field": "companies.employee_count", "operator": "gte", "value": 100}
      ],
      "rationale": "Brief explanation of why this targeting makes sense",
      "targetAudience": "Brief description of who this targets"
    }
  ]
}

# Guidelines
- Generate 1-3 diverse suggestions with different targeting strategies
- Each suggestion should have 1-5 filters
- Combine employee and company filters for precision
- Provide clear rationale for each suggestion
- Ensure all filters use valid fields and operators
- Use realistic values based on B2B sales context

Return ONLY the JSON object, no additional text.`;

  return prompt;
}

function buildFilterGenerationMessages(request: FilterSuggestionRequest): ChatMessage[] {
  const system: ChatMessage = {
    role: 'system',
    content: buildFilterGenerationSystemPrompt(),
  };

  const userParts = [`User description: ${request.userDescription}`];

  if (request.icpContext) {
    userParts.push(`\nICP context: ${request.icpContext}`);
  }

  if (request.maxSuggestions) {
    userParts.push(`\nGenerate exactly ${request.maxSuggestions} suggestion(s).`);
  }

  const user: ChatMessage = {
    role: 'user',
    content: userParts.join('\n'),
  };

  return [system, user];
}

function validateFilterSuggestions(obj: any, maxSuggestions?: number): FilterSuggestion[] {
  if (!obj || typeof obj !== 'object') {
    throw new Error('Filter coach returned invalid response structure');
  }

  if (!Array.isArray(obj.suggestions) || obj.suggestions.length === 0) {
    throw new Error('Filter coach returned no suggestions');
  }

  const suggestions: FilterSuggestion[] = [];

  for (const [idx, suggestion] of obj.suggestions.entries()) {
    if (!suggestion || typeof suggestion !== 'object') {
      throw new Error(`Invalid suggestion at index ${idx}`);
    }

    if (!Array.isArray(suggestion.filters) || suggestion.filters.length === 0) {
      throw new Error(`Suggestion at index ${idx} has no filters`);
    }

    // Validate each filter clause
    for (const [filterIdx, filter] of suggestion.filters.entries()) {
      if (
        !filter ||
        typeof filter !== 'object' ||
        typeof filter.field !== 'string' ||
        typeof filter.operator !== 'string'
      ) {
        throw new Error(`Invalid filter at suggestion ${idx}, filter ${filterIdx}`);
      }

      // Validate field prefix
      const validPrefixes = ['employees.', 'companies.'];
      const hasValidPrefix = validPrefixes.some((prefix) => filter.field.startsWith(prefix));
      if (!hasValidPrefix) {
        throw new Error(
          `Invalid field "${filter.field}" at suggestion ${idx}, filter ${filterIdx}. Must start with employees. or companies.`
        );
      }

      // Validate operator
      const validOps = ['eq', 'in', 'not_in', 'gte', 'lte'];
      if (!validOps.includes(filter.operator)) {
        throw new Error(
          `Invalid operator "${filter.operator}" at suggestion ${idx}, filter ${filterIdx}`
        );
      }

      // Validate value types for specific operators
      if ((filter.operator === 'in' || filter.operator === 'not_in') && !Array.isArray(filter.value)) {
        throw new Error(
          `Operator "${filter.operator}" requires array value at suggestion ${idx}, filter ${filterIdx}`
        );
      }

      if ((filter.operator === 'gte' || filter.operator === 'lte') && typeof filter.value !== 'number') {
        throw new Error(
          `Operator "${filter.operator}" requires numeric value at suggestion ${idx}, filter ${filterIdx}`
        );
      }
    }

    suggestions.push({
      filters: suggestion.filters,
      rationale: typeof suggestion.rationale === 'string' ? suggestion.rationale : undefined,
      targetAudience: typeof suggestion.targetAudience === 'string' ? suggestion.targetAudience : undefined,
    });
  }

  // Respect maxSuggestions if provided
  if (maxSuggestions && maxSuggestions > 0) {
    return suggestions.slice(0, maxSuggestions);
  }

  return suggestions;
}

export async function generateSegmentFiltersViaCoach(
  chatClient: ChatClient,
  request: FilterSuggestionRequest
): Promise<FilterSuggestion[]> {
  const messages = buildFilterGenerationMessages(request);
  const raw = await chatClient.complete(messages);
  const obj = parseJson(raw);
  return validateFilterSuggestions(obj, request.maxSuggestions);
}
