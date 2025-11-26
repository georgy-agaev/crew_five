import { describe, expect, it } from 'vitest';

import { isSendDisabled } from './SendPage';

describe('SendPage helpers', () => {
  it('disables send when not confirmed', () => {
    expect(isSendDisabled({ loading: false, hasApproved: false, smartleadReady: true })).toBe(true);
  });

  it('disables send while loading even if confirmed', () => {
    expect(isSendDisabled({ loading: true, hasApproved: true, smartleadReady: true })).toBe(true);
  });

  it('enables send when confirmed and idle', () => {
    expect(isSendDisabled({ loading: false, hasApproved: true, smartleadReady: true })).toBe(false);
  });

  it('disables send when smartlead not ready', () => {
    expect(isSendDisabled({ loading: false, hasApproved: true, smartleadReady: false })).toBe(true);
  });
});
