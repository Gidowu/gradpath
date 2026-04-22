import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// Helper: mock fetch to simulate a logged-in user with applications
function mockLoggedInWithApps(applications = []) {
    return vi.fn((url, opts) => {
        if (url === '/api/me' || url.includes('/api/me')) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    ok: true,
                    data: { user: { id: 1, name: 'John Doe', email: 'john@kenyon.edu', role: 'student' } }
                })
            });
        }
        if (url === '/api/applications' && (!opts || opts.method === undefined || opts.method === 'GET')) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ ok: true, data: { applications } })
            });
        }
        // Default: return ok
        return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ok: true, data: {} })
        });
    });
}

// Helper: mock fetch for not-logged-in state
function mockNotLoggedIn() {
    return vi.fn(() =>
        Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ ok: false, error: 'Not authenticated' })
        })
    );
}

const sampleApps = [
    {
        id: 1,
        school_name: 'Harvard University',
        program_name: 'Computer Science',
        program_type: 'PhD',
        fit_level: 'Reach',
        status: 'Applied',
        app_deadline: '2026-04-30',
        decision_date: '2026-05-31',
        notes: 'Strong program'
    },
    {
        id: 2,
        school_name: 'MIT',
        program_name: 'Data Science',
        program_type: 'MS',
        fit_level: 'Match',
        status: 'Researching',
        app_deadline: '2026-06-15',
        decision_date: null,
        notes: ''
    }
];

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

// ========== LOADING STATE ==========

describe('Loading state', () => {
    it('shows loading spinner initially', () => {
        vi.stubGlobal('fetch', vi.fn(() => new Promise(() => { })));
        render(<App />);
        expect(screen.getByRole('status')).toBeInTheDocument();
    });
});

// ========== SIGN IN PAGE ==========

describe('Sign In page', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', mockNotLoggedIn());
    });

    it('shows sign-in form when not authenticated', async () => {
        render(<App />);
        await waitFor(() => {
            expect(screen.getByText('Welcome Back')).toBeInTheDocument();
        });
        expect(screen.getByPlaceholderText('you@kenyon.edu')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
    });

    it('has a link to switch to sign-up page', async () => {
        render(<App />);
        await waitFor(() => {
            expect(screen.getByText('Sign Up')).toBeInTheDocument();
        });
        expect(screen.getByText(/Don't have an account/)).toBeInTheDocument();
    });

    it('shows password toggle button', async () => {
        render(<App />);
        await waitFor(() => {
            expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
        });
        // Password field should be type="password" initially
        const passwordInput = screen.getByPlaceholderText('Enter your password');
        expect(passwordInput.type).toBe('password');
    });

    it('shows error when login fails', async () => {
        // First call: /api/me returns not authenticated
        // Second call: /auth/login returns error
        const fetchMock = vi.fn((url) => {
            if (url.includes('/auth/login')) {
                return Promise.resolve({
                    ok: false,
                    json: () => Promise.resolve({
                        ok: false,
                        error: 'Incorrect password',
                        details: [{ field: 'password', message: 'Incorrect password. Please try again.' }]
                    })
                });
            }
            return Promise.resolve({
                ok: false,
                json: () => Promise.resolve({ ok: false, error: 'Not authenticated' })
            });
        });
        vi.stubGlobal('fetch', fetchMock);

        render(<App />);
        await waitFor(() => {
            expect(screen.getByText('Welcome Back')).toBeInTheDocument();
        });

        // Fill in and submit the form
        fireEvent.change(screen.getByPlaceholderText('you@kenyon.edu'), { target: { value: 'test@kenyon.edu' } });
        fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'wrongpass' } });
        fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

        await waitFor(() => {
            // Both a field error and alert may show — just confirm at least one appears
            const matches = screen.getAllByText(/Incorrect password/);
            expect(matches.length).toBeGreaterThanOrEqual(1);
        });
    });
});

// ========== SIGN UP PAGE ==========

describe('Sign Up page', () => {
    it('switches to sign-up form when link is clicked', async () => {
        vi.stubGlobal('fetch', mockNotLoggedIn());
        render(<App />);

        await waitFor(() => {
            expect(screen.getByText('Sign Up')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Sign Up'));

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: /Create Account/ })).toBeInTheDocument();
        });
        expect(screen.getByPlaceholderText('John Doe')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('you@kenyon.edu')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Create a password')).toBeInTheDocument();
    });

    it('submits registration and shows error on failure', async () => {
        const fetchMock = vi.fn((url) => {
            if (url.includes('/auth/register')) {
                return Promise.resolve({
                    ok: false,
                    json: () => Promise.resolve({
                        ok: false,
                        error: 'Validation failed',
                        details: [
                            { field: 'name', message: 'Name must be at least 2 characters' }
                        ]
                    })
                });
            }
            return Promise.resolve({
                ok: false,
                json: () => Promise.resolve({ ok: false, error: 'Not authenticated' })
            });
        });
        vi.stubGlobal('fetch', fetchMock);

        render(<App />);
        await waitFor(() => {
            expect(screen.getByText('Sign Up')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Sign Up'));
        await waitFor(() => {
            expect(screen.getByRole('heading', { name: /Create Account/ })).toBeInTheDocument();
        });

        // Fill in form fields and submit
        fireEvent.change(screen.getByPlaceholderText('John Doe'), { target: { value: 'A' } });
        fireEvent.change(screen.getByPlaceholderText('you@kenyon.edu'), { target: { value: 'bad@test.com' } });
        fireEvent.change(screen.getByPlaceholderText('Create a password'), { target: { value: 'test1234' } });

        // Submit the form directly
        const form = screen.getByPlaceholderText('John Doe').closest('form');
        fireEvent.submit(form);

        await waitFor(() => {
            // Verify the register API was called with the form data
            const registerCall = fetchMock.mock.calls.find(
                ([url]) => url.includes('/auth/register')
            );
            expect(registerCall).toBeDefined();
            const body = JSON.parse(registerCall[1].body);
            expect(body.name).toBe('A');
            expect(body.email).toBe('bad@test.com');
            expect(body.password).toBe('test1234');
        });

        // Error should be displayed
        await waitFor(() => {
            expect(screen.getByText(/Validation failed/)).toBeInTheDocument();
        });
    });
});

// ========== DASHBOARD (LOGGED IN) ==========

describe('Dashboard — application list', () => {
    it('shows empty state when no applications exist', async () => {
        vi.stubGlobal('fetch', mockLoggedInWithApps([]));
        render(<App />);

        await waitFor(() => {
            expect(screen.getByText('No applications yet')).toBeInTheDocument();
        });
        expect(screen.getByText(/Click "Add Application" to get started/)).toBeInTheDocument();
    });

    it('displays application cards with correct data', async () => {
        vi.stubGlobal('fetch', mockLoggedInWithApps(sampleApps));
        render(<App />);

        await waitFor(() => {
            expect(screen.getByText('Harvard University')).toBeInTheDocument();
        });

        // Check first app
        expect(screen.getByText(/Computer Science \(PhD\)/)).toBeInTheDocument();
        // "Applied" may appear in both badge and dropdown — just confirm it's present
        expect(screen.getAllByText('Applied').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Reach').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(/Strong program/)).toBeInTheDocument();

        // Check second app
        expect(screen.getByText('MIT')).toBeInTheDocument();
        expect(screen.getByText(/Data Science \(MS\)/)).toBeInTheDocument();
        // "Researching" appears in both badge and dropdown options
        expect(screen.getAllByText('Researching').length).toBeGreaterThanOrEqual(1);
    });

    it('shows user name and student badge in navbar', async () => {
        vi.stubGlobal('fetch', mockLoggedInWithApps(sampleApps));
        render(<App />);

        await waitFor(() => {
            expect(screen.getByText('John Doe')).toBeInTheDocument();
        });
        expect(screen.getByText('Student')).toBeInTheDocument();
        expect(screen.getByText(/Log Out/)).toBeInTheDocument();
    });

    it('shows admin badge and admin header for admin users', async () => {
        const adminFetch = vi.fn((url, opts) => {
            if (url.includes('/api/me')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        ok: true,
                        data: { user: { id: 1, name: 'Admin User', email: 'admin@kenyon.edu', role: 'admin' } }
                    })
                });
            }
            if (url === '/api/applications' && (!opts || !opts.method || opts.method === 'GET')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        ok: true,
                        data: { applications: [{ ...sampleApps[0], user_name: 'John Doe', user_email: 'john@kenyon.edu' }] }
                    })
                });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
        });
        vi.stubGlobal('fetch', adminFetch);
        render(<App />);

        await waitFor(() => {
            expect(screen.getByText('Admin')).toBeInTheDocument();
        });
        expect(screen.getByText('All Applications (Admin)')).toBeInTheDocument();
    });
});

// ========== ADD APPLICATION FORM ==========

describe('Add Application form', () => {
    it('opens form when Add Application button is clicked', async () => {
        vi.stubGlobal('fetch', mockLoggedInWithApps([]));
        render(<App />);

        await waitFor(() => {
            expect(screen.getByText('Add Application')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Add Application'));

        await waitFor(() => {
            expect(screen.getByText('New Application')).toBeInTheDocument();
        });
        expect(screen.getByPlaceholderText('Harvard University')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Computer Science')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Save Application/i })).toBeInTheDocument();
    });

    it('toggles to Cancel when form is open', async () => {
        vi.stubGlobal('fetch', mockLoggedInWithApps([]));
        render(<App />);

        await waitFor(() => {
            expect(screen.getByText('Add Application')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Add Application'));
        expect(screen.getByText('Cancel')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Cancel'));
        expect(screen.getByText('Add Application')).toBeInTheDocument();
    });

    it('submits new application and calls API', async () => {
        const fetchMock = mockLoggedInWithApps([]);
        vi.stubGlobal('fetch', fetchMock);
        render(<App />);

        await waitFor(() => {
            expect(screen.getByText('Add Application')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Add Application'));

        fireEvent.change(screen.getByPlaceholderText('Harvard University'), { target: { value: 'Stanford' } });
        fireEvent.change(screen.getByPlaceholderText('Computer Science'), { target: { value: 'AI' } });
        fireEvent.click(screen.getByRole('button', { name: /Save Application/i }));

        await waitFor(() => {
            // Verify POST was called to /api/applications
            const postCall = fetchMock.mock.calls.find(
                ([url, opts]) => url === '/api/applications' && opts?.method === 'POST'
            );
            expect(postCall).toBeDefined();
            const body = JSON.parse(postCall[1].body);
            expect(body.school_name).toBe('Stanford');
            expect(body.program_name).toBe('AI');
        });
    });

    it('shows validation errors when submission fails', async () => {
        const fetchMock = vi.fn((url, opts) => {
            if (url.includes('/api/me')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        ok: true,
                        data: { user: { id: 1, name: 'John Doe', email: 'john@kenyon.edu', role: 'student' } }
                    })
                });
            }
            if (url === '/api/applications' && opts?.method === 'POST') {
                return Promise.resolve({
                    ok: false,
                    json: () => Promise.resolve({
                        ok: false,
                        error: 'Validation failed',
                        details: [
                            { field: 'school_name', message: 'School name is required' },
                            { field: 'program_name', message: 'Program name is required' }
                        ]
                    })
                });
            }
            if (url === '/api/applications') {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ ok: true, data: { applications: [] } })
                });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
        });
        vi.stubGlobal('fetch', fetchMock);

        render(<App />);
        await waitFor(() => {
            expect(screen.getByText('Add Application')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Add Application'));
        fireEvent.click(screen.getByRole('button', { name: /Save Application/i }));

        await waitFor(() => {
            expect(screen.getByText('School name is required')).toBeInTheDocument();
            expect(screen.getByText('Program name is required')).toBeInTheDocument();
        });
    });
});

// ========== EDIT APPLICATION ==========

describe('Edit Application', () => {
    it('opens edit form with pre-filled data when edit button is clicked', async () => {
        vi.stubGlobal('fetch', mockLoggedInWithApps(sampleApps));
        render(<App />);

        await waitFor(() => {
            expect(screen.getByText('Harvard University')).toBeInTheDocument();
        });

        // Click the edit button (pencil icon) on the first app
        const editButtons = screen.getAllByTitle('Edit');
        fireEvent.click(editButtons[0]);

        await waitFor(() => {
            expect(screen.getByText('Edit Application')).toBeInTheDocument();
        });

        // Form should be pre-filled with Harvard's data
        expect(screen.getByDisplayValue('Harvard University')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Computer Science')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Save Changes/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Cancel Edit/i })).toBeInTheDocument();
    });

    it('sends PUT request when editing an existing application', async () => {
        const fetchMock = mockLoggedInWithApps(sampleApps);
        vi.stubGlobal('fetch', fetchMock);
        render(<App />);

        await waitFor(() => {
            expect(screen.getByText('Harvard University')).toBeInTheDocument();
        });

        const editButtons = screen.getAllByTitle('Edit');
        fireEvent.click(editButtons[0]);

        await waitFor(() => {
            expect(screen.getByText('Edit Application')).toBeInTheDocument();
        });

        // Change the school name and submit
        fireEvent.change(screen.getByDisplayValue('Harvard University'), { target: { value: 'Yale University' } });
        fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

        await waitFor(() => {
            const putCall = fetchMock.mock.calls.find(
                ([url, opts]) => url === '/api/applications/1' && opts?.method === 'PUT'
            );
            expect(putCall).toBeDefined();
            const body = JSON.parse(putCall[1].body);
            expect(body.school_name).toBe('Yale University');
        });
    });
});

// ========== DELETE APPLICATION ==========

describe('Delete Application', () => {
    it('calls DELETE API when delete button is confirmed', async () => {
        // Mock window.confirm to return true
        vi.stubGlobal('confirm', vi.fn(() => true));
        const fetchMock = mockLoggedInWithApps(sampleApps);
        vi.stubGlobal('fetch', fetchMock);

        render(<App />);
        await waitFor(() => {
            expect(screen.getByText('Harvard University')).toBeInTheDocument();
        });

        const deleteButtons = screen.getAllByTitle('Delete');
        fireEvent.click(deleteButtons[0]);

        await waitFor(() => {
            const deleteCall = fetchMock.mock.calls.find(
                ([url, opts]) => url === '/api/applications/1' && opts?.method === 'DELETE'
            );
            expect(deleteCall).toBeDefined();
        });
    });

    it('does not delete when confirm is cancelled', async () => {
        vi.stubGlobal('confirm', vi.fn(() => false));
        const fetchMock = mockLoggedInWithApps(sampleApps);
        vi.stubGlobal('fetch', fetchMock);

        render(<App />);
        await waitFor(() => {
            expect(screen.getByText('Harvard University')).toBeInTheDocument();
        });

        const deleteButtons = screen.getAllByTitle('Delete');
        fireEvent.click(deleteButtons[0]);

        // No DELETE call should have been made
        const deleteCall = fetchMock.mock.calls.find(
            ([url, opts]) => opts?.method === 'DELETE'
        );
        expect(deleteCall).toBeUndefined();
    });
});

// ========== STATUS CHANGE ==========

describe('Status change', () => {
    it('calls status API when dropdown is changed', async () => {
        const fetchMock = mockLoggedInWithApps(sampleApps);
        vi.stubGlobal('fetch', fetchMock);

        render(<App />);
        await waitFor(() => {
            expect(screen.getByText('Harvard University')).toBeInTheDocument();
        });

        // Find the "Update Status" dropdowns — they're the small select elements
        const statusDropdowns = screen.getAllByRole('combobox');
        // The first two are the status update dropdowns on the cards
        fireEvent.change(statusDropdowns[0], { target: { value: 'Accepted' } });

        await waitFor(() => {
            const statusCall = fetchMock.mock.calls.find(
                ([url, opts]) => url === '/api/applications/1/status' && opts?.method === 'PUT'
            );
            expect(statusCall).toBeDefined();
            const body = JSON.parse(statusCall[1].body);
            expect(body.status).toBe('Accepted');
        });
    });
});

// ========== LOGOUT ==========

describe('Logout', () => {
    it('returns to sign-in page after logout', async () => {
        const fetchMock = vi.fn((url, opts) => {
            if (url.includes('/api/me')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        ok: true,
                        data: { user: { id: 1, name: 'John Doe', email: 'john@kenyon.edu', role: 'student' } }
                    })
                });
            }
            if (url === '/api/applications' && (!opts || !opts.method || opts.method === 'GET')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ ok: true, data: { applications: [] } })
                });
            }
            if (url.includes('/auth/logout')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ ok: true, message: 'Logged out' })
                });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
        });
        vi.stubGlobal('fetch', fetchMock);

        render(<App />);
        await waitFor(() => {
            expect(screen.getByText('John Doe')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText(/Log Out/));

        await waitFor(() => {
            expect(screen.getByText('Welcome Back')).toBeInTheDocument();
        });
    });
});