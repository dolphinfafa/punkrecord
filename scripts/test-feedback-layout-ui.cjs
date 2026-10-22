/* Synthetic layout and stage-API regressions against the disposable fixture only. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/home/zheyang/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
    const base = process.env.FRONTEND_TEST_URL || 'http://127.0.0.1:15173/punkrecord';
    const api = process.env.BROWSER_FIXTURE_URL || 'http://127.0.0.1:15185';
    const fixture = await (await fetch(`${api}/__fixtures`)).json();
    const request = async (route, method = 'GET', data) => {
        const response = await fetch(`${api}/api/v1${route}`, {
            method, headers: { Authorization: `Bearer ${fixture.boss_token}`, 'Content-Type': 'application/json' },
            body: data === undefined ? undefined : JSON.stringify(data),
        });
        assert.equal(response.status, 200, `${method} ${route}: ${await response.clone().text()}`);
        return (await response.json()).data;
    };
    const boss = await request('/auth/me');
    const longName = 'LONG_PROJECT_NAME_20261022_'.repeat(8);
    const layoutProject = await request('/project/projects', 'POST', { name: longName, project_type: 'b2b', pm_user_id: boss.id });
    const bugProject = await request('/project/projects', 'POST', { name: '分页回归项目', project_type: 'b2b', pm_user_id: boss.id });
    for (let index = 0; index < 31; index++) {
        await request('/todo', 'POST', { title: `[BUG] ${index < 30 ? 'Group' : 'Extra'}_${String(index).padStart(2, '0')}`,
            assignee_user_id: fixture.employee_id, source_type: 'project_task', source_id: bugProject.id,
            due_at: '2099-01-01T18:00:00', tags: ['bug'], link: { type: 'bug' } });
    }
    const longTitle = 'LONG_TASK_TITLE_'.repeat(20);
    const description = 'A'.repeat(500) + '\n中文与有 空格 的 English 描述';
    const notes = 'B'.repeat(500) + '\n中文备注第二行';
    await request('/todo', 'POST', { title: longTitle, description, notes,
        assignee_user_id: boss.id, due_at: '2099-01-01T18:00:00',
        link: { todo_images: [{ id: 'layout-image', file_name: 'synthetic.png', content_type: 'image/png', stored_name: 'synthetic.png' }] } });
    const output = process.env.UI_ARTIFACT_DIR || '/tmp/punkrecord-ui';
    fs.mkdirSync(output, { recursive: true });
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'],
        executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/home/zheyang/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell' });
    try {
        for (const width of [1440, 1330, 390]) {
            const context = await browser.newContext({ viewport: { width, height: 1000 } });
            context.setDefaultTimeout(15000);
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            let holdBugRequest = null;
            let enteredBugRequest = null;
            await page.route('**/api/v1/**', async route => {
                const url = new URL(route.request().url());
                if (url.pathname.endsWith('/images/layout-image/download')) {
                    return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') });
                }
                if (url.pathname.endsWith('/bugs') && holdBugRequest) {
                    enteredBugRequest();
                    await holdBugRequest;
                }
                try { const response = await route.fetch({ url: `${api}${url.pathname}${url.search}` }); await route.fulfill({ response }); }
                catch { if (!page.isClosed()) await route.abort().catch(() => {}); }
            });
            await page.addInitScript(token => localStorage.setItem('token', token), fixture.boss_token);
            await page.goto(`${base}/todo`);
            await page.locator('.todo-card').filter({ hasText: longTitle }).click();
            const modal = page.locator('.detail-modal-content');
            await modal.waitFor();
            assert.equal(await modal.locator('.detail-title').textContent(), longTitle);
            assert.deepEqual(await modal.locator('.detail-description').allTextContents(), [description, notes]);
            for (const selector of ['.detail-title', '.detail-description']) {
                const bounds = await modal.locator(selector).evaluateAll(elements => elements.map(element => {
                    const box = element.getBoundingClientRect();
                    const parent = element.parentElement.getBoundingClientRect();
                    return element.scrollWidth <= element.clientWidth + 1 && box.left >= parent.left && box.right <= parent.right + 1;
                }));
                assert.ok(bounds.every(Boolean), `${selector} overflows at ${width}px`);
            }
            assert.equal(await modal.locator('.detail-modal-body').evaluate(element => element.scrollWidth <= element.clientWidth + 1), true);
            await page.screenshot({ path: path.join(output, `feedback3-task-${width}.png`), animations: 'disabled' });
            await modal.locator('.detail-description').last().scrollIntoViewIfNeeded();
            await page.screenshot({ path: path.join(output, `feedback3-notes-${width}.png`), animations: 'disabled' });
            const image = modal.locator('.todo-image-thumb');
            await image.waitFor();
            await page.waitForFunction(() => document.querySelector('.todo-image-thumb')?.naturalWidth > 0);
            await modal.locator('.todo-image-trigger').click();
            await page.locator('.todo-image-viewer').waitFor();
            await page.locator('.todo-image-actions button').last().click();
            await modal.getByRole('button', { name: '编辑', exact: true }).click();
            await page.locator('.todo-editor').waitFor();
            await page.locator('.todo-editor').getByRole('button', { name: '取消', exact: true }).click();

            await page.goto(`${base}/project/${layoutProject.id}`);
            await page.locator('.project-name').waitFor();
            const heading = await page.locator('.project-name').evaluate(element => {
                const range = document.createRange(); range.selectNodeContents(element);
                const parent = element.closest('.card').getBoundingClientRect();
                const box = element.getBoundingClientRect();
                return { text: element.textContent, fits: element.scrollWidth <= element.clientWidth + 1 && box.right <= parent.right,
                    lines: range.getClientRects().length };
            });
            assert.equal(heading.text, longName);
            assert.ok(heading.fits && heading.lines > 1, `Project title overflows at ${width}px`);
            if (width > 1200) {
                const fits = await page.evaluate(() => document.querySelector('.project-name').getBoundingClientRect().right < document.querySelector('.side-info').getBoundingClientRect().left);
                assert.ok(fits, 'Project title overlaps manager');
            }
            assert.equal(await page.locator('.main-content').evaluate(element => element.scrollWidth <= element.clientWidth + 1), true, 'Project page overflows');
            await page.screenshot({ path: path.join(output, `feedback3-project-${width}.png`), animations: 'disabled' });
            const note = page.getByRole('textbox', { name: '需求对齐备注/交付物', exact: true });
            const saveNote = async (value, expectedStatus) => {
                await note.fill(value);
                const response = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().includes('/stages/'));
                await note.press('Tab');
                assert.equal((await response).status(), expectedStatus);
                await page.waitForFunction(() => !document.querySelector('input[aria-label="需求对齐备注/交付物"]')?.disabled);
            };
            await saveNote('  Document  link  ', 200);
            assert.equal(await note.inputValue(), 'Document  link');
            await saveNote('   ', 422);
            await page.getByRole('alert').filter({ hasText: '备注/交付物：请输入有效文本' }).waitFor();
            assert.equal(await note.inputValue(), 'Document  link');
            assert.equal(await page.locator('.stage-table-scroll').evaluate(element => element.scrollWidth > element.clientWidth), true);
            await page.screenshot({ path: path.join(output, `feedback3-stage-error-${width}.png`), animations: 'disabled' });
            await saveNote('', 200);
            assert.equal(await note.inputValue(), '');
            assert.equal(await note.getAttribute('aria-invalid'), 'false');
            await page.reload();
            await note.waitFor();
            assert.equal(await note.inputValue(), '');

            await page.goto(`${base}/project/${bugProject.id}/bugs`);
            const pagination = page.getByRole('navigation', { name: '分页', exact: true });
            const previous = pagination.getByRole('button', { name: '上一页', exact: true });
            const next = pagination.getByRole('button', { name: '下一页', exact: true });
            await pagination.getByText('共 31 条记录', { exact: true }).waitFor();
            assert.equal(await page.locator('tbody tr').count(), 30);
            assert.ok(await previous.isDisabled());
            assert.ok(await next.isEnabled());
            await next.click();
            await pagination.getByText('2 / 2', { exact: true }).waitFor();
            await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 1);
            assert.equal(new URL(page.url()).searchParams.get('page'), '2');
            assert.ok(await next.isDisabled());
            await page.reload();
            await pagination.getByText('2 / 2', { exact: true }).waitFor();
            await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 1);
            await previous.click();
            await pagination.getByText('1 / 2', { exact: true }).waitFor();
            await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 30);
            await page.goBack();
            await pagination.getByText('2 / 2', { exact: true }).waitFor();
            await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 1);
            await page.goForward();
            await pagination.getByText('1 / 2', { exact: true }).waitFor();
            await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 30);
            await next.click();
            await pagination.getByText('2 / 2', { exact: true }).waitFor();
            await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 1);
            const search = page.getByRole('searchbox', { name: '搜索Bug标题', exact: true });
            await search.fill('Group');
            await pagination.getByText('共 30 条记录', { exact: true }).waitFor();
            assert.equal(new URL(page.url()).searchParams.get('page'), null);
            assert.ok(await next.isDisabled());
            assert.equal(await page.locator('tbody tr').count(), 30);
            await search.fill('NoSuchBug');
            await pagination.getByText('共 0 条记录', { exact: true }).waitFor();
            assert.ok(await previous.isDisabled() && await next.isDisabled());
            await search.fill('Group_00');
            await pagination.getByText('共 1 条记录', { exact: true }).waitFor();
            await page.reload();
            await pagination.getByText('共 1 条记录', { exact: true }).waitFor();
            assert.equal(await search.inputValue(), 'Group_00');
            await page.screenshot({ path: path.join(output, `feedback3-bugs-${width}.png`), animations: 'disabled' });
            await search.fill('');
            await pagination.getByText('共 31 条记录', { exact: true }).waitFor();
            assert.ok(await next.isEnabled());
            let release;
            holdBugRequest = new Promise(resolve => { release = resolve; });
            const entered = new Promise(resolve => { enteredBugRequest = resolve; });
            await page.getByRole('button', { name: '刷新', exact: true }).click();
            await entered;
            assert.ok(await previous.isDisabled() && await next.isDisabled());
            release(); holdBugRequest = null;
            await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 30);
            assert.ok(await next.isEnabled());
            assert.equal(await page.locator('.main-content').evaluate(element => element.scrollWidth <= element.clientWidth + 1), true, 'Bug page overflows');
            assert.deepEqual(errors, []);
            console.log(`PASS ${width}px: long task/project text, stage normalization/rollback, Bug shared pagination and URL history`);
            await page.unrouteAll({ behavior: 'ignoreErrors' });
            await context.close();
        }
    } finally {
        for (const context of browser.contexts()) for (const page of context.pages()) {
            await page.screenshot({ path: path.join(output, `feedback3-failure-${page.viewportSize()?.width}.png`), animations: 'disabled' }).catch(() => {});
            await page.unrouteAll({ behavior: 'ignoreErrors' });
        }
        await browser.close();
    }
    console.log('PASS feedback3; screenshots:', output);
})().catch(error => { console.error(error); process.exitCode = 1; });
