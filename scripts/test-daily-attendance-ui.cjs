/* Uses the local browser fixture with BROWSER_ATTENDANCE_FIXTURE=1. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/home/zheyang/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
    const base = process.env.FRONTEND_TEST_URL || 'http://127.0.0.1:15173/punkrecord';
    const api = process.env.BROWSER_FIXTURE_URL || 'http://127.0.0.1:15185';
    for (const url of [base, api]) assert.ok(['127.0.0.1', 'localhost'].includes(new URL(url).hostname));
    const fixture = await (await fetch(`${api}/__fixtures`)).json();
    const setEmployeeStatus = async (status) => {
        const response = await fetch(`${api}/api/v1/iam/users/${fixture.employee_id}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${fixture.boss_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });
        assert.equal(response.status, 200, await response.text());
    };
    const output = process.env.UI_ARTIFACT_DIR || '/tmp/punkrecord-ui';
    fs.mkdirSync(output, { recursive: true });
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'],
        executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/home/zheyang/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell' });
    try {
        for (const [index, width] of [1440, 390].entries()) {
            const context = await browser.newContext({ viewport: { width, height: 900 } });
            context.setDefaultTimeout(15000);
            const page = await context.newPage();
            const errors = [];
            const dialogs = [];
            page.on('pageerror', error => errors.push(error.message));
            page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.dismiss(); });
            await page.route('**/api/v1/**', async route => {
                const url = new URL(route.request().url());
                const apiPath = url.pathname.replace(/^\/punkrecord(?=\/api\/v1\/)/, '');
                await route.fulfill({ response: await route.fetch({ url: `${api}${apiPath}${url.search}` }) });
            });
            await page.addInitScript(token => localStorage.setItem('token', token), fixture.boss_token);
            const [first, second] = fixture.attendance_meetings[index];
            await page.goto(`${base}/meeting/${first}`);
            const roster = page.getByRole('region', { name: '当日早会考勤' });
            const generate = page.getByRole('button', { name: /生成会议纪要|重新生成/ });
            const save = roster.getByRole('button', { name: '确认并保存名单' });
            const absent = roster.getByLabel('测试未发言员工', { exact: true });
            await absent.waitFor();
            assert.equal(await roster.getByText('测试停用员工', { exact: true }).count(), 0);
            assert.equal(await absent.inputValue(), 'pending');
            assert.ok(await generate.isDisabled() && await save.isDisabled());
            await roster.getByRole('button', { name: '全部标为出勤' }).click();
            await absent.selectOption('absent');
            assert.ok(await generate.isDisabled());
            const saved = page.waitForResponse(response => response.request().method() === 'PUT'
                && response.url().endsWith('/attendance-roster'));
            await save.click();
            const saveResponse = await saved;
            assert.equal(saveResponse.status(), 200, await saveResponse.text());
            await roster.getByText('已保存，未结算', { exact: true }).waitFor();
            assert.ok(await generate.isEnabled());
            assert.ok(await roster.evaluate(el => el.scrollWidth <= el.clientWidth + 1));
            await roster.screenshot({ path: path.join(output, `daily-attendance-${width}.png`), animations: 'disabled' });
            await generate.click();
            await roster.getByText('已结算', { exact: true }).waitFor();
            await page.getByText('Synthetic attendance summary', { exact: true }).waitFor();
            await page.goto(`${base}/meeting/${second}`);
            await roster.getByText('已结算', { exact: true }).waitFor();
            assert.equal(await absent.inputValue(), 'absent');
            await absent.selectOption('present');
            assert.ok(await generate.isDisabled());
            await save.click();
            await roster.getByText('已保存，未结算', { exact: true }).waitFor();
            await generate.click();
            await roster.getByText('已结算', { exact: true }).waitFor();
            await setEmployeeStatus('inactive');
            await page.reload();
            await roster.getByText('应到名单已变更', { exact: true }).waitFor();
            assert.equal(await roster.getByText('测试员工', { exact: true }).count(), 0);
            assert.ok(await generate.isDisabled() && await save.isEnabled());
            await roster.screenshot({ path: path.join(output, `daily-attendance-inactive-${width}.png`), animations: 'disabled' });
            await save.click();
            await roster.getByText('已保存，未结算', { exact: true }).waitFor();
            assert.ok(await generate.isEnabled());
            await setEmployeeStatus('active');
            assert.deepEqual(errors, []);
            assert.deepEqual(dialogs, []);
            await page.unrouteAll({ behavior: 'ignoreErrors' });
            await context.close();
            console.log(`PASS ${width}px daily roster: confirm, shared settlement, correction, inactive exclusion`);
        }
        const response = await fetch(`${api}/api/v1/beli/ledger?user_id=${fixture.attendance_silent_id}`, {
            headers: { Authorization: `Bearer ${fixture.boss_token}` },
        });
        const ledger = (await response.json()).data.filter(entry => entry.kind.startsWith('attendance'));
        assert.deepEqual(ledger.map(entry => Number(entry.amount)).sort(), [-500, -500, 500, 500]);
        console.log('PASS only the explicitly absent employee received an attendance charge and correction');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
