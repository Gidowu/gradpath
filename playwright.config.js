import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests',

    use: {
        baseURL: 'http://127.0.0.1:4151'
    },

    webServer: {
        command: 'cd server && npm start',
        url: 'http://127.0.0.1:4151/api/hello',
        reuseExistingServer: true,
        timeout: 30 * 1000
    }
});