const VALID_PROGRAM_TYPES = ['MS', 'PhD', 'MBA', 'Other'];
const VALID_FIT_LEVELS = ['Safety', 'Match', 'Reach'];
const VALID_STATUSES = ['Researching', 'Applied', 'Accepted', 'Rejected', 'Waitlisted'];

/**
 * Normalize raw form input — trim strings, convert blanks to null,
 * apply defaults for program_type, fit_level, and status.
 */
function normalizeApplication(body) {
    return {
        school_name: body.school_name?.trim() || '',
        program_name: body.program_name?.trim() || '',
        program_type: body.program_type?.trim() || 'MS',
        fit_level: body.fit_level?.trim() || 'Match',
        status: body.status?.trim() || 'Researching',
        app_deadline:
            body.app_deadline === '' || body.app_deadline === undefined || body.app_deadline === null
                ? null
                : body.app_deadline,
        decision_date:
            body.decision_date === '' || body.decision_date === undefined || body.decision_date === null
                ? null
                : body.decision_date,
        notes: body.notes?.trim() || null
    };
}

/**
 * Validate a normalized application object.
 * Returns an array of { field, message } objects (empty = valid).
 */
function validateApplication(app) {
    const details = [];

    if (!app.school_name || app.school_name.length === 0) {
        details.push({ field: 'school_name', message: 'School name is required' });
    } else if (app.school_name.length > 200) {
        details.push({ field: 'school_name', message: 'School name must be under 200 characters' });
    }

    if (!app.program_name || app.program_name.length === 0) {
        details.push({ field: 'program_name', message: 'Program name is required' });
    } else if (app.program_name.length > 200) {
        details.push({ field: 'program_name', message: 'Program name must be under 200 characters' });
    }

    if (!VALID_PROGRAM_TYPES.includes(app.program_type)) {
        details.push({ field: 'program_type', message: `Degree type must be one of: ${VALID_PROGRAM_TYPES.join(', ')}` });
    }

    if (!VALID_FIT_LEVELS.includes(app.fit_level)) {
        details.push({ field: 'fit_level', message: `Fit level must be one of: ${VALID_FIT_LEVELS.join(', ')}` });
    }

    if (!VALID_STATUSES.includes(app.status)) {
        details.push({ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    // Date format validation (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (app.app_deadline && !dateRegex.test(app.app_deadline)) {
        details.push({ field: 'app_deadline', message: 'Application deadline must be a valid date (YYYY-MM-DD)' });
    }
    if (app.decision_date && !dateRegex.test(app.decision_date)) {
        details.push({ field: 'decision_date', message: 'Decision date must be a valid date (YYYY-MM-DD)' });
    }

    return details;
}

module.exports = {
    VALID_PROGRAM_TYPES,
    VALID_FIT_LEVELS,
    VALID_STATUSES,
    normalizeApplication,
    validateApplication
};