import type { SmartleadMcpClient } from '../integrations/smartleadMcp.js';
import { buildSmartleadMcpClient } from '../integrations/smartleadMcp.js';

export function buildSmartleadClientFromEnv(): SmartleadMcpClient {
  const url = process.env.SMARTLEAD_API_BASE ?? process.env.SMARTLEAD_MCP_URL;
  const token = process.env.SMARTLEAD_API_KEY ?? process.env.SMARTLEAD_MCP_TOKEN;
  const workspaceId = process.env.SMARTLEAD_WORKSPACE_ID ?? process.env.SMARTLEAD_MCP_WORKSPACE_ID;
  if (!url || !token) {
    throw new Error('SMARTLEAD_MCP_URL and SMARTLEAD_MCP_TOKEN are required for live adapter');
  }
  const client = buildSmartleadMcpClient({ url, token, workspaceId });
  return {
    ...client,
    sendEmail: async () => ({ provider_message_id: 'mock-id' }),
  };
}
