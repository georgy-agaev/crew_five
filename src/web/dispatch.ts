import type { AdapterDeps, DispatchRequest, DispatchResponse, MetaStatus } from './types.js';
import { handleAnalyticsRoutes } from './routes/analyticsRoutes.js';
import { handleCampaignRoutes } from './routes/campaignRoutes.js';
import { handleDirectoryRoutes } from './routes/directoryRoutes.js';
import { handleIcpRoutes } from './routes/icpRoutes.js';
import { handleImportRoutes } from './routes/importRoutes.js';
import { handleMailboxRoutes } from './routes/mailboxRoutes.js';
import { handleOfferRoutes } from './routes/offerRoutes.js';
import { handleProjectRoutes } from './routes/projectRoutes.js';
import { handlePromptRoutes } from './routes/promptRoutes.js';
import { handleSegmentRoutes } from './routes/segmentRoutes.js';
import { handleSystemRoutes } from './routes/systemRoutes.js';

const routeHandlers = [
  handleCampaignRoutes,
  handleMailboxRoutes,
  handleProjectRoutes,
  handleOfferRoutes,
  handleDirectoryRoutes,
  handleImportRoutes,
  handleSegmentRoutes,
  handleIcpRoutes,
  handleAnalyticsRoutes,
  handlePromptRoutes,
  handleSystemRoutes,
] as const;

export async function dispatch(
  deps: AdapterDeps,
  req: DispatchRequest,
  meta?: MetaStatus
): Promise<DispatchResponse> {
  for (const handleRoute of routeHandlers) {
    const response = await handleRoute(deps, req, meta);
    if (response) {
      return response;
    }
  }
  return { status: 404, body: { error: 'Not found' } };
}
