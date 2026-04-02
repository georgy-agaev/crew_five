import { useState } from 'react';
import { triggerDraftGenerate } from '../apiClient';

const translations: Record<string, Record<string, string>> = {
  en: {
    title: 'Draft generation',
    preview: 'Check',
    confirm: 'Generate',
    cancel: 'Cancel',
    running: 'Running...',
    generated: 'generated',
    skipped: 'skipped',
    failed: 'failed',
    done: 'Done',
    selectCampaign: 'Select a campaign',
    batch: 'Batch',
    batchDefault: '20 = default',
    batchAll: '0 = all eligible',
  },
  ru: {
    title: 'Генерация писем',
    preview: 'Проверить',
    confirm: 'Запустить',
    cancel: 'Отмена',
    running: 'Запуск...',
    generated: 'генерировано',
    skipped: 'пропущено',
    failed: 'ошибок',
    done: 'Готово',
    selectCampaign: 'Выберите кампанию',
    batch: 'Пакет',
    batchDefault: '20 = по умолчанию',
    batchAll: '0 = все доступные',
  },
};

function getT(language: string) {
  return translations[language] ?? translations['en'];
}

function parseLimit(raw: string): number {
  const n = parseInt(raw, 10);
  if (Number.isNaN(n) || n < 0) return 20;
  return n;
}

type Phase = 'idle' | 'previewing' | 'previewed' | 'generating' | 'done';

export function CampaignDraftGenerateCard({
  campaignId,
  language = 'en',
}: {
  campaignId?: string;
  language?: string;
}) {
  const t = getT(language);
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<{ generated: number; skipped: number; failed: number; dryRun: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limitInput, setLimitInput] = useState('20');

  const limit = parseLimit(limitInput);

  if (!campaignId) {
    return (
      <div className="od-context-block" style={{ borderTop: '1px solid var(--od-border)' }}>
        <h3 className="od-context-block__title">{t.title}</h3>
        <span style={{ fontSize: 12, color: 'var(--od-text-muted)' }}>{t.selectCampaign}</span>
      </div>
    );
  }

  const handlePreview = async () => {
    setPhase('previewing');
    setError(null);
    try {
      const res = await triggerDraftGenerate(campaignId, { dryRun: true, limit });
      setResult({ generated: res.generated ?? 0, skipped: res.skipped ?? 0, failed: res.failed ?? 0, dryRun: true });
      setPhase('previewed');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Preview failed');
      setPhase('idle');
    }
  };

  const handleConfirm = async () => {
    setPhase('generating');
    setError(null);
    try {
      const res = await triggerDraftGenerate(campaignId, { dryRun: false, limit });
      setResult({ generated: res.generated ?? 0, skipped: res.skipped ?? 0, failed: res.failed ?? 0, dryRun: false });
      setPhase('done');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setPhase('previewed');
    }
  };

  const handleReset = () => {
    setPhase('idle');
    setResult(null);
    setError(null);
  };

  const busy = phase === 'previewing' || phase === 'generating';

  return (
    <div className="od-context-block" style={{ borderTop: '1px solid var(--od-border)' }}>
      <h3 className="od-context-block__title">{t.title}</h3>

      {error && (
        <div style={{ fontSize: 11, color: 'var(--od-error)', marginBottom: 6 }}>{error}</div>
      )}

      {/* Batch size */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--od-text-muted)' }}>{t.batch}</span>
        <input
          type="number"
          min={0}
          step={1}
          value={limitInput}
          onChange={(e) => setLimitInput(e.target.value)}
          onBlur={() => setLimitInput(String(limit))}
          disabled={busy}
          style={{
            width: 52,
            fontSize: 12,
            padding: '3px 6px',
            borderRadius: 4,
            border: '1px solid var(--od-border)',
            background: 'var(--od-card)',
            color: 'var(--od-text)',
            textAlign: 'center',
          }}
        />
        <span style={{ fontSize: 9, color: 'var(--od-text-muted)' }}>
          {limit === 0 ? t.batchAll : limit === 20 ? t.batchDefault : `${limit} companies`}
        </span>
      </div>

      {/* Result chips */}
      {result && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
          <span className="od-count-chip" style={{ fontSize: 10, color: result.generated > 0 ? 'var(--od-success)' : 'var(--od-text-muted)' }}>
            {result.generated} {t.generated}
          </span>
          {result.skipped > 0 && (
            <span className="od-count-chip" style={{ fontSize: 10, color: 'var(--od-text-muted)' }}>
              {result.skipped} {t.skipped}
            </span>
          )}
          {result.failed > 0 && (
            <span className="od-count-chip" style={{ fontSize: 10, color: 'var(--od-error)' }}>
              {result.failed} {t.failed}
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6 }}>
        {phase === 'idle' && (
          <button type="button" className="od-btn" style={{ fontSize: 11, padding: '4px 12px', background: 'color-mix(in srgb, var(--od-warning) 12%, transparent)', color: 'var(--od-warning)', border: '1px solid var(--od-warning)' }} onClick={handlePreview}>
            {t.preview}
          </button>
        )}
        {busy && (
          <span style={{ fontSize: 11, color: 'var(--od-text-muted)' }}>{t.running}</span>
        )}
        {phase === 'previewed' && (
          <>
            <button type="button" className="od-btn od-btn--approve" style={{ fontSize: 11, padding: '4px 12px' }} onClick={handleConfirm}>
              {t.confirm}
            </button>
            <button type="button" className="od-btn od-btn--ghost" style={{ fontSize: 11, padding: '4px 12px' }} onClick={handleReset}>
              {t.cancel}
            </button>
          </>
        )}
        {phase === 'done' && (
          <button type="button" className="od-btn od-btn--ghost" style={{ fontSize: 11, padding: '4px 12px' }} onClick={handleReset}>
            {t.done}
          </button>
        )}
      </div>
    </div>
  );
}
