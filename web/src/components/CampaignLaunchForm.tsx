import { useState } from 'react';
import { createOffer, createProject, type CampaignLaunchSenderAssignment, type MailboxRow, type OfferRecord, type ProjectRecord } from '../apiClient';

const translations: Record<string, Record<string, string>> = {
  en: {
    name: 'Campaign name',
    segment: 'Segment',
    snapshotMode: 'Snapshot mode',
    reuse: 'Reuse existing',
    refresh: 'Refresh',
    senderPlan: 'Sender plan',
    addSender: 'Add sender',
    removeSender: 'Remove',
    selectMailbox: 'Select mailbox...',
    preview: 'Preview launch',
    namePlaceholder: 'e.g. Q2 Outreach',
    offer: 'Offer',
    selectOffer: 'No offer selected',
    newOffer: 'New offer',
    offerTitle: 'Title',
    offerProject: 'Project name',
    offerDesc: 'Description',
    createOffer: 'Create',
    creating: 'Creating...',
    cancel: 'Cancel',
    sendPolicy: 'Send policy',
    timezone: 'Timezone',
    sendWindow: 'Send window',
    weekdaysOnly: 'Weekdays only',
    yes: 'Yes',
    no: 'No',
    policyNotSet: 'Set send policy before preview',
    confirmPolicy: 'Confirm policy',
    editPolicy: 'Edit',
    policyConfirmed: 'Confirmed',
  },
  ru: {
    name: 'Название кампании',
    segment: 'Сегмент',
    snapshotMode: 'Режим снимка',
    reuse: 'Использовать существующий',
    refresh: 'Обновить',
    senderPlan: 'Отправители',
    addSender: 'Добавить',
    removeSender: 'Убрать',
    selectMailbox: 'Выберите ящик...',
    preview: 'Предпросмотр',
    namePlaceholder: 'напр. Q2 Рассылка',
    offer: 'Оффер',
    selectOffer: 'Оффер не выбран',
    newOffer: 'Новый оффер',
    offerTitle: 'Название',
    offerProject: 'Проект',
    offerDesc: 'Описание',
    createOffer: 'Создать',
    creating: 'Создание...',
    cancel: 'Отмена',
    sendPolicy: 'Политика отправки',
    timezone: 'Часовой пояс',
    sendWindow: 'Окно отправки',
    weekdaysOnly: 'Только будни',
    yes: 'Да',
    no: 'Нет',
    policyNotSet: 'Укажите политику отправки',
    confirmPolicy: 'Подтвердить',
    editPolicy: 'Изменить',
    policyConfirmed: 'Подтверждено',
  },
};

function getT(language: string) {
  return translations[language] ?? translations['en'];
}

export interface CampaignLaunchFormValues {
  name: string;
  segmentId: string;
  segmentVersion?: number;
  snapshotMode: 'reuse' | 'refresh';
  senderAssignments: CampaignLaunchSenderAssignment[];
  projectId?: string;
  offerId?: string;
  icpHypothesisId?: string;
  sendTimezone: string;
  sendWindowStartHour: number;
  sendWindowEndHour: number;
  sendWeekdaysOnly: boolean;
}

export interface SendPolicyHint {
  sendTimezone?: string;
  sendWindowStartHour?: number;
  sendWindowEndHour?: number;
  sendWeekdaysOnly?: boolean;
}

interface SegmentOption {
  id: string;
  name?: string | null;
}

interface HypothesisOption {
  id: string;
  hypothesis_label?: string | null;
  offer_id?: string | null;
  messaging_angle?: string | null;
  status?: string | null;
}

export function CampaignLaunchForm({
  segments,
  mailboxes,
  offers,
  projects,
  hypotheses,
  initialSegmentId,
  sendPolicyHint,
  language = 'en',
  disabled = false,
  onPreview,
  onOffersRefresh,
  onProjectsRefresh,
}: {
  segments: SegmentOption[];
  mailboxes: MailboxRow[];
  hypotheses: HypothesisOption[];
  offers: OfferRecord[];
  projects: ProjectRecord[];
  initialSegmentId?: string;
  sendPolicyHint?: SendPolicyHint;
  language?: string;
  disabled?: boolean;
  onPreview: (values: CampaignLaunchFormValues) => void;
  onOffersRefresh?: () => void;
  onProjectsRefresh?: () => void;
}) {
  const t = getT(language);
  const [name, setName] = useState('');
  const [segmentId, setSegmentId] = useState(initialSegmentId ?? segments[0]?.id ?? '');
  const [snapshotMode, setSnapshotMode] = useState<'reuse' | 'refresh'>('reuse');
  const [senderAssignments, setSenderAssignments] = useState<CampaignLaunchSenderAssignment[]>([]);

  // Offer
  // Project
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectKey, setNewProjectKey] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);

  const handleCreateProject = async () => {
    if (!newProjectKey.trim() || !newProjectName.trim()) return;
    setCreatingProject(true);
    setProjectError(null);
    try {
      const created = await createProject({ key: newProjectKey.trim(), name: newProjectName.trim() });
      setSelectedProjectId(created.id);
      setShowNewProject(false);
      setNewProjectKey('');
      setNewProjectName('');
      onProjectsRefresh?.();
    } catch (err: unknown) {
      setProjectError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setCreatingProject(false);
    }
  };

  // Offer
  const [selectedOfferId, setSelectedOfferId] = useState('');
  const [selectedHypothesisId, setSelectedHypothesisId] = useState('');
  const [showNewOffer, setShowNewOffer] = useState(false);
  const [newOfferTitle, setNewOfferTitle] = useState('');
  const [newOfferProject, setNewOfferProject] = useState('');
  const [newOfferDesc, setNewOfferDesc] = useState('');
  const [creatingOffer, setCreatingOffer] = useState(false);
  const [offerError, setOfferError] = useState<string | null>(null);

  const handleCreateOffer = async () => {
    if (!newOfferTitle.trim()) return;
    setCreatingOffer(true);
    setOfferError(null);
    try {
      const created = await createOffer({
        title: newOfferTitle.trim(),
        projectName: newOfferProject.trim() || null,
        description: newOfferDesc.trim() || null,
      });
      setSelectedOfferId(created.id);
      setShowNewOffer(false);
      setNewOfferTitle('');
      setNewOfferProject('');
      setNewOfferDesc('');
      onOffersRefresh?.();
    } catch (err: unknown) {
      setOfferError(err instanceof Error ? err.message : 'Failed to create offer');
    } finally {
      setCreatingOffer(false);
    }
  };

  // Send policy: start empty unless hint provided. Require explicit confirmation.
  const hasHint = !!(sendPolicyHint?.sendTimezone);
  const [sendTimezone, setSendTimezone] = useState(sendPolicyHint?.sendTimezone ?? '');
  const [sendStartHour, setSendStartHour] = useState(sendPolicyHint?.sendWindowStartHour ?? 9);
  const [sendEndHour, setSendEndHour] = useState(sendPolicyHint?.sendWindowEndHour ?? 17);
  const [sendWeekdaysOnly, setSendWeekdaysOnly] = useState(sendPolicyHint?.sendWeekdaysOnly ?? true);
  const [policyConfirmed, setPolicyConfirmed] = useState(false);
  const [policyEditing, setPolicyEditing] = useState(!hasHint);
  const [policyValidationError, setPolicyValidationError] = useState<string | null>(null);

  const policyReady = policyConfirmed && sendTimezone.trim().length > 0;
  const canPreview = name.trim().length > 0 && segmentId.length > 0 && policyReady;

  const validatePolicy = (): string | null => {
    if (!sendTimezone.trim()) {
      return language === 'ru' ? 'Укажите часовой пояс' : 'Timezone is required';
    }
    if (!Number.isInteger(sendStartHour) || !Number.isInteger(sendEndHour) || sendStartHour < 0 || sendStartHour > 23 || sendEndHour < 1 || sendEndHour > 24) {
      return language === 'ru' ? 'Часы должны быть целыми числами' : 'Hours must be valid integers';
    }
    if (sendEndHour <= sendStartHour) {
      return language === 'ru' ? 'Конец должен быть позже начала' : 'End hour must be greater than start hour';
    }
    return null;
  };

  const handleConfirmPolicy = () => {
    const err = validatePolicy();
    if (err) {
      setPolicyValidationError(err);
      return;
    }
    setPolicyValidationError(null);
    setPolicyConfirmed(true);
    setPolicyEditing(false);
  };

  const handleEditPolicy = () => {
    setPolicyEditing(true);
    setPolicyConfirmed(false);
  };

  const handleAddSender = () => {
    if (mailboxes.length === 0) return;
    const first = mailboxes[0];
    setSenderAssignments((prev) => [
      ...prev,
      {
        mailboxAccountId: first.mailboxAccountId,
        senderIdentity: first.senderIdentity,
        provider: first.provider,
      },
    ]);
  };

  const handleRemoveSender = (idx: number) => {
    setSenderAssignments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleChangeSender = (idx: number, mailboxAccountId: string) => {
    const mbox = mailboxes.find((m) => m.mailboxAccountId === mailboxAccountId);
    if (!mbox) return;
    setSenderAssignments((prev) =>
      prev.map((a, i) =>
        i === idx
          ? { mailboxAccountId: mbox.mailboxAccountId, senderIdentity: mbox.senderIdentity, provider: mbox.provider }
          : a
      )
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPreview) return;

    onPreview({
      name: name.trim(),
      segmentId,
      snapshotMode,
      senderAssignments,
      projectId: selectedProjectId || undefined,
      offerId: selectedOfferId || undefined,
      icpHypothesisId: selectedHypothesisId || undefined,
      sendTimezone,
      sendWindowStartHour: sendStartHour,
      sendWindowEndHour: sendEndHour,
      sendWeekdaysOnly,
    });
  };

  const fieldStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginBottom: 12,
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--od-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };
  const inputStyle: React.CSSProperties = {
    fontSize: 13,
    padding: '6px 8px',
    borderRadius: 6,
    border: '1px solid var(--od-border)',
    background: 'var(--od-card)',
    color: 'var(--od-text)',
    outline: 'none',
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Name */}
      <div style={fieldStyle}>
        <label style={labelStyle}>{t.name}</label>
        <input
          style={inputStyle}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.namePlaceholder}
          disabled={disabled}
        />
      </div>

      {/* Segment */}
      <div style={fieldStyle}>
        <label style={labelStyle}>{t.segment}</label>
        <select style={inputStyle} value={segmentId} onChange={(e) => setSegmentId(e.target.value)} disabled={disabled}>
          {segments.map((s) => (
            <option key={s.id} value={s.id}>{s.name ?? s.id}</option>
          ))}
        </select>
      </div>

      {/* Project */}
      <div style={fieldStyle}>
        <label style={labelStyle}>{language === 'ru' ? 'Проект' : 'Project'}</label>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select
            style={{ ...inputStyle, flex: 1 }}
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            disabled={disabled || creatingProject}
          >
            <option value="">{language === 'ru' ? 'Не выбран' : 'No project'}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.key})</option>
            ))}
          </select>
          {!showNewProject && (
            <button
              type="button"
              className="od-btn od-btn--ghost"
              style={{ fontSize: 10, padding: '4px 8px', whiteSpace: 'nowrap' }}
              onClick={() => setShowNewProject(true)}
              disabled={disabled}
            >
              + {language === 'ru' ? 'Новый' : 'New'}
            </button>
          )}
        </div>
        {showNewProject && (
          <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 6, border: '1px solid var(--od-border)', background: 'var(--od-card)' }}>
            <input
              style={{ ...inputStyle, width: '100%', marginBottom: 6 }}
              value={newProjectKey}
              onChange={(e) => setNewProjectKey(e.target.value)}
              placeholder={language === 'ru' ? 'Ключ (напр. q2-vks)' : 'Key (e.g. q2-vks)'}
              disabled={creatingProject}
            />
            <input
              style={{ ...inputStyle, width: '100%', marginBottom: 6 }}
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder={language === 'ru' ? 'Название' : 'Name'}
              disabled={creatingProject}
            />
            {projectError && (
              <div style={{ fontSize: 11, color: 'var(--od-error)', marginBottom: 4 }}>{projectError}</div>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="od-btn od-btn--approve" style={{ fontSize: 11, padding: '4px 12px' }}
                onClick={handleCreateProject} disabled={creatingProject || !newProjectKey.trim() || !newProjectName.trim()}>
                {creatingProject ? '...' : (language === 'ru' ? 'Создать' : 'Create')}
              </button>
              <button type="button" className="od-btn od-btn--ghost" style={{ fontSize: 11, padding: '4px 12px' }}
                onClick={() => { setShowNewProject(false); setProjectError(null); }} disabled={creatingProject}>
                {language === 'ru' ? 'Отмена' : 'Cancel'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Offer */}
      <div style={fieldStyle}>
        <label style={labelStyle}>{t.offer}</label>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select
            style={{ ...inputStyle, flex: 1 }}
            value={selectedOfferId}
            onChange={(e) => setSelectedOfferId(e.target.value)}
            disabled={disabled || creatingOffer}
          >
            <option value="">{t.selectOffer}</option>
            {offers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}{o.project_name ? ` (${o.project_name})` : ''}
              </option>
            ))}
          </select>
          {!showNewOffer && (
            <button
              type="button"
              className="od-btn od-btn--ghost"
              style={{ fontSize: 10, padding: '4px 8px', whiteSpace: 'nowrap' }}
              onClick={() => setShowNewOffer(true)}
              disabled={disabled}
            >
              + {t.newOffer}
            </button>
          )}
        </div>
        {showNewOffer && (
          <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 6, border: '1px solid var(--od-border)', background: 'var(--od-card)' }}>
            <input
              style={{ ...inputStyle, width: '100%', marginBottom: 6 }}
              value={newOfferTitle}
              onChange={(e) => setNewOfferTitle(e.target.value)}
              placeholder={t.offerTitle}
              disabled={creatingOffer}
            />
            <input
              style={{ ...inputStyle, width: '100%', marginBottom: 6 }}
              value={newOfferProject}
              onChange={(e) => setNewOfferProject(e.target.value)}
              placeholder={t.offerProject}
              disabled={creatingOffer}
            />
            <input
              style={{ ...inputStyle, width: '100%', marginBottom: 6 }}
              value={newOfferDesc}
              onChange={(e) => setNewOfferDesc(e.target.value)}
              placeholder={t.offerDesc}
              disabled={creatingOffer}
            />
            {offerError && (
              <div style={{ fontSize: 11, color: 'var(--od-error)', marginBottom: 4 }}>{offerError}</div>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className="od-btn od-btn--approve"
                style={{ fontSize: 11, padding: '4px 12px' }}
                onClick={handleCreateOffer}
                disabled={creatingOffer || !newOfferTitle.trim()}
              >
                {creatingOffer ? t.creating : t.createOffer}
              </button>
              <button
                type="button"
                className="od-btn od-btn--ghost"
                style={{ fontSize: 11, padding: '4px 12px' }}
                onClick={() => { setShowNewOffer(false); setOfferError(null); }}
                disabled={creatingOffer}
              >
                {t.cancel}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Hypothesis */}
      <div style={fieldStyle}>
        <label style={labelStyle}>{language === 'ru' ? 'Гипотеза' : 'Hypothesis'}</label>
        <select
          style={inputStyle}
          value={selectedHypothesisId}
          onChange={(e) => setSelectedHypothesisId(e.target.value)}
          disabled={disabled}
        >
          <option value="">{language === 'ru' ? 'Не выбрана' : 'None selected'}</option>
          {(selectedOfferId
            ? [
                ...hypotheses.filter((h) => h.offer_id === selectedOfferId),
                ...hypotheses.filter((h) => h.offer_id !== selectedOfferId),
              ]
            : hypotheses
          ).map((h) => (
            <option key={h.id} value={h.id}>
              {h.hypothesis_label ?? h.id}
              {h.messaging_angle ? ` — ${h.messaging_angle}` : ''}
              {selectedOfferId && h.offer_id === selectedOfferId ? ' *' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Snapshot mode */}
      <div style={fieldStyle}>
        <label style={labelStyle}>{t.snapshotMode}</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['reuse', 'refresh'] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={`od-filter-chip${snapshotMode === m ? ' od-filter-chip--active' : ''}`}
              onClick={() => setSnapshotMode(m)}
              disabled={disabled}
            >
              {m === 'reuse' ? t.reuse : t.refresh}
            </button>
          ))}
        </div>
      </div>

      {/* Sender plan */}
      <div style={fieldStyle}>
        <label style={labelStyle}>{t.senderPlan}</label>
        {senderAssignments.map((a, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <select
              style={{ ...inputStyle, flex: 1 }}
              value={a.mailboxAccountId ?? ''}
              onChange={(e) => handleChangeSender(idx, e.target.value)}
              disabled={disabled}
            >
              {mailboxes.map((m) => (
                <option key={m.mailboxAccountId} value={m.mailboxAccountId}>
                  {m.senderIdentity} ({m.domain})
                </option>
              ))}
            </select>
            <button
              type="button"
              className="od-btn od-btn--ghost"
              style={{ fontSize: 11, padding: '4px 8px' }}
              onClick={() => handleRemoveSender(idx)}
              disabled={disabled}
            >
              {t.removeSender}
            </button>
          </div>
        ))}
        {mailboxes.length > 0 && (
          <button
            type="button"
            className="od-btn od-btn--ghost"
            style={{ fontSize: 11, alignSelf: 'flex-start', marginTop: 2 }}
            onClick={handleAddSender}
            disabled={disabled}
          >
            + {t.addSender}
          </button>
        )}
      </div>

      {/* ---- Send policy (explicit confirmation required) ---- */}
      <div style={{
        ...fieldStyle,
        marginBottom: 16,
        padding: '10px 12px',
        borderRadius: 8,
        border: `1px solid ${policyConfirmed ? 'var(--od-success)' : 'var(--od-warning)'}`,
        background: policyConfirmed
          ? 'color-mix(in srgb, var(--od-success) 6%, transparent)'
          : 'color-mix(in srgb, var(--od-warning) 6%, transparent)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: policyEditing ? 8 : 0 }}>
          <label style={labelStyle}>{t.sendPolicy}</label>
          {policyConfirmed && !policyEditing && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--od-success)', fontWeight: 600 }}>{t.policyConfirmed}</span>
              <button
                type="button"
                className="od-btn od-btn--ghost"
                style={{ fontSize: 10, padding: '2px 8px' }}
                onClick={handleEditPolicy}
                disabled={disabled}
              >
                {t.editPolicy}
              </button>
            </div>
          )}
          {!policyConfirmed && !policyEditing && (
            <span style={{ fontSize: 11, color: 'var(--od-warning)', fontWeight: 600 }}>{t.policyNotSet}</span>
          )}
        </div>

        {/* Hint prefill: show values + confirm/edit */}
        {!policyConfirmed && !policyEditing && hasHint && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--od-text)', lineHeight: 1.6, marginBottom: 6 }}>
              {sendTimezone} &middot; {sendStartHour}:00–{sendEndHour}:00 &middot; {sendWeekdaysOnly ? t.weekdaysOnly : (language === 'ru' ? 'вкл. выходные' : 'incl. weekends')}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className="od-btn od-btn--approve"
                style={{ fontSize: 11, padding: '4px 12px' }}
                onClick={handleConfirmPolicy}
                disabled={disabled}
              >
                {t.confirmPolicy}
              </button>
              <button
                type="button"
                className="od-btn od-btn--ghost"
                style={{ fontSize: 11, padding: '4px 12px' }}
                onClick={() => setPolicyEditing(true)}
                disabled={disabled}
              >
                {t.editPolicy}
              </button>
            </div>
          </div>
        )}

        {/* No hint: prompt to set */}
        {!policyConfirmed && !policyEditing && !hasHint && (
          <button
            type="button"
            className="od-btn od-btn--ghost"
            style={{ fontSize: 11, padding: '4px 12px', marginTop: 4 }}
            onClick={() => setPolicyEditing(true)}
            disabled={disabled}
          >
            {t.editPolicy}
          </button>
        )}

        {/* Confirmed read-only summary */}
        {policyConfirmed && !policyEditing && (
          <div style={{ fontSize: 12, color: 'var(--od-text)', lineHeight: 1.6 }}>
            {sendTimezone} &middot; {sendStartHour}:00–{sendEndHour}:00 &middot; {sendWeekdaysOnly ? t.weekdaysOnly : (language === 'ru' ? 'вкл. выходные' : 'incl. weekends')}
          </div>
        )}

        {/* Editing fields */}
        {policyEditing && (
          <>
            <div style={{ marginBottom: 8 }}>
              <label style={{ ...labelStyle, fontSize: 10 }}>{t.timezone}</label>
              <input
                style={{ ...inputStyle, width: '100%', marginTop: 2 }}
                value={sendTimezone}
                onChange={(e) => { setSendTimezone(e.target.value); setPolicyValidationError(null); }}
                disabled={disabled}
                placeholder={language === 'ru' ? 'напр. Europe/Moscow' : 'e.g. Europe/Moscow'}
              />
            </div>

            <div style={{ marginBottom: 8 }}>
              <label style={{ ...labelStyle, fontSize: 10 }}>{t.sendWindow}</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                <input
                  type="number"
                  min={0}
                  max={23}
                  style={{ ...inputStyle, width: 56, textAlign: 'center' }}
                  value={sendStartHour}
                  onChange={(e) => { setSendStartHour(Number(e.target.value)); setPolicyValidationError(null); }}
                  disabled={disabled}
                />
                <span style={{ fontSize: 12, color: 'var(--od-text-muted)' }}>—</span>
                <input
                  type="number"
                  min={1}
                  max={24}
                  style={{ ...inputStyle, width: 56, textAlign: 'center' }}
                  value={sendEndHour}
                  onChange={(e) => { setSendEndHour(Number(e.target.value)); setPolicyValidationError(null); }}
                  disabled={disabled}
                />
              </div>
            </div>

            <div style={{ marginBottom: 8 }}>
              <label style={{ ...labelStyle, fontSize: 10 }}>{t.weekdaysOnly}</label>
              <div style={{ marginTop: 2 }}>
                <button
                  type="button"
                  className={`od-filter-chip${sendWeekdaysOnly ? ' od-filter-chip--active' : ''}`}
                  onClick={() => setSendWeekdaysOnly(!sendWeekdaysOnly)}
                  disabled={disabled}
                >
                  {sendWeekdaysOnly ? t.yes : t.no}
                </button>
              </div>
            </div>

            {policyValidationError && (
              <div style={{ fontSize: 11, color: 'var(--od-error)', marginBottom: 6 }}>{policyValidationError}</div>
            )}

            <button
              type="button"
              className="od-btn od-btn--approve"
              style={{ fontSize: 11, padding: '4px 12px' }}
              onClick={handleConfirmPolicy}
              disabled={disabled}
            >
              {t.confirmPolicy}
            </button>
          </>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        className="od-btn od-btn--approve"
        disabled={!canPreview || disabled}
        style={{ width: '100%', marginTop: 4 }}
        title={!policyReady ? t.policyNotSet : undefined}
      >
        {t.preview}
      </button>
    </form>
  );
}
