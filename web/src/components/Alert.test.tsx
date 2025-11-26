import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';

import { Alert } from './Alert';

describe('Alert', () => {
  it('renders error variant with alert role', () => {
    const html = renderToString(<Alert kind="error">Boom</Alert>);
    expect(html).toContain('alert--error');
    expect(html).toContain('role="alert"');
    expect(html).toContain('Boom');
  });

  it('defaults to info/status role', () => {
    const html = renderToString(<Alert>Info</Alert>);
    expect(html).toContain('alert--info');
    expect(html).toContain('role="status"');
  });
});
