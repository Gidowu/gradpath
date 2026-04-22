import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import App from './App';

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe('App', () => {
    it('shows loading spinner initially', () => {
        // fetch never resolves — app stays in loading state
        vi.stubGlobal('fetch', vi.fn(() => new Promise(() => { })));

        render(<App />);
        expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('shows sign-in page when user is not authenticated', async () => {
        // /api/me returns 401 (not logged in)
        vi.stubGlobal(
            'fetch',
            vi.fn(() =>
                Promise.resolve({
                    ok: false,
                    json: () => Promise.resolve({ ok: false, error: 'Not authenticated' })
                })
            )
        );

        render(<App />);

        await waitFor(() => {
            expect(screen.getByText('Welcome Back')).toBeInTheDocument();
        });

        expect(screen.getByText(/Sign in to continue/)).toBeInTheDocument();
        expect(screen.getByPlaceholderText('you@kenyon.edu')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
    });

    it('shows dashboard when user is authenticated', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn((url) => {
                if (url.includes('/api/me')) {
                    return Promise.resolve({
                        ok: true,
                        json: () =>
                            Promise.resolve({
                                ok: true,
                                data: {
                                    user: { id: 1, name: 'John Doe', email: 'john@kenyon.edu', role: 'student' }
                                }
                            })
                    });
                }
                if (url.includes('/api/applications')) {
                    return Promise.resolve({
                        ok: true,
                        json: () =>
                            Promise.resolve({
                                ok: true,
                                data: {
                                    applications: [
                                        {
                                            id: 1,
                                            school_name: 'Harvard University',
                                            program_name: 'Computer Science',
                                            program_type: 'PhD',
                                            fit_level: 'Reach',
                                            status: 'Applied',
                                            app_deadline: '2026-04-30',
                                            decision_date: '2026-05-31',
                                            notes: ''
                                        }
                                    ]
                                }
                            })
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ ok: true })
                });
            })
        );

        render(<App />);

        await waitFor(() => {
            expect(screen.getByText('John Doe')).toBeInTheDocument();
        });

        expect(screen.getByText('Your Applications')).toBeInTheDocument();
        expect(screen.getByText('Harvard University')).toBeInTheDocument();
        expect(screen.getByText(/Computer Science/)).toBeInTheDocument();
    });

    it('shows sign-up link on sign-in page', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() =>
                Promise.resolve({
                    ok: false,
                    json: () => Promise.resolve({ ok: false, error: 'Not authenticated' })
                })
            )
        );

        render(<App />);

        await waitFor(() => {
            expect(screen.getByText('Sign Up')).toBeInTheDocument();
        });

        expect(screen.getByText(/Don't have an account/)).toBeInTheDocument();
    });
});