/* Employee salary editing against a disposable local fixture, never a business DB. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/home/zheyang/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
    const base = process.env.FRONTEND_TEST_URL || 'http://127.0.0.1:15173/punkrecord';
    const api = process.env.BROWSER_FIXTURE_URL || 'http://127.0.0.1:15185';
    assert.ok(['127.0.0.1', 'localhost'].includes(new URL(api).hostname), 'Local fixture only');
    const fixture = await (await fetch(`${api}/__fixtures`)).json();
    const output = process.env.UI_ARTIFACT_DIR || '/tmp/punkrecord-ui';
    fs.mkdirSync(output, { recursive: true });
    const readSalary = async token => {
        const response = await fetch(`${api}/api/v1/iam/users/${fixture.employee_id}/salary`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response;
    };
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'],
        executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/home/zheyang/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell' });
    try {
        for (const width of [1440, 390]) {
            for (const role of ['boss', 'l0', 'employee']) {
                const context = await browser.newContext({ viewport: { width, height: 1000 } });
                context.setDefaultTimeout(15000);
                const page = await context.newPage();
                const token = fixture[`${role}_token`];
                const errors = [];
                const salaryRequests = [];
                page.on('pageerror', error => errors.push(error.message));
                page.on('request', request => {
                    if (request.url().endsWith('/salary')) salaryRequests.push(request.method());
                });
                await page.route('**/api/v1/**', async route => {
                    const url = new URL(route.request().url());
                    const response = await route.fetch({ url: `${api}${url.pathname}${url.search}` });
                    await route.fulfill({ response });
                });
                await page.addInitScript(value => localStorage.setItem('token', value), token);
                await page.goto(`${base}/iam/users`);
                const row = page.getByRole('row').filter({ hasText: 'fixture_employee' });
                await row.getByRole('button', { name: '编辑', exact: true }).click();
                const modal = page.locator('.iam-employee-modal');
                const input = modal.getByLabel('基本月工资（元）', { exact: true });
                assert.equal(await page.getByRole('button', { name: '基本工资', exact: true }).count(), 0);
                if (role === 'employee') {
                    assert.equal(await input.count(), 0);
                    assert.equal((await readSalary(token)).status, 403);
                    assert.deepEqual(salaryRequests, []);
                } else {
                    await input.waitFor();
                    await page.waitForFunction(() => {
                        const input = document.querySelector('#employee-basic-salary');
                        return input && !input.disabled;
                    });
                    const initial = (await (await readSalary(token)).json()).data.basic_salary;
                    assert.equal(Number(await input.inputValue()), Number(initial));
                    const salary = role === 'boss' ? '13600.50' : '14200.25';
                    await input.fill(salary);
                    await input.scrollIntoViewIfNeeded();
                    assert.ok(await modal.evaluate(el => el.scrollWidth <= el.clientWidth + 1));
                    const screenshot = path.join(output, `employee-salary-${role}-${width}.png`);
                    await page.screenshot({ path: screenshot, animations: 'disabled' });
                    const saved = page.waitForResponse(response => response.request().method() === 'PATCH'
                        && response.url().endsWith(`/iam/users/${fixture.employee_id}`));
                    await modal.getByRole('button', { name: '保存', exact: true }).click();
                    const response = await saved;
                    assert.equal(response.status(), 200, await response.text());
                    assert.deepEqual(Object.keys(response.request().postDataJSON()), ['basic_salary']);
                    assert.ok(!('basic_salary' in (await response.json()).data));
                    await modal.waitFor({ state: 'hidden' });
                    assert.equal(Number((await (await readSalary(token)).json()).data.basic_salary), Number(salary));
                    await row.getByRole('button', { name: '编辑', exact: true }).click();
                    await page.waitForFunction(expected => document.querySelector('#employee-basic-salary')?.value === expected, salary);
                    assert.equal(await input.inputValue(), salary);
                }
                assert.deepEqual(errors, []);
                console.log(`PASS ${width}px ${role}: salary visibility, edit/save/reopen and no public salary leakage`);
                await page.unrouteAll({ behavior: 'ignoreErrors' });
                await context.close();
            }
        }
    } finally {
        for (const context of browser.contexts()) for (const page of context.pages()) {
            await page.screenshot({ path: path.join(output, `employee-salary-failure-${page.viewportSize()?.width}.png`) }).catch(() => {});
            await page.unrouteAll({ behavior: 'ignoreErrors' });
        }
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
