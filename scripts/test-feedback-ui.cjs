/* Synthetic UI regressions; all API traffic goes to the disposable fixture. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/home/zheyang/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
    const base = process.env.FRONTEND_TEST_URL || 'http://127.0.0.1:15173/punkrecord';
    const api = process.env.BROWSER_FIXTURE_URL || 'http://127.0.0.1:15185';
    const fixture = await (await fetch(`${api}/__fixtures`)).json();
    const headers = { Authorization: `Bearer ${fixture.boss_token}` };
    const request = async (route, method = 'GET', data) => {
        const response = await fetch(`${api}/api/v1${route}`, {
            method, headers: { ...headers, ...(data instanceof FormData ? {} : { 'Content-Type': 'application/json' }) },
            body: data instanceof FormData ? data : data ? JSON.stringify(data) : undefined,
        });
        assert.equal(response.status, 200, `${route}: ${await response.clone().text()}`);
        return response.json();
    };
    const template = await (await fetch(`${api}/api/v1/meeting/transcript-template`, { headers })).arrayBuffer();
    const output = process.env.UI_ARTIFACT_DIR || '/tmp/punkrecord-ui';
    fs.mkdirSync(output, { recursive: true });
    const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/home/zheyang/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell', headless: true, args: ['--no-sandbox'] });
    try {
        for (const width of [1440, 390]) {
            const context = await browser.newContext({ viewport: { width, height: 1000 } });
            context.setDefaultTimeout(20000);
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.route('**/api/v1/**', async route => {
                const url = new URL(route.request().url());
                try { const response = await route.fetch({ url: `${api}${url.pathname}${url.search}` }); await route.fulfill({ response }); }
                catch { if (!page.isClosed()) await route.abort().catch(() => {}); }
            });
            await page.addInitScript(token => localStorage.setItem('token', token), fixture.boss_token);
            await page.goto(`${base}/beli`);
            await page.getByRole('button', { name: '调整余额' }).click();
            await page.getByLabel('变动贝利').fill('0');
            await page.getByLabel('调整原因').fill('合成测试');
            let adjustmentCalls = 0;
            const trackAdjustment = request => { if (request.url().endsWith('/adjust')) adjustmentCalls++; };
            page.on('request', trackAdjustment);
            await page.getByRole('button', { name: '确认', exact: true }).click();
            await page.getByRole('alert').filter({ hasText: '调整金额不能为 0' }).waitFor();
            assert.equal(adjustmentCalls, 0);
            const amount = page.getByLabel('变动贝利');
            assert.equal(await amount.getAttribute('max'), '9999999999.99');
            await amount.fill('0.003');
            assert.equal(await amount.evaluate(input => input.validity.stepMismatch), true);
            await amount.fill('9999999999999');
            assert.equal(await amount.evaluate(input => input.validity.rangeOverflow), true);
            await page.screenshot({ path: path.join(output, `feedback-adjustment-${width}.png`), fullPage: true });
            await page.getByRole('button', { name: '取消', exact: true }).click();
            await page.getByRole('button', { name: '早会考勤', exact: true }).click();
            await page.getByLabel('考勤日期').fill('2026-10-15');
            await page.getByRole('status').filter({ hasText: '尚未启用考勤' }).waitFor();
            await page.locator('.shared-pagination button[title="下一页"]').waitFor();
            assert.equal(await page.locator('.shared-pagination button[title="下一页"]').isDisabled(), true);
            await page.screenshot({ path: path.join(output, `feedback-attendance-${width}.png`), fullPage: true });
            const longName = `长名称商品${width}` + '商品名称完整展示测试'.repeat(10);
            await request('/beli/products', 'POST', { name: longName, description: '长名称测试', kind: 'physical', price: '10.01', stock: 1 });
            await request('/beli/products', 'POST', { name: `短名称商品${width}`, description: '', kind: 'physical', price: 10, stock: 1 });
            await page.getByRole('button', { name: '贝利商城', exact: true }).click();
            await page.getByRole('heading', { name: longName }).waitFor();
            if (width === 1440) {
                const positions = await page.locator('.beli-product').evaluateAll(cards => cards.slice(0, 2).map(card => card.querySelector('button').getBoundingClientRect().bottom));
                assert.ok(Math.abs(positions[0] - positions[1]) < 2, 'Product actions must align');
            }
            await page.screenshot({ path: path.join(output, `feedback-products-${width}.png`), fullPage: true });
            await page.goto(`${base}/leave`);
            await page.locator('.shared-pagination').waitFor();
            await page.goto(`${base}/meeting`);
            await page.getByRole('button', { name: '创建会议', exact: true }).click();
            await page.locator('.upload-modal input[type="text"]').fill(`导入失败测试${width}`);
            await page.getByRole('button', { name: '文稿', exact: true }).click();
            await page.locator('.upload-modal input[type="file"]').setInputFiles({ name: 'broken.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('broken') });
            const before = await request('/meeting/records');
            await page.locator('.upload-modal-footer').getByRole('button', { name: '创建会议', exact: true }).click();
            await page.getByText('文稿解析失败，请确认文件为可复制文字的 Word/PDF').waitFor();
            assert.equal((await request('/meeting/records')).data.total, before.data.total);
            const downloadEvent = page.waitForEvent('download');
            await page.getByRole('button', { name: '下载文稿模板' }).click();
            assert.equal((await downloadEvent).suggestedFilename(), 'meeting-transcript-template.docx');
            await page.locator('.upload-modal input[type="file"]').setInputFiles({ name: 'meeting.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from(template) });
            await page.locator('.upload-modal-footer').getByRole('button', { name: '创建会议', exact: true }).click();
            const speaker = page.getByRole('combobox', { name: 'speaker_1 姓名', exact: true });
            await speaker.waitFor();
            await speaker.click();
            await page.getByRole('button', { name: '测试员工（fixture_employee）', exact: true }).click();
            await page.waitForFunction(() => document.querySelector('[aria-label="speaker_1 姓名"]')?.value === '测试员工' && !document.querySelector('[aria-label="speaker_1 姓名"]')?.disabled);
            const id = new URL(page.url()).pathname.split('/').pop();
            let saved = (await request(`/meeting/records/${id}`)).data;
            assert.equal(saved.speaker_user_mapping.speaker_1, fixture.employee_id);
            assert.ok(saved.attendees.includes('测试员工'));
            await speaker.fill('外部来宾');
            await page.getByRole('button', { name: '外部人员：外部来宾' }).click();
            await page.waitForFunction(() => document.querySelector('[aria-label="speaker_1 姓名"]')?.value === '外部来宾' && !document.querySelector('[aria-label="speaker_1 姓名"]')?.disabled);
            saved = (await request(`/meeting/records/${id}`)).data;
            assert.equal(saved.speaker_user_mapping.speaker_1, null);
            await speaker.click();
            await speaker.fill('fixture_employee');
            await page.getByRole('button', { name: '测试员工（fixture_employee）', exact: true }).click();
            await page.waitForFunction(() => !document.querySelector('[aria-label="speaker_1 姓名"]')?.disabled);
            await speaker.click();
            await page.screenshot({ path: path.join(output, `feedback-speakers-${width}.png`), fullPage: true });
            assert.equal(await speaker.evaluate(input => input.scrollWidth <= input.clientWidth + 1), true);
            const bounds = await page.getByRole('listbox', { name: '公司员工' }).boundingBox();
            assert.ok(bounds.x + bounds.width <= width, 'Employee menu overflows viewport');
            assert.deepEqual(errors, []);
            console.log(`PASS: feedback amount, products, pagination, import rollback and employee selection at ${width}px`);
            await page.unrouteAll({ behavior: 'ignoreErrors' });
            await context.close();
        }
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
