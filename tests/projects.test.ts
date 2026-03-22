import { describe, expect, it, vi } from 'vitest';

import { createProject, listProjects, updateProject } from '../src/services/projects';

describe('projects service', () => {
  it('creates an active project by default', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'project-1',
        key: 'voicexpert',
        name: 'VoiceXpert',
        description: 'Core outbound workspace',
        status: 'active',
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const client = {
      from: vi.fn().mockReturnValue({ insert }),
    } as any;

    const result = await createProject(client, {
      key: 'voicexpert',
      name: 'VoiceXpert',
      description: 'Core outbound workspace',
    });

    expect(client.from).toHaveBeenCalledWith('projects');
    expect(insert).toHaveBeenCalledWith([
      {
        key: 'voicexpert',
        name: 'VoiceXpert',
        description: 'Core outbound workspace',
        status: 'active',
      },
    ]);
    expect(result.id).toBe('project-1');
  });

  it('lists active projects newest first', async () => {
    const statusEq = vi.fn().mockResolvedValue({
      data: [{ id: 'project-1', key: 'voicexpert', name: 'VoiceXpert', status: 'active' }],
      error: null,
    });
    const order = vi.fn().mockReturnValue({ eq: statusEq });
    const select = vi.fn().mockReturnValue({ order });
    const client = {
      from: vi.fn().mockReturnValue({ select }),
    } as any;

    const result = await listProjects(client, { status: 'active' });

    expect(select).toHaveBeenCalledWith('id,key,name,description,status,created_at,updated_at');
    expect(statusEq).toHaveBeenCalledWith('status', 'active');
    expect(result[0].key).toBe('voicexpert');
  });

  it('updates an existing project', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'project-1',
        key: 'voicexpert',
        name: 'VoiceXpert Core',
        description: 'Updated description',
        status: 'inactive',
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    const client = {
      from: vi.fn().mockReturnValue({ update }),
    } as any;

    const result = await updateProject(client, 'project-1', {
      name: 'VoiceXpert Core',
      description: 'Updated description',
      status: 'inactive',
    });

    expect(update).toHaveBeenCalledWith({
      name: 'VoiceXpert Core',
      description: 'Updated description',
      status: 'inactive',
    });
    expect(result.status).toBe('inactive');
  });
});
