export type AppView =
  | 'pipeline'
  | 'icp-discovery'
  | 'campaigns'
  | 'builder-v2'
  | 'inbox-v2'
  | 'contacts'
  | 'mailboxes'
  | 'enrichment'
  | 'import'
  | 'home'
  | 'campaign-ops'
  | 'campaign-ledger';

export function resolveViewFromLocation(loc?: Location | URL): AppView {
  if (!loc) return 'home';
  const search = loc.search ?? '';
  if (!search) return 'home';
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const view = params.get('view');
  if (view === 'pipeline') return 'pipeline';
  if (view === 'icp-discovery') return 'icp-discovery';
  if (view === 'campaign-ops') return 'campaign-ops';
  if (view === 'campaign-ledger') return 'campaign-ledger';
  if (view === 'campaigns') return 'campaigns';
  if (view === 'builder-v2') return 'builder-v2';
  if (view === 'inbox-v2') return 'inbox-v2';
  if (view === 'contacts') return 'contacts';
  if (view === 'mailboxes') return 'mailboxes';
  if (view === 'enrichment') return 'enrichment';
  if (view === 'import') return 'import';
  if (view === 'home') return 'home';
  return 'home';
}
