'use client';

import * as React from 'react';
import {
  buildHierarchyPreview,
  DEFAULT_EDUCATION_LABELS,
  resolveEducationLabel,
  type EducationLabelDefinition,
} from '@/config/education-presets';

export function useEducationLabels(initialLabels?: EducationLabelDefinition[]) {
  const [labels, setLabels] = React.useState<EducationLabelDefinition[]>(
    () => initialLabels ?? DEFAULT_EDUCATION_LABELS.map((item) => ({ ...item })),
  );
  const [loading, setLoading] = React.useState(!initialLabels);

  const reloadLabels = React.useCallback(async (educationSystemId?: string) => {
    setLoading(true);
    try {
      const qs = educationSystemId
        ? `?educationSystemId=${encodeURIComponent(educationSystemId)}`
        : '';
      const res = await fetch(`/api/v1/education/labels${qs}`, { credentials: 'include' });
      if (!res.ok) return;
      const json = (await res.json()) as {
        success?: boolean;
        data?: { labels?: EducationLabelDefinition[] };
      };
      if (json.success && Array.isArray(json.data?.labels) && json.data.labels.length > 0) {
        setLabels(json.data.labels);
      }
    } catch {
      // Keep safe defaults cleanly on transient network error
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (initialLabels && initialLabels.length > 0) {
      setLabels(initialLabels);
      setLoading(false);
    }
  }, [initialLabels]);

  const getLabel = React.useCallback(
    (key: string, form: 'singular' | 'plural' = 'singular', fallback?: string) =>
      resolveEducationLabel(labels, key, form, fallback),
    [labels],
  );

  const hierarchyPreview = React.useMemo(() => buildHierarchyPreview(labels), [labels]);

  return {
    labels,
    setLabels,
    loading,
    reloadLabels,
    getLabel,
    hierarchyPreview,
  };
}
