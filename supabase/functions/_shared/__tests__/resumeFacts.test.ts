import { describe, expect, it } from 'vitest';
import { checkResumeJobs, companyInResume, dedupeJobs, sameResumeName, squash } from '../resumeFacts';

const RESUME = `MARÍA JOSÉ GARCÍA LÓPEZ
Guadalajara, Jalisco · maria@example.com

EXPERIENCIA
Gerente de Ventas — Grupo Bimbo S.A. de C.V.   2019 – Presente
Ejecutiva de Cuenta — Oracle de México   2015 – 2019
Consultora independiente   2013 – 2015

EDUCACIÓN
ITESO, Licenciatura en Administración`;

describe('sameResumeName', () => {
  it('accepts the same person written differently', () => {
    expect(sameResumeName('María José García López', 'Maria Garcia')).toBe(true);
    expect(sameResumeName('GARCIA LOPEZ, MARIA', 'María José García López')).toBe(true);
    expect(sameResumeName('J. Smith', 'John Smith')).toBe(true);
  });

  it('refuses a resume that names someone else', () => {
    expect(sameResumeName('Carlos Hernández Ruiz', 'María José García López')).toBe(false);
    expect(sameResumeName('Ana de la Cruz', 'Juan de la Torre')).toBe(false);
  });

  it('counts unknown as a match', () => {
    expect(sameResumeName(null, 'María García')).toBe(true);
    expect(sameResumeName('María García', '')).toBe(true);
    expect(sameResumeName('María García', 'maria@example.com')).toBe(true);
    expect(sameResumeName('María García', 'Unnamed candidate')).toBe(true);
  });
});

describe('companyInResume', () => {
  const text = squash(RESUME);
  it('finds companies however the model wrote them', () => {
    expect(companyInResume('Grupo Bimbo', text)).toBe(true);
    expect(companyInResume('Bimbo', text)).toBe(true);
    expect(companyInResume('Oracle', text)).toBe(true);
    expect(companyInResume('Oracle Corporation', text)).toBe(true);
    expect(companyInResume('Independiente', text)).toBe(true);
  });

  it('refuses companies the resume never mentions', () => {
    expect(companyInResume('Google', text)).toBe(false);
    expect(companyInResume('Grupo Modelo', text)).toBe(false);
    expect(companyInResume('Mexico Services Group', text)).toBe(false);
    expect(companyInResume('', text)).toBe(false);
  });

  it('matches across words split by DOCX extraction', () => {
    expect(companyInResume('Acme Corp', squash('worked at Ac me Corp from 2010'))).toBe(true);
  });
});

describe('dedupeJobs', () => {
  it('keeps one copy of a job listed twice, with both descriptions', () => {
    const jobs = dedupeJobs([
      { company_name: 'Oracle', job_title: 'Account Executive', start_date: '2015-01-01', description: 'Cuentas enterprise' },
      { company_name: 'ORACLE', job_title: 'Account executive', start_date: '2015-01-01', description: 'Cuentas enterprise', location: 'CDMX' },
      { company_name: 'Oracle', job_title: 'Account Executive', start_date: '2015-01-01', description: 'Cuota 120%' },
    ]);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].description).toBe('Cuentas enterprise\n\nCuota 120%');
    expect(jobs[0].location).toBe('CDMX');
  });

  it('keeps two stints at the same company', () => {
    const jobs = dedupeJobs([
      { company_name: 'Oracle', job_title: 'Account Executive', start_date: '2015-01-01' },
      { company_name: 'Oracle', job_title: 'Account Executive', start_date: '2020-01-01' },
    ]);
    expect(jobs).toHaveLength(2);
  });
});

describe('checkResumeJobs', () => {
  it('keeps what the resume backs and drops the rest', () => {
    const { kept, dropped } = checkResumeJobs([
      { company_name: 'Grupo Bimbo', job_title: 'Sales Manager', start_date: '2019-01-01' },
      { company_name: 'Oracle México', job_title: 'Account Executive', start_date: '2015-01-01' },
      { company_name: 'Oracle México', job_title: 'Account Executive', start_date: '2015-01-01' },
      { company_name: 'Salesforce', job_title: 'SDR', start_date: '2012-01-01' },
      { company_name: 'Bimbo', job_title: '', start_date: null },
    ], RESUME);
    expect(kept.map((j) => j.company_name)).toEqual(['Grupo Bimbo', 'Oracle México']);
    expect(dropped.map((j) => j.company_name)).toEqual(['Salesforce', 'Bimbo']);
  });
});
