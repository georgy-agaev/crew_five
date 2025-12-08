import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ChatClient, ChatMessage } from './chatClient';

export interface IcpCoachProfileInput {
  name: string;
  description?: string;
  websiteUrl?: string;
  valueProp?: string;
}

export interface IcpCoachProfilePayload {
  name: string;
  description?: string;
  companyCriteria: Record<string, unknown>;
  personaCriteria: Record<string, unknown>;
  triggers?: unknown;
  dataSources?: unknown;
}

export interface IcpCoachHypothesisInput {
  icpProfileId: string;
  icpDescription?: string;
}

export interface IcpCoachHypothesisPayload {
  hypothesisLabel: string;
  searchConfig: Record<string, unknown>;
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
    searchConfig: obj.searchConfig as Record<string, unknown>,
  };
}

export async function runIcpCoachProfileLlm(
  chatClient: ChatClient,
  input: IcpCoachProfileInput
): Promise<IcpCoachProfilePayload> {
  const basePrompt = await loadIcpCoachPrompt();
  const systemPrompt = buildIcpCoachSystemPrompt(basePrompt);
  const messages = buildProfileMessages(systemPrompt, input);
  const raw = await chatClient.complete(messages);
  const obj = parseJson(raw);
  return validateProfilePayload(obj, input.name);
}

export async function runIcpCoachHypothesisLlm(
  chatClient: ChatClient,
  input: IcpCoachHypothesisInput
): Promise<IcpCoachHypothesisPayload> {
  const basePrompt = await loadIcpCoachPrompt();
  const systemPrompt = buildIcpCoachSystemPrompt(basePrompt);
  const messages = buildHypothesisMessages(systemPrompt, input);
  const raw = await chatClient.complete(messages);
  const obj = parseJson(raw);
  return validateHypothesisPayload(obj);
}

