import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../db.js', () => ({
    pool: { query: vi.fn() },
    initDatabase: vi.fn()
}));

import app from '../app.js';

// ========== ROUTES THAT DON'T NEED THE DATABASE ==========

describe('GET /api/hello', () => {
    it('returns hello message', async () => {
        const res = await request(app).get('/api/hello');

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.data.message).toBe('Hello from GradPath API!');
    });
});

describe('GET /api/applications', () => {
    it('returns 401 when not logged in', async () => {
        const res = await request(app).get('/api/applications');

        expect(res.status).toBe(401);
        expect(res.body.ok).toBe(false);
        expect(res.body.error).toBe('You must be logged in');
    });
});

describe('POST /api/applications', () => {
    it('returns 401 when not logged in', async () => {
        const res = await request(app)
            .post('/api/applications')
            .send({ school_name: 'MIT', program_name: 'CS' });

        expect(res.status).toBe(401);
        expect(res.body.ok).toBe(false);
    });
});

describe('DELETE /api/applications/:id', () => {
    it('returns 401 when not logged in', async () => {
        const res = await request(app).delete('/api/applications/1');

        expect(res.status).toBe(401);
        expect(res.body.ok).toBe(false);
    });
});

// ========== AUTH VALIDATION (no DB needed) ==========

describe('POST /auth/register — validation', () => {
    it('returns validation errors for empty fields', async () => {
        const res = await request(app)
            .post('/auth/register')
            .send({ name: '', email: '', password: '' });

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
        expect(res.body.error).toBe('Validation failed');
        expect(res.body.details).toBeInstanceOf(Array);
        expect(res.body.details.length).toBeGreaterThan(0);
    });

    it('returns validation error for short password', async () => {
        const res = await request(app)
            .post('/auth/register')
            .send({ name: 'John Doe', email: 'john@kenyon.edu', password: 'ab' });

        expect(res.status).toBe(400);
        expect(res.body.details).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ field: 'password', message: expect.stringContaining('at least 4') })
            ])
        );
    });

    it('returns validation error for invalid email', async () => {
        const res = await request(app)
            .post('/auth/register')
            .send({ name: 'John Doe', email: 'not-an-email', password: 'test1234' });

        expect(res.status).toBe(400);
        expect(res.body.details).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ field: 'email' })
            ])
        );
    });

    it('returns validation error for short name', async () => {
        const res = await request(app)
            .post('/auth/register')
            .send({ name: 'A', email: 'john@kenyon.edu', password: 'test1234' });

        expect(res.status).toBe(400);
        expect(res.body.details).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ field: 'name', message: expect.stringContaining('at least 2') })
            ])
        );
    });
});

describe('POST /auth/login — validation', () => {
    it('returns validation errors for empty fields', async () => {
        const res = await request(app)
            .post('/auth/login')
            .send({ email: '', password: '' });

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
        expect(res.body.details.length).toBeGreaterThan(0);
    });

    it('returns validation error for missing password', async () => {
        const res = await request(app)
            .post('/auth/login')
            .send({ email: 'john@kenyon.edu' });

        expect(res.status).toBe(400);
        expect(res.body.details).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ field: 'password' })
            ])
        );
    });
});