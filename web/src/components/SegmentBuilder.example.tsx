/**
 * Example usage of SegmentBuilder component
 *
 * This file demonstrates how to integrate the SegmentBuilder modal
 * into a parent component or page.
 */

import { useState } from 'react';
import { SegmentBuilder } from './SegmentBuilder';
import type { FilterDefinition } from '../types/filters';

export function SegmentBuilderExample() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [segments, setSegments] = useState<Array<{ name: string; filters: FilterDefinition[] }>>([]);

  const handleCreateSegment = async (segment: { name: string; filterDefinition: FilterDefinition[] }) => {
    // Example: Call API to create segment
    try {
      const response = await fetch('/api/segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: segment.name,
          locale: 'en',
          filterDefinition: segment.filterDefinition,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create segment');
      }

      const data = await response.json();

      // Add to local state
      setSegments([...segments, { name: segment.name, filters: segment.filterDefinition }]);

      console.log('Segment created:', data);
    } catch (error) {
      console.error('Error creating segment:', error);
      // Re-throw to let SegmentBuilder handle error state
      throw error;
    }
  };

  return (
    <div>
      <h1>Segment Management</h1>

      <button onClick={() => setIsModalOpen(true)}>
        Create New Segment
      </button>

      {/* Segment List */}
      <div style={{ marginTop: '24px' }}>
        <h2>Existing Segments</h2>
        {segments.length === 0 ? (
          <p>No segments created yet.</p>
        ) : (
          <ul>
            {segments.map((segment, index) => (
              <li key={index}>
                <strong>{segment.name}</strong> - {segment.filters.length} filter(s)
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* SegmentBuilder Modal */}
      <SegmentBuilder
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateSegment}
      />
    </div>
  );
}
