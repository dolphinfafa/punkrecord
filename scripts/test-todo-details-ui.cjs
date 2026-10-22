/* Todo details and Bug note editing against the disposable SQLite fixture only. */
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
    const output = process.env.UI_ARTIFACT_DIR || '/tmp/punkrecord-ui';
    fs.mkdirSync(output, { recursive: true });
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'],
        executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/home/zheyang/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell' });
    try {
        for (const width of [1440, 390]) {
            const cases = [
                { label: '无描述备注', description: null, notes: null, expected: ['暂无描述', '暂无备注'] },
                { label: '只有描述', description: '描述\n第二行', notes: null, expected: ['描述\n第二行', '暂无备注'] },
                { label: '只有备注', description: null, notes: '备注\n第二行', expected: ['暂无描述', '备注\n第二行'] },
                { label: '显式清空', description: '', notes: '', link: { type: 'bug', notes: '不可复活的旧备注' }, expected: ['暂无描述', '暂无备注'] },
                { label: '旧Bug备注', description: '实际问题', notes: null, link: { type: 'bug', notes: '历史备注\n第二行' }, expected: ['实际问题', '历史备注\n第二行'] },
            ];
            for (const item of cases) {
                item.title = `详情回归 ${width} ${item.label}`;
                item.row = await request('/todo', 'POST', { title: item.title, description: item.description, notes: item.notes,
                    link: item.link, assignee_user_id: boss.id, due_at: '2099-01-01T18:00:00' });
            }
            const context = await browser.newContext({ viewport: { width, height: 1000 } });
            context.setDefaultTimeout(15000);
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.route('**/api/v1/**', async route => {
                const url = new URL(route.request().url());
                try { const response = await route.fetch({ url: `${api}${url.pathname}${url.search}` }); await route.fulfill({ response }); }
                catch { if (!page.isClosed()) await route.abort().catch(() => {}); }
            });
            await page.addInitScript(token => localStorage.setItem('token', token), fixture.boss_token);
            const modal = page.locator('.detail-modal-content');
            const checkModal = async expected => {
                await modal.waitFor();
                assert.equal(await modal.getByRole('heading', { name: '描述', exact: true }).count(), 1);
                assert.equal(await modal.getByRole('heading', { name: '备注', exact: true }).count(), 1);
                assert.deepEqual(await modal.locator('.detail-description').allTextContents(), expected);
                assert.ok(await modal.locator('.detail-modal-body').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
            };
            await page.goto(`${base}/todo`);
            for (const view of ['看板视图', '全部列表']) {
                await page.getByRole('button', { name: view, exact: true }).click();
                for (const item of cases) {
                    await page.locator(view === '看板视图' ? '.todo-card' : '.todo-item').filter({ hasText: item.title }).click();
                    await checkModal(item.expected);
                    if (view === '看板视图' && item === cases[0]) {
                        await page.screenshot({ path: path.join(output, `todo-details-empty-${width}.png`), animations: 'disabled' });
                    }
                    await modal.locator('.modal-close-btn').click();
                }
            }
            const item = cases[0];
            for (const [description, notes] of [['修改描述\n保留换行', '修改备注'], ['', '']]) {
                await page.locator('.todo-item').filter({ hasText: item.title }).click();
                await modal.getByRole('button', { name: '编辑', exact: true }).click();
                const editor = page.locator('.todo-editor');
                await editor.getByLabel('描述', { exact: true }).fill(description);
                await editor.getByLabel('备注', { exact: true }).fill(notes);
                await editor.getByRole('button', { name: '保存', exact: true }).click();
                await editor.waitFor({ state: 'hidden' });
                const saved = await request(`/todo/${item.row.id}`);
                assert.deepEqual([saved.description, saved.notes], [description, notes]);
                await page.reload();
                await page.locator('.todo-card').filter({ hasText: item.title }).click();
                await checkModal([description || '暂无描述', notes || '暂无备注']);
                await modal.locator('.modal-close-btn').click();
                await page.getByRole('button', { name: '全部列表', exact: true }).click();
            }
            const bugTitle = `备注同步 ${width}`;
            await page.goto(`${base}/project/${fixture.project_id}/bugs`);
            await page.getByRole('button', { name: '新建 Bug', exact: true }).click();
            await page.getByLabel('Bug 标题', { exact: true }).fill(bugTitle);
            await page.getByRole('combobox', { name: /^测试员/ }).selectOption(boss.id);
            await page.getByRole('combobox', { name: /^开发人员（待办接收人）/ }).selectOption(fixture.employee_id);
            await page.locator('input[type="date"][required]').fill('2099-01-01');
            const bugNotes = page.getByRole('textbox', { name: /^备注/ });
            await bugNotes.fill('Bug独立备注');
            const created = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/todo'));
            await page.getByRole('button', { name: '确认创建并同步待办', exact: true }).click();
            const bug = (await (await created).json()).data;
            assert.equal(bug.notes, 'Bug独立备注');
            assert.equal(bug.link.notes, bug.notes);
            const bugRow = page.getByRole('row').filter({ hasText: `[BUG] ${bugTitle}` });
            await bugRow.getByRole('button', { name: '编辑', exact: true }).click();
            assert.equal(await bugNotes.inputValue(), 'Bug独立备注');
            await bugNotes.fill('');
            const updated = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().endsWith(`/todo/${bug.id}`));
            await page.getByRole('button', { name: '保存修改', exact: true }).click();
            const cleared = (await (await updated).json()).data;
            assert.deepEqual([cleared.description, cleared.notes, cleared.link.notes], ['', '', '']);
            await page.goto(`${base}/todo`);
            await page.getByRole('button', { name: /^团队任务/ }).click();
            await page.locator('.todo-card').filter({ hasText: `[BUG] ${bugTitle}` }).click();
            await checkModal(['暂无描述', '暂无备注']);
            await page.screenshot({ path: path.join(output, `todo-details-team-${width}.png`), animations: 'disabled' });
            assert.deepEqual(errors, []);
            console.log(`PASS ${width}px: optional detail fields, board/list, legacy notes, edit/clear/reload, Bug create/edit and team synchronization`);
            await page.unrouteAll({ behavior: 'ignoreErrors' });
            await context.close();
        }
    } finally {
        for (const context of browser.contexts()) for (const page of context.pages()) {
            await page.screenshot({ path: path.join(output, `todo-details-failure-${page.viewportSize()?.width}.png`), animations: 'disabled' }).catch(() => {});
            await page.unrouteAll({ behavior: 'ignoreErrors' });
        }
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
