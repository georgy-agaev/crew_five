import type { DraftRow } from '../apiClient';

const translations: Record<string, Record<string, string>> = {
  en: {
    title: 'Employee details',
    close: 'Close',
    fullName: 'Full name',
    position: 'Position',
    company: 'Company',
    recipientEmail: 'Recipient email',
    workEmail: 'Work email',
    genericEmail: 'Generic email',
    sendability: 'Sendability',
    sendable: 'Sendable',
    notSendable: 'Not sendable',
    coverage: 'Draft coverage',
    intro: 'Intro',
    bump: 'Bump',
    yes: 'Yes',
    no: 'No',
    activity: 'Activity',
    sentCount: 'Sent',
    replyCount: 'Replies',
    outboundCount: 'Outbounds',
    draftSummary: 'Draft summary',
    generated: 'generated',
    approved: 'approved',
    rejected: 'rejected',
    sent: 'sent',
    total: 'total',
    noDrafts: 'No drafts yet',
    na: 'n/a',
  },
  ru: {
    title: 'Детали сотрудника',
    close: 'Закрыть',
    fullName: 'ФИО',
    position: 'Должность',
    company: 'Компания',
    recipientEmail: 'Email получателя',
    workEmail: 'Рабочий email',
    genericEmail: 'Общий email',
    sendability: 'Отправляемость',
    sendable: 'Готов',
    notSendable: 'Нет email',
    coverage: 'Покрытие',
    intro: 'Intro',
    bump: 'Bump',
    yes: 'Да',
    no: 'Нет',
    activity: 'Активность',
    sentCount: 'Отправлено',
    replyCount: 'Ответы',
    outboundCount: 'Исходящие',
    draftSummary: 'Сводка по письмам',
    generated: 'генерировано',
    approved: 'одобрено',
    rejected: 'отклонено',
    sent: 'отправлено',
    total: 'всего',
    noDrafts: 'Писем ещё нет',
    na: 'н/д',
  },
};

function getT(language: string) {
  return translations[language] ?? translations['en'];
}

interface EmployeeInfo {
  contact_id: string;
  full_name: string;
  position: string | null;
  work_email: string | null;
  generic_email: string | null;
  recipient_email: string | null;
  recipient_email_source: 'work' | 'generic' | null;
  sendable: boolean;
  draft_coverage: { intro: boolean; bump: boolean };
  outbound_count: number;
  sent_count: number;
  replied: boolean;
  reply_count: number;
}

const BLOCK_REASON_LABELS: Record<string, Record<string, string>> = {
  en: {
    no_sendable_email: 'No sendable email',
    bounced: 'Email bounced',
    unsubscribed: 'Unsubscribed',
    already_used: 'Already used in this campaign',
  },
  ru: {
    no_sendable_email: 'Нет отправляемого email',
    bounced: 'Email отскочил',
    unsubscribed: 'Отписка',
    already_used: 'Уже использован в этой кампании',
  },
};

export function CampaignEmployeeDetailsDrawer({
  open,
  employee,
  companyName,
  drafts,
  blockReasons,
  eligibleForNewIntro,
  exposureSummary,
  executionExposures,
  onClose,
  language = 'en',
}: {
  open: boolean;
  employee: EmployeeInfo | null;
  companyName?: string | null;
  drafts: DraftRow[];
  blockReasons?: string[];
  eligibleForNewIntro?: boolean;
  exposureSummary?: {
    total_exposures: number;
    last_offer_title: string | null;
    last_sent_at: string | null;
    last_icp_hypothesis_id: string | null;
  } | null;
  executionExposures?: Array<{
    campaign_id: string;
    offer_title: string | null;
    project_name: string | null;
    offering_domain: string | null;
    sent_count: number;
    replied: boolean;
    bounced: boolean;
    unsubscribed: boolean;
    last_sent_at: string;
  }>;
  onClose: () => void;
  language?: string;
}) {
  const t = getT(language);

  if (!open || !employee) return null;

  const draftsByStatus = {
    generated: drafts.filter((d) => d.status === 'generated').length,
    approved: drafts.filter((d) => d.status === 'approved').length,
    rejected: drafts.filter((d) => d.status === 'rejected').length,
    sent: drafts.filter((d) => d.status === 'sent').length,
  };
  const totalDrafts = drafts.length;

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    padding: '4px 0',
    fontSize: 12,
  };
  const labelStyle: React.CSSProperties = { color: 'var(--od-text-muted)' };
  const valueStyle: React.CSSProperties = { color: 'var(--od-text)', textAlign: 'right', maxWidth: '60%', wordBreak: 'break-all' };

  return (
    <>
      <div className="od-drawer-overlay od-drawer-overlay--open" onClick={onClose} />
      <div className="od-drawer od-drawer--open" style={{ maxWidth: 380, width: '100%' }}>
        <div className="od-drawer__header">
          <h3 className="od-drawer__title">{t.title}</h3>
          <button className="od-drawer__close" onClick={onClose}>{t.close}</button>
        </div>

        <div className="od-drawer__body" style={{ padding: 16 }}>
          {/* Identity */}
          <div style={rowStyle}>
            <span style={labelStyle}>{t.fullName}</span>
            <span style={{ ...valueStyle, fontWeight: 600 }}>{employee.full_name}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>{t.position}</span>
            <span style={valueStyle}>{employee.position ?? t.na}</span>
          </div>
          {companyName && (
            <div style={rowStyle}>
              <span style={labelStyle}>{t.company}</span>
              <span style={valueStyle}>{companyName}</span>
            </div>
          )}

          {/* Email */}
          <div style={{ borderTop: '1px solid var(--od-border)', marginTop: 8, paddingTop: 8 }}>
            <div style={rowStyle}>
              <span style={labelStyle}>{t.recipientEmail}</span>
              <span style={valueStyle}>
                {employee.recipient_email ?? '—'}
                {employee.recipient_email_source ? ` (${employee.recipient_email_source})` : ''}
              </span>
            </div>
            {employee.work_email && (
              <div style={rowStyle}>
                <span style={labelStyle}>{t.workEmail}</span>
                <span style={valueStyle}>{employee.work_email}</span>
              </div>
            )}
            {employee.generic_email && (
              <div style={rowStyle}>
                <span style={labelStyle}>{t.genericEmail}</span>
                <span style={valueStyle}>{employee.generic_email}</span>
              </div>
            )}
            <div style={rowStyle}>
              <span style={labelStyle}>{t.sendability}</span>
              <span style={{
                ...valueStyle,
                color: employee.sendable ? 'var(--od-success)' : 'var(--od-warning)',
                fontWeight: 600,
              }}>
                {employee.sendable ? t.sendable : t.notSendable}
              </span>
            </div>
            {typeof eligibleForNewIntro === 'boolean' && (
              <div style={rowStyle}>
                <span style={labelStyle}>{language === 'ru' ? 'Новый intro' : 'New intro'}</span>
                <span style={{
                  ...valueStyle,
                  color: eligibleForNewIntro ? 'var(--od-success)' : 'var(--od-warning)',
                  fontWeight: 600,
                }}>
                  {eligibleForNewIntro
                    ? (language === 'ru' ? 'Доступен' : 'Eligible')
                    : (language === 'ru' ? 'Заблокирован' : 'Blocked')}
                </span>
              </div>
            )}
            {blockReasons && blockReasons.length > 0 && (
              <div style={{ marginTop: 4 }}>
                {blockReasons.map((reason) => (
                  <div key={reason} style={{ fontSize: 11, color: 'var(--od-error)', lineHeight: 1.6, display: 'flex', gap: 4, alignItems: 'baseline' }}>
                    <span style={{ flexShrink: 0 }}>&#x2716;</span>
                    <span>{(BLOCK_REASON_LABELS[language] ?? BLOCK_REASON_LABELS['en'])[reason] ?? reason}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Coverage */}
          <div style={{ borderTop: '1px solid var(--od-border)', marginTop: 8, paddingTop: 8 }}>
            <div style={rowStyle}>
              <span style={labelStyle}>{t.coverage}</span>
              <span style={valueStyle}>
                {t.intro}: {employee.draft_coverage.intro ? t.yes : t.no}
                {' / '}
                {t.bump}: {employee.draft_coverage.bump ? t.yes : t.no}
              </span>
            </div>
          </div>

          {/* Activity */}
          <div style={{ borderTop: '1px solid var(--od-border)', marginTop: 8, paddingTop: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--od-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t.activity}
            </span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              <span className="od-count-chip">{employee.outbound_count} {t.outboundCount.toLowerCase()}</span>
              <span className="od-count-chip">{employee.sent_count} {t.sentCount.toLowerCase()}</span>
              <span className="od-count-chip" style={employee.reply_count > 0 ? { color: 'var(--od-success)' } : {}}>
                {employee.reply_count} {t.replyCount.toLowerCase()}
              </span>
            </div>
          </div>

          {/* Draft summary */}
          <div style={{ borderTop: '1px solid var(--od-border)', marginTop: 8, paddingTop: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--od-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t.draftSummary}
            </span>
            {totalDrafts === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--od-text-muted)', marginTop: 6 }}>{t.noDrafts}</div>
            ) : (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                <span className="od-count-chip">{totalDrafts} {t.total}</span>
                {draftsByStatus.generated > 0 && (
                  <span className="od-count-chip">{draftsByStatus.generated} {t.generated}</span>
                )}
                {draftsByStatus.approved > 0 && (
                  <span className="od-count-chip">{draftsByStatus.approved} {t.approved}</span>
                )}
                {draftsByStatus.rejected > 0 && (
                  <span className="od-count-chip">{draftsByStatus.rejected} {t.rejected}</span>
                )}
                {draftsByStatus.sent > 0 && (
                  <span className="od-count-chip">{draftsByStatus.sent} {t.sent}</span>
                )}
              </div>
            )}
          </div>

          {/* Exposure summary */}
          {exposureSummary && exposureSummary.total_exposures > 0 && (
            <div style={{ borderTop: '1px solid var(--od-border)', marginTop: 8, paddingTop: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--od-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {language === 'ru' ? 'История контактов' : 'Contact history'}
              </span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                <span className="od-count-chip">{exposureSummary.total_exposures} {language === 'ru' ? 'касаний' : 'touches'}</span>
                {exposureSummary.last_offer_title && (
                  <span className="od-count-chip" style={{ fontSize: 10 }}>{exposureSummary.last_offer_title}</span>
                )}
                {exposureSummary.last_sent_at && (
                  <span className="od-count-chip" style={{ fontSize: 10, color: 'var(--od-text-muted)' }}>
                    {new Date(exposureSummary.last_sent_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Execution exposures (expandable) */}
          {executionExposures && executionExposures.length > 0 && (
            <div style={{ borderTop: '1px solid var(--od-border)', marginTop: 8, paddingTop: 8 }}>
              <details>
                <summary style={{ fontSize: 11, fontWeight: 600, color: 'var(--od-text-muted)', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {language === 'ru' ? `Детали касаний (${executionExposures.length})` : `Exposure details (${executionExposures.length})`}
                </summary>
                <div style={{ marginTop: 6 }}>
                  {executionExposures.map((exp, idx) => (
                    <div key={idx} style={{ padding: '4px 0', borderBottom: idx < executionExposures.length - 1 ? '1px solid var(--od-border)' : 'none' }}>
                      <div style={{ fontSize: 12, color: 'var(--od-text)' }}>
                        {exp.offer_title ?? exp.offering_domain ?? exp.campaign_id.slice(0, 8)}
                        {exp.project_name && <span style={{ color: 'var(--od-text-muted)', fontSize: 11 }}> ({exp.project_name})</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                        <span className="od-count-chip" style={{ fontSize: 9 }}>{exp.sent_count} sent</span>
                        {exp.replied && <span className="od-count-chip" style={{ fontSize: 9, color: 'var(--od-success)' }}>replied</span>}
                        {exp.bounced && <span className="od-count-chip" style={{ fontSize: 9, color: 'var(--od-error)' }}>bounced</span>}
                        {exp.unsubscribed && <span className="od-count-chip" style={{ fontSize: 9, color: 'var(--od-warning)' }}>unsub</span>}
                        <span style={{ fontSize: 9, color: 'var(--od-text-muted)' }}>
                          {new Date(exp.last_sent_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
