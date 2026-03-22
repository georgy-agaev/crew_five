import type { LegacyWorkspaceColors } from './legacyWorkspaceTypes';

type InboxFilter = 'unread' | 'all' | 'starred';

type LegacyInboxMessage = {
  id: string;
  subject?: string | null;
  category?: string | null;
  receivedAt?: string | null;
  read?: boolean | null;
};

type LegacyInboxCopy = {
  title: string;
  subtitle: string;
  unread: string;
  all: string;
  starred: string;
  noMessages: string;
  noMessagesDesc: string;
};

type LegacyInboxPageProps = {
  colors: LegacyWorkspaceColors & { error: string };
  filter: InboxFilter;
  messages: LegacyInboxMessage[];
  loading: boolean;
  error: string | null;
  copy: LegacyInboxCopy;
  onFilterChange: (filter: InboxFilter) => void;
};

export function LegacyInboxPage({
  colors,
  filter,
  messages,
  loading,
  error,
  copy,
  onFilterChange,
}: LegacyInboxPageProps) {
  return (
    <div style={{ padding: '40px', maxWidth: '1200px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>{copy.title}</h1>
        <p style={{ fontSize: '14px', color: colors.textMuted }}>{copy.subtitle}</p>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <InboxFilterButton
          active={filter === 'unread'}
          colors={colors}
          label={copy.unread}
          onClick={() => onFilterChange('unread')}
          primary
        />
        <InboxFilterButton
          active={filter === 'all'}
          colors={colors}
          label={copy.all}
          onClick={() => onFilterChange('all')}
        />
        <InboxFilterButton
          active={filter === 'starred'}
          colors={colors}
          label={copy.starred}
          onClick={() => onFilterChange('starred')}
        />
      </div>

      <div
        style={{
          background: colors.card,
          border: `1px solid ${colors.border}`,
          borderRadius: '12px',
          padding: '24px 24px 20px',
        }}
      >
        {loading ? (
          <div style={{ fontSize: '14px', color: colors.textMuted, textAlign: 'center' }}>
            Loading inbox…
          </div>
        ) : null}
        {!loading && error ? (
          <div style={{ fontSize: '14px', color: colors.error, textAlign: 'center' }}>{error}</div>
        ) : null}
        {!loading && !error && messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px' }}>
            <div
              style={{
                fontSize: '18px',
                fontWeight: 600,
                color: colors.textMuted,
                marginBottom: '8px',
              }}
            >
              {copy.noMessages}
            </div>
            <div style={{ fontSize: '14px', color: colors.textMuted }}>{copy.noMessagesDesc}</div>
          </div>
        ) : null}
        {!loading && !error && messages.length > 0 ? (
          <div style={{ display: 'grid', gap: '8px' }}>
            {messages.map((message) => (
              <div
                key={message.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: colors.sidebar,
                }}
              >
                <div style={{ maxWidth: '70%', overflow: 'hidden' }}>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: message.read ? 500 : 700,
                      color: colors.text,
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                    }}
                  >
                    {message.subject ?? '(no subject)'}
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: colors.textMuted,
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                    }}
                  >
                    {message.category ?? 'unlabeled'} · {message.receivedAt ?? ''}
                  </div>
                </div>
                {!message.read ? (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: colors.orange,
                      background: colors.orangeLight,
                      padding: '3px 8px',
                      borderRadius: '999px',
                    }}
                  >
                    New
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function InboxFilterButton({
  active,
  colors,
  label,
  onClick,
  primary = false,
}: {
  active: boolean;
  colors: LegacyWorkspaceColors;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      style={{
        background: active ? colors.orangeLight : colors.card,
        border: `${primary ? 2 : 1}px solid ${active ? colors.orange : colors.border}`,
        color: active ? colors.orange : colors.text,
        padding: '10px 20px',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: primary ? 600 : 500,
        cursor: 'pointer',
      }}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
