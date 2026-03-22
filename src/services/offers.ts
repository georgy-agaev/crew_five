import type { SupabaseClient } from '@supabase/supabase-js';

export type OfferStatus = 'active' | 'inactive';

export interface OfferRecord {
  id: string;
  project_id: string | null;
  title: string;
  project_name: string | null;
  description: string | null;
  status: OfferStatus;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface OfferInput {
  projectId?: string | null;
  title: string;
  projectName?: string | null;
  description?: string | null;
  status?: OfferStatus;
}

export interface OfferUpdateInput {
  projectId?: string | null;
  title?: string;
  projectName?: string | null;
  description?: string | null;
  status?: OfferStatus;
}

export interface ListOffersOptions {
  status?: OfferStatus;
}

const OFFER_SELECT = 'id,project_id,title,project_name,description,status,created_at,updated_at';

export async function createOffer(client: SupabaseClient, input: OfferInput): Promise<OfferRecord> {
  const { data, error } = await client
    .from('offers')
    .insert([
      {
        project_id: input.projectId ?? null,
        title: input.title,
        project_name: input.projectName ?? null,
        description: input.description ?? null,
        status: input.status ?? 'active',
      },
    ])
    .select()
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to create offer');
  }

  return data as OfferRecord;
}

export async function listOffers(
  client: SupabaseClient,
  options: ListOffersOptions = {}
): Promise<OfferRecord[]> {
  let query: any = client.from('offers').select(OFFER_SELECT).order('created_at', { ascending: false });
  if (options.status) {
    query = query.eq('status', options.status);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return (data ?? []) as OfferRecord[];
}

export async function getOffer(client: SupabaseClient, offerId: string): Promise<OfferRecord> {
  const { data, error } = await client.from('offers').select(OFFER_SELECT).eq('id', offerId).single();

  if (error || !data) {
    throw error ?? new Error('Offer not found');
  }

  return data as OfferRecord;
}

export async function updateOffer(
  client: SupabaseClient,
  offerId: string,
  input: OfferUpdateInput
): Promise<OfferRecord> {
  const patch: Record<string, unknown> = {};
  if (input.projectId !== undefined) patch.project_id = input.projectId;
  if (input.title !== undefined) patch.title = input.title;
  if (input.projectName !== undefined) patch.project_name = input.projectName;
  if (input.description !== undefined) patch.description = input.description;
  if (input.status !== undefined) patch.status = input.status;

  if (Object.keys(patch).length === 0) {
    throw new Error('No updatable fields provided');
  }

  const { data, error } = await client
    .from('offers')
    .update(patch)
    .eq('id', offerId)
    .select()
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to update offer');
  }

  return data as OfferRecord;
}
