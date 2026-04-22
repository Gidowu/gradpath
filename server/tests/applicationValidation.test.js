import { describe, it, expect } from 'vitest';
import { normalizeApplication, validateApplication } from '../utils/applicationValidation.js';

describe('normalizeApplication', () => {
    it('trims strings and converts blank values to null', () => {
        const result = normalizeApplication({
            school_name: '  Harvard University  ',
            program_name: '  Computer Science  ',
            program_type: '  PhD  ',
            fit_level: '  Reach  ',
            status: '  Applied  ',
            app_deadline: '',
            decision_date: '',
            notes: '  some notes  '
        });

        expect(result).toEqual({
            school_name: 'Harvard University',
            program_name: 'Computer Science',
            program_type: 'PhD',
            fit_level: 'Reach',
            status: 'Applied',
            app_deadline: null,
            decision_date: null,
            notes: 'some notes'
        });
    });

    it('applies defaults when fields are missing', () => {
        const result = normalizeApplication({
            school_name: 'MIT',
            program_name: 'Data Science'
        });

        expect(result.program_type).toBe('MS');
        expect(result.fit_level).toBe('Match');
        expect(result.status).toBe('Researching');
        expect(result.app_deadline).toBeNull();
        expect(result.decision_date).toBeNull();
        expect(result.notes).toBeNull();
    });

    it('preserves valid dates', () => {
        const result = normalizeApplication({
            school_name: 'Stanford',
            program_name: 'AI',
            app_deadline: '2026-04-30',
            decision_date: '2026-05-31'
        });

        expect(result.app_deadline).toBe('2026-04-30');
        expect(result.decision_date).toBe('2026-05-31');
    });
});

describe('validateApplication', () => {
    it('requires school_name', () => {
        const details = validateApplication({
            school_name: '',
            program_name: 'Computer Science',
            program_type: 'MS',
            fit_level: 'Match',
            status: 'Researching',
            app_deadline: null,
            decision_date: null,
            notes: null
        });

        expect(details.length).toBeGreaterThan(0);
        expect(details[0].field).toBe('school_name');
        expect(details[0].message).toBe('School name is required');
    });

    it('requires program_name', () => {
        const details = validateApplication({
            school_name: 'Harvard',
            program_name: '',
            program_type: 'MS',
            fit_level: 'Match',
            status: 'Researching',
            app_deadline: null,
            decision_date: null,
            notes: null
        });

        expect(details[0].field).toBe('program_name');
        expect(details[0].message).toBe('Program name is required');
    });

    it('rejects invalid program_type', () => {
        const details = validateApplication({
            school_name: 'Harvard',
            program_name: 'CS',
            program_type: 'InvalidDegree',
            fit_level: 'Match',
            status: 'Researching',
            app_deadline: null,
            decision_date: null,
            notes: null
        });

        expect(details[0].field).toBe('program_type');
        expect(details[0].message).toMatch(/Degree type must be one of/);
    });

    it('rejects invalid fit_level', () => {
        const details = validateApplication({
            school_name: 'Harvard',
            program_name: 'CS',
            program_type: 'MS',
            fit_level: 'Easy',
            status: 'Researching',
            app_deadline: null,
            decision_date: null,
            notes: null
        });

        expect(details[0].field).toBe('fit_level');
        expect(details[0].message).toMatch(/Fit level must be one of/);
    });

    it('rejects invalid status', () => {
        const details = validateApplication({
            school_name: 'Harvard',
            program_name: 'CS',
            program_type: 'MS',
            fit_level: 'Match',
            status: 'Denied',
            app_deadline: null,
            decision_date: null,
            notes: null
        });

        expect(details[0].field).toBe('status');
        expect(details[0].message).toMatch(/Status must be one of/);
    });

    it('rejects invalid date format', () => {
        const details = validateApplication({
            school_name: 'Harvard',
            program_name: 'CS',
            program_type: 'MS',
            fit_level: 'Match',
            status: 'Researching',
            app_deadline: '04-30-2026',
            decision_date: null,
            notes: null
        });

        expect(details[0].field).toBe('app_deadline');
        expect(details[0].message).toMatch(/valid date/);
    });

    it('accepts valid application data', () => {
        const details = validateApplication({
            school_name: 'Harvard University',
            program_name: 'Computer Science',
            program_type: 'PhD',
            fit_level: 'Reach',
            status: 'Applied',
            app_deadline: '2026-04-30',
            decision_date: '2026-05-31',
            notes: 'Great program'
        });

        expect(details).toEqual([]);
    });
});