/* Uses an existing Playwright install; does not add dependencies to the repo. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/home/zheyang/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
    const base = process.env.FRONTEND_TEST_URL || 'http://127.0.0.1:15173/punkrecord';
    const api = process.env.BROWSER_FIXTURE_URL || 'http://127.0.0.1:15185';
    const fixtures = await (await fetch(`${api}/__fixtures`)).json();
    const request = async (route, token, data, method = 'POST') => {
        const response = await fetch(`${api}/api/v1${route}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : JSON.stringify(data || {}) });
        assert.equal(response.status, 200, `${method} ${route}`); return response.json();
    };
    const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/home/zheyang/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
    const output = process.env.UI_ARTIFACT_DIR || '/tmp/punkrecord-ui';
    fs.mkdirSync(output, { recursive: true });
    try {
        for (const width of [1440, 390]) {
            const rewardTitle = `浏览器奖励审核 ${width} ${Date.now()}`;
            {
                const created = await request('/todo', fixtures.boss_token, { title: rewardTitle, assignee_user_id: fixtures.employee_id, due_at: '2026-10-20T18:00:00', estimated_hours: 2 });
                await request(`/todo/${created.data.id}/submit`, fixtures.employee_token);
                await request(`/todo/${created.data.id}/approve`, fixtures.boss_token);
            }
            const context = await browser.newContext({ viewport: { width, height: 1000 } });
            context.setDefaultTimeout(20000);
            context.setDefaultNavigationTimeout(30000);
            const errors = [];
            const page = await context.newPage();
            page.on('pageerror', err => errors.push(err.message));
            await page.route('**/api/v1/**', async route => {
                const url = new URL(route.request().url());
                try { const response = await route.fetch({ url: `${api}${url.pathname}${url.search}` }); await route.fulfill({ response }); }
                catch { if (!page.isClosed()) await route.abort().catch(() => {}); }
            });
            await page.addInitScript(token => { localStorage.setItem('token', token); }, fixtures.boss_token);
            await page.goto(`${base}/beli`);
            await page.getByRole('heading', { name: '贝利', exact: true }).waitFor();
            await page.getByText('测试员工 · 贝利余额').waitFor();
            assert.equal(await page.getByText('基本工资', { exact: false }).count(), 0);
            await page.screenshot({ path: path.join(output, `beli-${width}.png`), fullPage: true, animations: 'disabled' });
            await page.getByRole('button', { name: '任务奖励', exact: true }).click();
            await page.getByRole('row').filter({ hasText: rewardTitle }).getByRole('button', { name: '审核', exact: true }).click();
            await page.getByLabel('预计工时（小时）').fill('3');
            await page.getByRole('button', { name: '确认', exact: true }).click();
            await page.getByRole('dialog').waitFor({ state: 'hidden' });
            await page.getByRole('button', { name: '贝利商城', exact: true }).click();
            await page.getByText('半天年假', { exact: true }).waitFor();
            await page.waitForFunction(() => [...document.querySelectorAll('.beli-product img')].some(img => img.complete && img.naturalWidth > 0));
            await page.screenshot({ path: path.join(output, `store-${width}.png`), fullPage: true, animations: 'disabled' });
            await page.goto(`${base}/project/${fixtures.project_id}/bugs`);
            await page.getByRole('searchbox', { name: '搜索Bug标题' }).fill('共享登录');
            await page.getByText('共 2 项', { exact: false }).waitFor();
            assert.equal(await page.getByText('[BUG] 图片问题', { exact: true }).count(), 0);
            await page.getByLabel('Bug状态', { exact: true }).selectOption('done');
            await page.getByText('共 0 项', { exact: false }).waitFor();
            await page.goBack();
            await page.getByText('共 2 项', { exact: false }).waitFor();
            assert.equal(await page.getByLabel('Bug状态', { exact: true }).inputValue(), '');
            await page.goForward();
            await page.getByText('共 0 项', { exact: false }).waitFor();
            await page.goBack();
            await page.getByText('共 2 项', { exact: false }).waitFor();
            await page.screenshot({ path: path.join(output, `bugs-${width}.png`), fullPage: true, animations: 'disabled' });
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false, 'Page overflows viewport');
            await page.goto(`${base}/todo`);
            await page.getByRole('button', { name: /新建任务/ }).click();
            await page.locator('#estimated_hours').waitFor();
            assert.equal(await page.locator('#due_at').getAttribute('required'), '');
            assert.equal(await page.locator('#estimated_hours').getAttribute('required'), null);
            assert.equal(await page.locator('#estimated_hours').getAttribute('min'), '0');
            assert.equal(await page.locator('#estimated_hours').inputValue(), '0');
            const taskTitle = `浏览器任务 ${width} ${Date.now()}`;
            await page.locator('#title').fill(taskTitle);
            await page.locator('#due_at').fill('2026-10-20');
            if (width === 390) await page.locator('#estimated_hours').fill('');
            await page.locator('#estimated_hours').scrollIntoViewIfNeeded();
            await page.screenshot({ path: path.join(output, `todo-form-${width}.png`), fullPage: true, animations: 'disabled' });
            const createdResponse = page.waitForResponse(response => response.url().endsWith('/api/v1/todo') && response.request().method() === 'POST');
            await page.locator('.todo-editor').getByRole('button', { name: '创建', exact: true }).click();
            const createdTask = await (await createdResponse).json();
            assert.equal(Number(createdTask.data.estimated_hours), 0);
            await page.locator('.todo-editor').waitFor({ state: 'hidden' });
            await page.getByText(taskTitle, { exact: true }).waitFor();
            const coloredTitle = `贝利卡片 ${width} ${Date.now()}`;
            const plainTitle = `普通卡片 ${width} ${Date.now()}`;
            const colored = await request('/todo', fixtures.boss_token, { title: coloredTitle, assignee_user_id: fixtures.employee_id, due_at: '2026-10-20T18:00:00', estimated_hours: 1.25 });
            await request('/todo', fixtures.boss_token, { title: plainTitle, assignee_user_id: fixtures.employee_id, due_at: '2026-10-20T18:00:00' });
            await page.reload();
            await page.getByRole('button', { name: /^团队任务/ }).click();
            const coloredCard = page.locator('.todo-card').filter({ hasText: coloredTitle });
            const plainCard = page.locator('.todo-card').filter({ hasText: plainTitle });
            await coloredCard.locator('.beli-task-badge').waitFor();
            await plainCard.waitFor();
            assert.equal(await coloredCard.evaluate(el => el.classList.contains('beli-task')), true);
            assert.equal(await plainCard.locator('.beli-task-badge').count(), 0);
            assert.notEqual(await coloredCard.evaluate(el => getComputedStyle(el).backgroundColor), await plainCard.evaluate(el => getComputedStyle(el).backgroundColor));
            await coloredCard.scrollIntoViewIfNeeded();
            await plainCard.scrollIntoViewIfNeeded();
            assert.equal(await coloredCard.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
            await page.screenshot({ path: path.join(output, `todo-beli-board-${width}.png`), fullPage: true, animations: 'disabled' });
            await page.getByRole('button', { name: '全部列表', exact: true }).click();
            const coloredItem = page.locator('.todo-item').filter({ hasText: coloredTitle });
            const plainItem = page.locator('.todo-item').filter({ hasText: plainTitle });
            await coloredItem.locator('.beli-task-badge').waitFor();
            await plainItem.waitFor();
            assert.notEqual(await coloredItem.evaluate(el => getComputedStyle(el).backgroundColor), await plainItem.evaluate(el => getComputedStyle(el).backgroundColor));
            await coloredItem.scrollIntoViewIfNeeded();
            await plainItem.scrollIntoViewIfNeeded();
            assert.equal(await coloredItem.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
            await page.screenshot({ path: path.join(output, `todo-beli-list-${width}.png`), fullPage: true, animations: 'disabled' });
            await page.emulateMedia({ colorScheme: 'dark' });
            assert.notEqual(await coloredItem.evaluate(el => getComputedStyle(el).backgroundColor), await plainItem.evaluate(el => getComputedStyle(el).backgroundColor));
            await page.screenshot({ path: path.join(output, `todo-beli-dark-${width}.png`), fullPage: true, animations: 'disabled' });
            await page.emulateMedia({ colorScheme: 'light' });
            for (const hours of ['0', '1.25']) {
                await coloredItem.click();
                await page.getByRole('button', { name: '编辑', exact: true }).click();
                await page.locator('#estimated_hours').fill(hours);
                await page.locator('.todo-editor').getByRole('button', { name: '保存', exact: true }).click();
                await page.locator('.todo-editor').waitFor({ state: 'hidden' });
                await page.waitForFunction(({ title, eligible }) => {
                    const card = [...document.querySelectorAll('.todo-item')].find(el => el.querySelector('.todo-title')?.textContent === title);
                    return card && card.classList.contains('beli-task') === eligible;
                }, { title: coloredTitle, eligible: Number(hours) > 0 });
                assert.equal(await coloredItem.locator('.beli-task-badge').count(), Number(hours) > 0 ? 1 : 0);
            }
            await request(`/todo/${colored.data.id}/submit`, fixtures.employee_token);
            await request(`/todo/${colored.data.id}/approve`, fixtures.boss_token);
            await page.reload();
            await page.getByRole('button', { name: /^团队任务/ }).click();
            await page.locator('.column-header').filter({ hasText: '已完成' }).click();
            await coloredCard.locator('.beli-task-badge').waitFor();
            assert.equal(await coloredCard.evaluate(el => el.classList.contains('done')), true);
            const zeroTitle = `零工时奖励 ${width} ${Date.now()}`;
            const zero = await request('/todo', fixtures.boss_token, { title: zeroTitle, assignee_user_id: fixtures.employee_id, due_at: '2026-10-20T18:00:00' });
            await request(`/todo/${zero.data.id}/submit`, fixtures.employee_token);
            await request(`/todo/${zero.data.id}/approve`, fixtures.boss_token);
            let rewardRows = await request('/beli/rewards', fixtures.boss_token, null, 'GET');
            assert.equal(rewardRows.data.some(row => row.todo_id === zero.data.id), false);
            await request(`/todo/${zero.data.id}`, fixtures.boss_token, { estimated_hours: 2 }, 'PATCH');
            await page.goto(`${base}/beli`);
            await page.getByRole('button', { name: '任务奖励', exact: true }).click();
            const zeroRow = page.getByRole('row').filter({ hasText: zeroTitle });
            await zeroRow.getByRole('button', { name: '审核', exact: true }).waitFor();
            await request(`/todo/${zero.data.id}`, fixtures.boss_token, { estimated_hours: 0 }, 'PATCH');
            await page.reload();
            await page.getByRole('button', { name: '任务奖励', exact: true }).click();
            await zeroRow.getByText('不参与奖励', { exact: true }).waitFor();
            assert.equal(await zeroRow.getByRole('button', { name: '审核', exact: true }).count(), 0);
            await page.screenshot({ path: path.join(output, `zero-hours-${width}.png`), fullPage: true, animations: 'disabled' });
            await request(`/todo/${zero.data.id}`, fixtures.boss_token, { estimated_hours: 1 }, 'PATCH');
            await page.reload();
            await page.getByRole('button', { name: '任务奖励', exact: true }).click();
            await zeroRow.getByRole('button', { name: '审核', exact: true }).waitFor();
            rewardRows = await request('/beli/rewards', fixtures.boss_token, null, 'GET');
            assert.equal(rewardRows.data.filter(row => row.todo_id === zero.data.id).length, 1);
            await page.goto(`${base}/leave`);
            await page.getByRole('heading', { name: '请假管理', exact: true }).waitFor();
            console.log(`PASS: ${width}px task/Bug/Beli/leave pages`);
            assert.deepEqual(errors, []);
            await page.unrouteAll({ behavior: 'ignoreErrors' });
            await context.close();
        }
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        context.setDefaultTimeout(20000);
        await context.addInitScript(() => Object.defineProperty(Crypto.prototype, 'randomUUID', { value: undefined, configurable: true }));
        const page = await context.newPage();
        await page.route('**/api/v1/**', async route => {
            const url = new URL(route.request().url());
            try { const response = await route.fetch({ url: `${api}${url.pathname}${url.search}` }); await route.fulfill({ response }); }
            catch { if (!page.isClosed()) await route.abort().catch(() => {}); }
        });
        await page.addInitScript(token => { localStorage.setItem('token', token); }, fixtures.employee_token);
        await page.goto(`${base}/beli`);
        await page.getByText('测试员工 · 贝利余额').waitFor();
        console.log('Employee account loaded');
        assert.equal(await page.getByRole('button', { name: '调整余额' }).count(), 0);
        await page.getByRole('button', { name: '贝利商城', exact: true }).click();
        await page.locator('.beli-product').filter({ has: page.getByRole('heading', { name: '半天年假', exact: true }) }).getByRole('button', { name: '申请兑换', exact: true }).click();
        await page.getByRole('button', { name: '确认', exact: true }).click();
        await page.getByRole('dialog').waitFor({ state: 'hidden' });
        await page.getByRole('button', { name: '兑换记录', exact: true }).click();
        await page.getByText('待审核', { exact: true }).waitFor();
        await page.getByRole('button', { name: '取消申请', exact: true }).click();
        await page.getByRole('button', { name: '确认', exact: true }).click();
        await page.getByRole('dialog').waitFor({ state: 'hidden' });
        await page.getByText('已取消', { exact: true }).first().waitFor();
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        await context.close();
        console.log('PASS: desktop/mobile Beli, reward review, store redemption/cancellation, Bug search, zero-hour defaults, reward eligibility, Beli card colors in board/list/dark/completed states and UI edits, leave routes; screenshots:', output);
    } finally {
        for (const context of browser.contexts()) for (const [index, page] of context.pages().entries()) {
            await page.screenshot({ path: path.join(output, `last-page-${page.viewportSize()?.width}-${index}.png`), fullPage: true }).catch(() => {});
        }
        for (const context of browser.contexts()) for (const page of context.pages()) await page.unrouteAll({ behavior: 'ignoreErrors' });
        await browser.close();
    }
})().catch(err => { console.error(err.message.split('Call log:')[0]); process.exitCode = 1; });
