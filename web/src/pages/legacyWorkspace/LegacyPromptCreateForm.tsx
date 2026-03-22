import type { LegacyWorkspaceColors, PromptRegistryCreateFormState } from './legacyWorkspaceTypes';

type PromptCreateField = keyof Pick<
  PromptRegistryCreateFormState,
  'id' | 'version' | 'rollout_status' | 'description' | 'prompt_text'
>;

type LegacyPromptCreateFormProps = {
  colors: LegacyWorkspaceColors;
  copy: {
    promptId: string;
    version: string;
    status: string;
    description: string;
    promptText: string;
  };
  form: PromptRegistryCreateFormState;
  loading: boolean;
  onDismiss: () => void;
  onFieldChange: (field: PromptCreateField, value: string) => void;
  onSave: () => void | Promise<void>;
};

export function LegacyPromptCreateForm({
  colors,
  copy,
  form,
  loading,
  onDismiss,
  onFieldChange,
  onSave,
}: LegacyPromptCreateFormProps) {
  const saveDisabled = loading || !form.id.trim();

  return (
    <div
      style={{
        marginBottom: '24px',
        marginTop: '8px',
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: '12px',
        padding: '16px 20px',
        display: 'grid',
        gap: '12px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: '14px', fontWeight: 600, color: colors.text }}>New prompt entry</div>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: '12px',
            color: colors.textMuted,
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Cancel
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr',
          gap: '12px',
          alignItems: 'center',
        }}
      >
        <div>
          <FieldLabel colors={colors} label={copy.promptId} />
          <input
            placeholder="icp_profile_v1"
            value={form.id}
            onChange={(event) => onFieldChange('id', event.target.value)}
            style={inputStyle(colors)}
          />
        </div>
        <div>
          <FieldLabel colors={colors} label={copy.version} />
          <input
            placeholder="v1"
            value={form.version}
            onChange={(event) => onFieldChange('version', event.target.value)}
            style={inputStyle(colors)}
          />
        </div>
        <div>
          <FieldLabel colors={colors} label={copy.status} />
          <select
            value={form.rollout_status}
            onChange={(event) => onFieldChange('rollout_status', event.target.value)}
            style={inputStyle(colors)}
          >
            <option value="pilot">Pilot</option>
            <option value="active">Active</option>
            <option value="retired">Retired</option>
          </select>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '3fr 1fr',
          gap: '12px',
          alignItems: 'flex-end',
        }}
      >
        <div>
          <FieldLabel colors={colors} label={copy.description} />
          <input
            placeholder="Short description"
            value={form.description}
            onChange={(event) => onFieldChange('description', event.target.value)}
            style={inputStyle(colors)}
          />
        </div>
        <div>
          <FieldLabel colors={colors} label={copy.promptText} />
          <textarea
            placeholder="Optional variant text; scaffold is fixed"
            value={form.prompt_text}
            onChange={(event) => onFieldChange('prompt_text', event.target.value)}
            rows={2}
            style={{
              ...inputStyle(colors),
              resize: 'vertical',
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
        <button
          type="button"
          disabled={saveDisabled}
          onClick={() => void onSave()}
          style={{
            background: colors.orange,
            color: '#FFF',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 18px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: saveDisabled ? 'not-allowed' : 'pointer',
            opacity: saveDisabled ? 0.6 : 1,
          }}
        >
          {loading ? 'Saving…' : 'Save prompt'}
        </button>
      </div>
    </div>
  );
}

function FieldLabel({
  colors,
  label,
}: {
  colors: LegacyWorkspaceColors;
  label: string;
}) {
  return (
    <div
      style={{
        fontSize: '12px',
        fontWeight: 600,
        color: colors.textMuted,
        marginBottom: '4px',
      }}
    >
      {label}
    </div>
  );
}

function inputStyle(colors: LegacyWorkspaceColors) {
  return {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '8px',
    border: `1px solid ${colors.border}`,
    background: colors.sidebar,
    color: colors.text,
    fontSize: '13px',
  };
}
