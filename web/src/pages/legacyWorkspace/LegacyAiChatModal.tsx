import type { LegacyWorkspaceColors } from './legacyWorkspaceTypes';

type TranscriptMessage = {
  role?: string;
  text?: string;
};

type LegacyAiChatModalProps = {
  aiError: string | null;
  aiLoading: boolean;
  aiMessage: string;
  aiTranscript: TranscriptMessage[];
  colors: LegacyWorkspaceColors;
  copy: {
    title: string;
    greeting: string;
    greeting2: string;
    placeholder: string;
    send: string;
  };
  currentStep: string;
  onClose: () => void;
  onMessageChange: (value: string) => void;
  onSend: () => void | Promise<void>;
};

export function LegacyAiChatModal({
  aiError,
  aiLoading,
  aiMessage,
  aiTranscript,
  colors,
  copy,
  currentStep,
  onClose,
  onMessageChange,
  onSend,
}: LegacyAiChatModalProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: colors.card,
          borderRadius: '16px',
          width: '90%',
          maxWidth: '600px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '24px', borderBottom: `1px solid ${colors.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700 }}>{copy.title}</h3>
            <button onClick={onClose} style={closeButtonStyle(colors)}>
              ×
            </button>
          </div>
        </div>

        <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
          <div
            style={{
              background: colors.sidebar,
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px',
            }}
          >
            <p style={{ fontSize: '14px', lineHeight: '1.6', color: colors.text }}>
              {copy.greeting}{' '}
              <span style={{ fontWeight: 600, color: colors.orange }}>{currentStep}</span>.{' '}
              {copy.greeting2}
            </p>
          </div>

          {aiTranscript.length > 0 ? (
            <div
              style={{
                marginBottom: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {aiTranscript.map((message, index) => {
                const isUser = message.role === 'user';
                return (
                  <div
                    key={`${message.role ?? 'assistant'}-${index}`}
                    style={{
                      alignSelf: isUser ? 'flex-end' : 'flex-start',
                      maxWidth: '80%',
                      padding: '8px 12px',
                      borderRadius: '12px',
                      background: isUser ? colors.orange : colors.sidebar,
                      color: isUser ? '#FFF' : colors.text,
                      fontSize: '13px',
                      lineHeight: '1.5',
                    }}
                  >
                    {message.text}
                  </div>
                );
              })}
            </div>
          ) : null}

          {aiError ? (
            <div
              style={{
                marginBottom: '12px',
                fontSize: '12px',
                color: colors.error,
              }}
            >
              {aiError}
            </div>
          ) : null}
        </div>

        <div style={{ padding: '24px', borderTop: `1px solid ${colors.border}` }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              type="text"
              placeholder={copy.placeholder}
              style={{
                flex: 1,
                background: colors.sidebar,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                padding: '12px 16px',
                fontSize: '14px',
                color: colors.text,
                outline: 'none',
              }}
              value={aiMessage}
              onChange={(event) => onMessageChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !aiLoading) {
                  event.preventDefault();
                  void onSend();
                }
              }}
            />
            <button
              onClick={() => void onSend()}
              style={{
                background: colors.orange,
                color: '#FFF',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              disabled={aiLoading}
            >
              {aiLoading ? '…' : copy.send}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function closeButtonStyle(colors: LegacyWorkspaceColors) {
  return {
    background: 'none',
    border: 'none',
    color: colors.textMuted,
    fontSize: '24px',
    cursor: 'pointer',
    padding: '0',
    width: '32px',
    height: '32px',
  } as const;
}
