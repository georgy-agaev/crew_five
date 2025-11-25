import './index.css';
import { useState } from 'react';

import { CampaignsPage } from './pages/CampaignsPage';
import { DraftsPage } from './pages/DraftsPage';
import { SendPage } from './pages/SendPage';
import { EventsPage } from './pages/EventsPage';
import { SettingsPage } from './pages/SettingsPage';

function App() {
  const [view, setView] = useState<'campaigns' | 'drafts' | 'send' | 'events' | 'settings'>('campaigns');

  return (
    <main>
      <header>
        <h1>AI SDR GTM Web (Mock)</h1>
      </header>
      <nav style={{ marginBottom: 16 }}>
        <button onClick={() => setView('campaigns')}>Campaigns</button>
        <button onClick={() => setView('drafts')} style={{ marginLeft: 8 }}>
          Drafts
        </button>
        <button onClick={() => setView('send')} style={{ marginLeft: 8 }}>
          Send
        </button>
        <button onClick={() => setView('events')} style={{ marginLeft: 8 }}>
          Events
        </button>
        <button onClick={() => setView('settings')} style={{ marginLeft: 8 }}>
          Settings
        </button>
      </nav>
      {view === 'campaigns' && <CampaignsPage />}
      {view === 'drafts' && <DraftsPage />}
      {view === 'send' && <SendPage />}
      {view === 'events' && <EventsPage />}
      {view === 'settings' && <SettingsPage />}
    </main>
  );
}

export default App;
