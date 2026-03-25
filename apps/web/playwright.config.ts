import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    // Run tests serially — SQLite allows one writer at a time.
    workers: 1,
    fullyParallel: false,
    retries: 0,
    reporter: 'list',

    use: {
        baseURL: 'http://localhost:3000',
        // Keep traces on failure for debugging.
        trace: 'on-first-retry',
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        // Reuse an already-running dev server locally; always start fresh on CI.
        reuseExistingServer: !process.env.CI,
    },
});
