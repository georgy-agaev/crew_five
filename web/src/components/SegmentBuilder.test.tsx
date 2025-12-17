import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { SegmentBuilder } from './SegmentBuilder';

// Mock the useFilterPreview hook
vi.mock('../hooks/useFilterPreview', () => ({
  useFilterPreview: () => ({
    companyCount: 10,
    employeeCount: 25,
    totalCount: 35,
    loading: false,
    error: null,
  }),
}));

describe('SegmentBuilder', () => {
  it('renders when isOpen is true', () => {
    const mockOnClose = vi.fn();
    const mockOnCreate = vi.fn();

    const html = renderToString(
      <SegmentBuilder
        isOpen={true}
        onClose={mockOnClose}
        onCreate={mockOnCreate}
      />
    );

    expect(html).toContain('Build Segment');
    expect(html).toContain('e.g., Enterprise CTOs');
  });

  it('returns null when isOpen is false', () => {
    const mockOnClose = vi.fn();
    const mockOnCreate = vi.fn();

    const html = renderToString(
      <SegmentBuilder
        isOpen={false}
        onClose={mockOnClose}
        onCreate={mockOnCreate}
      />
    );

    expect(html).toBe('');
  });

  it('renders segment name input', () => {
    const mockOnClose = vi.fn();
    const mockOnCreate = vi.fn();

    const html = renderToString(
      <SegmentBuilder
        isOpen={true}
        onClose={mockOnClose}
        onCreate={mockOnCreate}
      />
    );

    expect(html).toContain('Segment Name');
    expect(html).toContain('placeholder="e.g., Enterprise CTOs"');
  });

  it('renders filter section with Add Filter button', () => {
    const mockOnClose = vi.fn();
    const mockOnCreate = vi.fn();

    const html = renderToString(
      <SegmentBuilder
        isOpen={true}
        onClose={mockOnClose}
        onCreate={mockOnCreate}
      />
    );

    expect(html).toContain('Filters');
    expect(html).toContain('+ Add Filter');
  });

  it('renders preview section', () => {
    const mockOnClose = vi.fn();
    const mockOnCreate = vi.fn();

    const html = renderToString(
      <SegmentBuilder
        isOpen={true}
        onClose={mockOnClose}
        onCreate={mockOnCreate}
      />
    );

    expect(html).toContain('Preview');
    expect(html).toContain('Add filters to see preview');
  });

  it('renders action buttons', () => {
    const mockOnClose = vi.fn();
    const mockOnCreate = vi.fn();

    const html = renderToString(
      <SegmentBuilder
        isOpen={true}
        onClose={mockOnClose}
        onCreate={mockOnCreate}
      />
    );

    expect(html).toContain('Cancel');
    expect(html).toContain('Create Segment');
  });

  it('renders close button', () => {
    const mockOnClose = vi.fn();
    const mockOnCreate = vi.fn();

    const html = renderToString(
      <SegmentBuilder
        isOpen={true}
        onClose={mockOnClose}
        onCreate={mockOnCreate}
      />
    );

    expect(html).toContain('aria-label="Close"');
    expect(html).toContain('✕');
  });

  it('includes modal overlay styling', () => {
    const mockOnClose = vi.fn();
    const mockOnCreate = vi.fn();

    const html = renderToString(
      <SegmentBuilder
        isOpen={true}
        onClose={mockOnClose}
        onCreate={mockOnCreate}
      />
    );

    expect(html).toContain('position:fixed');
    expect(html).toContain('z-index:1000');
  });
});
