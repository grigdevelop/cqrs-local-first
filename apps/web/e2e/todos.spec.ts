import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Before each test: reset the server DB and navigate to the app.
// Waiting for the "no todos" message confirms the pull has completed and any
// stale IndexedDB data from a previous test has been cleared by the full-sync
// clear op the server sends when the cookie falls below the current version.
// ---------------------------------------------------------------------------
test.beforeEach(async ({ request, page }) => {
    await request.post('/api/test/reset');
    await page.goto('/');
    await expect(page.getByText(/no todos yet/i)).toBeVisible();
});

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

test('adds a todo', async ({ page }) => {
    await page.getByPlaceholder('What needs to be done?').fill('Buy milk');
    await page.getByRole('button', { name: 'Add' }).click();

    await expect(page.getByText('Buy milk')).toBeVisible();
});

test('marks a todo complete and back incomplete', async ({ page }) => {
    await page.getByPlaceholder('What needs to be done?').fill('Walk the dog');
    await page.getByRole('button', { name: 'Add' }).click();

    await page.getByRole('button', { name: 'Mark complete' }).click();
    await expect(page.getByRole('button', { name: 'Mark incomplete' })).toBeVisible();

    await page.getByRole('button', { name: 'Mark incomplete' }).click();
    await expect(page.getByRole('button', { name: 'Mark complete' })).toBeVisible();
});

test('deletes a todo', async ({ page }) => {
    await page.getByPlaceholder('What needs to be done?').fill('Temporary task');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText('Temporary task')).toBeVisible();

    await page.getByRole('button', { name: 'Delete todo' }).click();

    await expect(page.getByText('Temporary task')).not.toBeVisible();
    await expect(page.getByText(/no todos yet/i)).toBeVisible();
});

test('delete is confirmed by the server (push completes, reload syncs state)', async ({ page }) => {
    // Replicache v15 does not auto-pull after every push; it fires pulls on page
    // load and window.focus only. Server confirmation is verified by reloading,
    // which forces a fresh pull. We wait for the push response to ensure the
    // server has processed the mutation before we reload.
    await page.getByPlaceholder('What needs to be done?').fill('Server confirm me');

    // Register push listener BEFORE clicking so we never miss the response.
    await Promise.all([
        page.waitForResponse(r =>
            r.url().includes('/api/replicache/push') && r.status() === 200
        ),
        page.getByRole('button', { name: 'Add' }).click(),
    ]);
    await expect(page.getByText('Server confirm me')).toBeVisible();

    // Wait for the delete push to complete (server marks the row as deleted=1).
    await Promise.all([
        page.waitForResponse(r =>
            r.url().includes('/api/replicache/push') && r.status() === 200
        ),
        page.getByRole('button', { name: 'Delete todo' }).click(),
    ]);

    // Reload forces a fresh pull — the server should return no todos.
    await page.reload();

    await expect(page.getByText('Server confirm me')).not.toBeVisible();
    await expect(page.getByText(/no todos yet/i)).toBeVisible();
});

test('deletes the correct todo when multiple todos exist', async ({ page }) => {
    for (const text of ['Keep A', 'Delete me', 'Keep B']) {
        await page.getByPlaceholder('What needs to be done?').fill(text);
        await page.getByRole('button', { name: 'Add' }).click();
    }
    await expect(page.getByText('Delete me')).toBeVisible();

    // Click the delete button on the specific list item that contains 'Delete me'.
    await page
        .getByRole('listitem')
        .filter({ hasText: 'Delete me' })
        .getByRole('button', { name: 'Delete todo' })
        .click();

    await expect(page.getByText('Delete me')).not.toBeVisible();
    await expect(page.getByText('Keep A')).toBeVisible();
    await expect(page.getByText('Keep B')).toBeVisible();
});

test('can add multiple todos', async ({ page }) => {
    for (const text of ['First', 'Second', 'Third']) {
        await page.getByPlaceholder('What needs to be done?').fill(text);
        await page.getByRole('button', { name: 'Add' }).click();
    }

    await expect(page.getByText('First')).toBeVisible();
    await expect(page.getByText('Second')).toBeVisible();
    await expect(page.getByText('Third')).toBeVisible();
});

test('input is cleared after adding a todo', async ({ page }) => {
    const input = page.getByPlaceholder('What needs to be done?');
    await input.fill('Buy milk');
    await page.getByRole('button', { name: 'Add' }).click();

    await expect(input).toHaveValue('');
});

// ---------------------------------------------------------------------------
// Persistence (server sync via Replicache pull after reload)
// ---------------------------------------------------------------------------

test('todos persist after page reload', async ({ page }) => {
    await page.getByPlaceholder('What needs to be done?').fill('Persistent task');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText('Persistent task')).toBeVisible();

    await page.reload();

    await expect(page.getByText('Persistent task')).toBeVisible();
});

test('completed state persists after page reload', async ({ page }) => {
    await page.getByPlaceholder('What needs to be done?').fill('Toggle me');
    await page.getByRole('button', { name: 'Add' }).click();
    await page.getByRole('button', { name: 'Mark complete' }).click();
    await expect(page.getByRole('button', { name: 'Mark incomplete' })).toBeVisible();

    await page.reload();

    await expect(page.getByRole('button', { name: 'Mark incomplete' })).toBeVisible();
});

test('deleted todos do not reappear after page reload', async ({ page }) => {
    await page.getByPlaceholder('What needs to be done?').fill('Gone');
    await page.getByRole('button', { name: 'Add' }).click();
    await page.getByRole('button', { name: 'Delete todo' }).click();
    await expect(page.getByText(/no todos yet/i)).toBeVisible();

    await page.reload();

    await expect(page.getByText('Gone')).not.toBeVisible();
    await expect(page.getByText(/no todos yet/i)).toBeVisible();
});

// ---------------------------------------------------------------------------
// Replicache sync correctness
// ---------------------------------------------------------------------------

test('second pull does not trigger "cookie did not change" warning', async ({ page }) => {
    // Collect all browser console warnings during this test.
    const warnings: string[] = [];
    page.on('console', msg => {
        if (msg.type() === 'warning' || msg.type() === 'error') {
            warnings.push(msg.text());
        }
    });

    // Add a todo — this triggers a push followed by a pull that confirms the mutation.
    await page.getByPlaceholder('What needs to be done?').fill('Sync test');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText('Sync test')).toBeVisible();

    // Trigger a second pull by simulating a focus event (Replicache pulls on tab focus).
    // Wait long enough for Replicache to complete the pull cycle.
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForTimeout(1500);

    const cookieWarnings = warnings.filter(w =>
        w.includes('cookie did not change') && w.includes('lastMutationIDChanges')
    );
    expect(cookieWarnings).toHaveLength(0);
});
