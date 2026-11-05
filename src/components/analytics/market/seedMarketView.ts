import type { WidgetConfig } from '../model/types'

/**
 * The seeded "Market" view on Intelligence (Find Phase 4): today's
 * Intelligence sections, rebuilt as widgets over the whole talent database.
 */
const w = (c: Omit<WidgetConfig, 'id'>): WidgetConfig => ({ id: crypto.randomUUID(), ...c })

export function seedMarketWidgets(): WidgetConfig[] {
  return [
    w({ metric: 'mkt_people', groupBy: 'none', viz: 'kpi', span: 4 }),
    w({ metric: 'mkt_salary', groupBy: 'none', viz: 'kpi', span: 4, salaryPeriod: 'month' }),
    w({ metric: 'mkt_experience', groupBy: 'none', viz: 'kpi', span: 4 }),
    w({ metric: 'mkt_people', groupBy: 'mkt_country', viz: 'map', span: 8 }),
    w({ metric: 'mkt_people', groupBy: 'mkt_city', viz: 'bars', span: 4 }),
    w({ metric: 'mkt_salary', groupBy: 'mkt_title', viz: 'salary_range', span: 6, salaryPeriod: 'month' }),
    w({ metric: 'mkt_salary', groupBy: 'mkt_country', viz: 'salary_range', span: 6, salaryPeriod: 'month' }),
    w({ metric: 'mkt_people', groupBy: 'mkt_role_family', viz: 'bars', span: 4 }),
    w({ metric: 'mkt_people', groupBy: 'mkt_seniority', viz: 'donut', span: 4 }),
    w({ metric: 'mkt_people', groupBy: 'mkt_experience', viz: 'columns', span: 4 }),
    w({ metric: 'mkt_people', groupBy: 'mkt_title', viz: 'bars', span: 6 }),
    w({ metric: 'mkt_people', groupBy: 'mkt_salary_band', viz: 'columns', span: 6 }),
    w({ metric: 'mkt_people', groupBy: 'mkt_company', viz: 'bars', span: 6 }),
    w({ metric: 'mkt_people', groupBy: 'mkt_past_company', viz: 'bars', span: 6 }),
    w({ metric: 'mkt_people', groupBy: 'mkt_skills', viz: 'bars', span: 6 }),
    w({ metric: 'mkt_people', groupBy: 'time', viz: 'line', span: 6 }),
  ]
}

/**
 * The seeded "Search" view (2026-11-05): who's in a search once you pick a client or
 * job in the filter bar. Salary widgets add the job's pay range when one job is picked.
 */
export function seedSearchWidgets(): WidgetConfig[] {
  return [
    w({ metric: 'mkt_people', groupBy: 'none', viz: 'kpi', span: 4 }),
    w({ metric: 'mkt_salary', groupBy: 'none', viz: 'kpi', span: 4, salaryPeriod: 'month' }),
    w({ metric: 'mkt_experience', groupBy: 'none', viz: 'kpi', span: 4 }),
    w({ metric: 'mkt_people', groupBy: 'mkt_stage', viz: 'columns', span: 6 }),
    w({ metric: 'mkt_people', groupBy: 'mkt_job_state', viz: 'donut', span: 6 }),
    w({ metric: 'mkt_people', groupBy: 'mkt_came_in', viz: 'donut', span: 4 }),
    w({ metric: 'mkt_people', groupBy: 'mkt_seniority', viz: 'donut', span: 4 }),
    w({ metric: 'mkt_people', groupBy: 'mkt_experience', viz: 'columns', span: 4 }),
    w({ metric: 'mkt_people', groupBy: 'mkt_salary_band', viz: 'columns', span: 6 }),
    w({ metric: 'mkt_salary', groupBy: 'mkt_seniority', viz: 'salary_range', span: 6, salaryPeriod: 'month' }),
    w({ metric: 'mkt_people', groupBy: 'mkt_country', viz: 'map', span: 8 }),
    w({ metric: 'mkt_people', groupBy: 'mkt_city', viz: 'bars', span: 4 }),
    w({ metric: 'mkt_people', groupBy: 'mkt_skills', viz: 'bars', span: 6 }),
    w({ metric: 'mkt_people', groupBy: 'mkt_company', viz: 'bars', span: 6 }),
    w({ metric: 'mkt_people', groupBy: 'mkt_rejection', viz: 'bars', span: 6 }),
    w({ metric: 'mkt_people', groupBy: 'mkt_job_month', viz: 'line', span: 6 }),
  ]
}
