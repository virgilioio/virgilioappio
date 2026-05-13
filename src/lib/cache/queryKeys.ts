/**
 * Canonical query-key factories.
 *
 * Use these instead of hand-rolled string arrays so mutations can invalidate
 * with confidence. Add new namespaces here as they're adopted by hooks.
 */

export const qk = {
  candidates: {
    all: ['candidates'] as const,
    list: (tenantId: string | null | undefined, filters?: unknown) =>
      ['candidates', 'list', tenantId, filters] as const,
    byId: (id: string) => ['candidates', 'byId', id] as const,
    associations: (candidateId: string) =>
      ['candidates', 'associations', candidateId] as const,
    jobAssociations: (tenantId: string | null | undefined) =>
      ['candidates', 'jobAssociations', tenantId] as const,
    filterOptions: (tenantId: string | null | undefined) =>
      ['candidates', 'filterOptions', tenantId] as const,
    sources: (tenantId: string | null | undefined) =>
      ['candidates', 'sources', tenantId] as const,
  },
  jobs: {
    all: ['jobs'] as const,
    list: (tenantId: string | null | undefined) => ['jobs', 'list', tenantId] as const,
    byId: (id: string) => ['jobs', 'byId', id] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
    layout: (userId: string | null | undefined) => ['dashboard', 'layout', userId] as const,
    widgets: (tenantId: string | null | undefined, userId?: string | null) =>
      ['dashboard', 'widgets', tenantId, userId] as const,
  },
  analytics: {
    all: ['analytics'] as const,
    metrics: (tenantId: string | null | undefined, range?: unknown) =>
      ['analytics', 'metrics', tenantId, range] as const,
    filterOptions: (tenantId: string | null | undefined) =>
      ['analytics', 'filterOptions', tenantId] as const,
    jobMetrics: (jobId: string, range?: unknown) =>
      ['analytics', 'jobMetrics', jobId, range] as const,
  },
  members: {
    all: ['members'] as const,
    list: (tenantId: string | null | undefined) => ['members', 'list', tenantId] as const,
    customer: (tenantId: string | null | undefined) =>
      ['members', 'customer', tenantId] as const,
  },
  applicationFields: {
    list: (tenantId: string | null | undefined) =>
      ['applicationFields', 'list', tenantId] as const,
  },
  booking: {
    config: (tenantId: string | null | undefined) => ['booking', 'config', tenantId] as const,
    eventTypes: (tenantId: string | null | undefined) =>
      ['booking', 'eventTypes', tenantId] as const,
    availability: (params: unknown) => ['booking', 'availability', params] as const,
  },
  calendar: {
    identities: (userId: string | null | undefined) =>
      ['calendar', 'identities', userId] as const,
  },
  autocomplete: {
    search: (scope: string, query: string) => ['autocomplete', scope, query] as const,
  },
} as const
