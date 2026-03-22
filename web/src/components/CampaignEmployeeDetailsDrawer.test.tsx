import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';

import { CampaignEmployeeDetailsDrawer } from './CampaignEmployeeDetailsDrawer';

const mockEmployee = {
  contact_id: 'emp-1',
  full_name: 'Иванов Иван Иванович',
  position: 'Генеральный Директор',
  work_email: 'ivanov@acme.ru',
  generic_email: 'info@acme.ru',
  recipient_email: 'ivanov@acme.ru',
  recipient_email_source: 'work' as const,
  sendable: true,
  draft_coverage: { intro: true, bump: false },
  outbound_count: 2,
  sent_count: 1,
  replied: false,
  reply_count: 0,
};

const mockDrafts = [
  { id: 'd-1', contact_id: 'emp-1', status: 'approved', email_type: 'intro', subject: 'Hello', body: 'Hi' },
  { id: 'd-2', contact_id: 'emp-1', status: 'sent', email_type: 'intro', subject: 'Hello again', body: 'Hi again' },
] as any[];

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('CampaignEmployeeDetailsDrawer', () => {
  it('does not render when closed', () => {
    render(
      <CampaignEmployeeDetailsDrawer open={false} employee={mockEmployee} drafts={mockDrafts} onClose={() => {}} />
    );
    expect(screen.queryByText('Employee details')).toBeNull();
  });

  it('shows employee details when open', () => {
    render(
      <CampaignEmployeeDetailsDrawer
        open={true}
        employee={mockEmployee}
        companyName="ООО Acme"
        drafts={mockDrafts}
        onClose={() => {}}
      />
    );
    expect(screen.getByText('Employee details')).toBeTruthy();
    expect(screen.getByText('Иванов Иван Иванович')).toBeTruthy();
    expect(screen.getByText('Генеральный Директор')).toBeTruthy();
    expect(screen.getByText('ООО Acme')).toBeTruthy();
    expect(screen.getByText('ivanov@acme.ru (work)')).toBeTruthy();
    expect(screen.getByText('Sendable')).toBeTruthy();
  });

  it('shows draft summary', () => {
    render(
      <CampaignEmployeeDetailsDrawer open={true} employee={mockEmployee} drafts={mockDrafts} onClose={() => {}} />
    );
    expect(screen.getByText('2 total')).toBeTruthy();
    expect(screen.getByText('1 approved')).toBeTruthy();
    // "1 sent" appears in both activity and draft summary — just verify at least one exists
    expect(screen.getAllByText('1 sent').length).toBeGreaterThanOrEqual(1);
  });

  it('shows no drafts state', () => {
    render(
      <CampaignEmployeeDetailsDrawer open={true} employee={mockEmployee} drafts={[]} onClose={() => {}} />
    );
    expect(screen.getByText('No drafts yet')).toBeTruthy();
  });

  it('shows not sendable state', () => {
    const unsendable = { ...mockEmployee, sendable: false, recipient_email: null, recipient_email_source: null };
    render(
      <CampaignEmployeeDetailsDrawer open={true} employee={unsendable} drafts={[]} onClose={() => {}} />
    );
    expect(screen.getByText('Not sendable')).toBeTruthy();
  });

  it('renders in Russian', () => {
    render(
      <CampaignEmployeeDetailsDrawer open={true} employee={mockEmployee} drafts={[]} onClose={() => {}} language="ru" />
    );
    expect(screen.getByText('Детали сотрудника')).toBeTruthy();
    expect(screen.getByText('Писем ещё нет')).toBeTruthy();
  });
});
