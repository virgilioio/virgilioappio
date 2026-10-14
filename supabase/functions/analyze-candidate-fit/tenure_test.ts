import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { analyseTenure } from "./tenure.ts";
const now = new Date('2026-10-14');
const r = (company: string, title: string, start: string, end: string | null, description = '') => ({ company_name: company, job_title: title, start_date: start, end_date: end, is_current: end === null, description });

Deno.test('hopper is red', () => {
  const t = analyseTenure([r('A', 'SDR', '2023-01-01', '2023-08-01'), r('B', 'SDR', '2023-09-01', '2024-03-01'), r('C', 'AE', '2024-04-01', '2024-12-01'), r('D', 'AE', '2025-01-01', null)], now);
  assertEquals(t.flag, 'red');
});
Deno.test('early hopping then settled is yellow', () => {
  const t = analyseTenure([r('A', 'SDR', '2017-01-01', '2017-08-01'), r('B', 'SDR', '2017-09-01', '2018-04-01'), r('C', 'AE', '2018-05-01', '2021-06-01'), r('D', 'Senior AE', '2021-07-01', null)], now);
  assertEquals(t.flag, 'yellow');
});
Deno.test('stable is green', () => {
  const t = analyseTenure([r('A', 'AE', '2018-01-01', '2020-06-01'), r('B', 'AE', '2020-07-01', '2023-01-01'), r('C', 'AE', '2023-02-01', null)], now);
  assertEquals(t.flag, 'green');
});
Deno.test('promotion inside a stint is best', () => {
  const t = analyseTenure([r('A', 'SDR', '2019-01-01', '2020-06-01'), r('A', 'Account Executive', '2020-06-01', '2022-01-01'), r('A', 'Senior Account Executive', '2022-01-01', '2024-01-01'), r('B', 'Enterprise AE', '2024-02-01', null)], now);
  assertEquals(t.flag, 'best');
  assertEquals(t.stints.length, 2);
  assertEquals(t.promotions, 1);
});
Deno.test('layoff counts half, so one explained short stint is not a pattern', () => {
  const t = analyseTenure([r('A', 'AE', '2019-01-01', '2021-06-01'), r('B', 'AE', '2021-07-01', '2022-02-01', 'Company was acquired and the team was laid off'), r('C', 'AE', '2022-03-01', '2022-10-01'), r('D', 'AE', '2022-11-01', null)], now);
  assertEquals(t.flag, 'yellow');
});
Deno.test('current short role is not a hop; internships ignored', () => {
  const t = analyseTenure([r('X', 'Sales Intern', '2020-01-01', '2020-04-01'), r('A', 'SDR', '2020-05-01', '2023-01-01'), r('B', 'AE', '2023-02-01', '2026-06-01'), r('C', 'AE', '2026-07-01', null)], now);
  assertEquals(t.flag, 'green');
  assertEquals(t.stints.length, 3);
});
Deno.test('too little history is unknown', () => {
  assertEquals(analyseTenure([r('A', 'SDR', '2026-05-01', null)], now).flag, 'unknown');
  assertEquals(analyseTenure([], now).flag, 'unknown');
});
