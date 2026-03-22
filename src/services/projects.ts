import type { SupabaseClient } from '@supabase/supabase-js';

export type ProjectStatus = 'active' | 'inactive';

export interface ProjectRecord {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ProjectInput {
  key: string;
  name: string;
  description?: string | null;
  status?: ProjectStatus;
}

export interface ProjectUpdateInput {
  name?: string;
  description?: string | null;
  status?: ProjectStatus;
}

export interface ListProjectsOptions {
  status?: ProjectStatus;
}

const PROJECT_SELECT = 'id,key,name,description,status,created_at,updated_at';

export async function createProject(client: SupabaseClient, input: ProjectInput): Promise<ProjectRecord> {
  const { data, error } = await client
    .from('projects')
    .insert([
      {
        key: input.key,
        name: input.name,
        description: input.description ?? null,
        status: input.status ?? 'active',
      },
    ])
    .select()
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to create project');
  }

  return data as ProjectRecord;
}

export async function listProjects(
  client: SupabaseClient,
  options: ListProjectsOptions = {}
): Promise<ProjectRecord[]> {
  let query: any = client.from('projects').select(PROJECT_SELECT).order('created_at', { ascending: false });
  if (options.status) {
    query = query.eq('status', options.status);
  }
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return (data ?? []) as ProjectRecord[];
}

export async function updateProject(
  client: SupabaseClient,
  projectId: string,
  input: ProjectUpdateInput
): Promise<ProjectRecord> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.status !== undefined) patch.status = input.status;

  if (Object.keys(patch).length === 0) {
    throw new Error('No updatable fields provided');
  }

  const { data, error } = await client
    .from('projects')
    .update(patch)
    .eq('id', projectId)
    .select()
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to update project');
  }

  return data as ProjectRecord;
}
