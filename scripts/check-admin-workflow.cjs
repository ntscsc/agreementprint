const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { build } = require(process.env.ESBUILD_MODULE || 'esbuild');
const cache = new Map();
function load(name) {
  if (!name.startsWith('@/')) return require(name);
  if (cache.has(name)) return cache.get(name);
  const target = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(name.slice(2) + '.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { module: target, exports: target.exports, require: load, Date, console });
  cache.set(name, target.exports); return target.exports;
}
(async () => {
  const origin = process.env.AGREEMENT_QA_ORIGIN || 'http://localhost:3000';
  const { workflowPatch } = load('@/lib/order-workflow');
  const { buildWorkQueue } = load('@/lib/admin-work-queue');
  const stamp = new Date().toISOString(), earlier = new Date(Date.now() - 2 * 86400000).toISOString();
  let order = { orderId: 'TEST_ORDER', publicReference: 'AP-TEST', status: 'Under verification',
    ownerDetails: { fullName: 'Example Owner' }, tenantDetails: { fullName: 'Example Tenant' },
    propertyDetails: { fullAddress: '12 Example Street, Chennai' }, agreementTerms: { extraCopies: 1 },
    payment: { status: 'Paid', amount: 350 }, createdAt: earlier, updatedAt: earlier, stageChangedAt: earlier };
  const initialPayment = JSON.stringify(order.payment), writes = [];
  const queue = () => buildWorkQueue({ orders: [order, { ...order, orderId: 'WAITING', payment: { status: 'Pending' } }],
    changes: [{ requestId: 'CHANGE1', state: 'Review required', originalOrderId: 'CHANGE_ORDER', createdAt: earlier }],
    refunds: [{ requestId: 'REFUND1', orderId: 'CANCELLED_ORDER', state: 'Awaiting approval', amount: 100, createdAt: earlier }],
    custom: [{ requestId: 'CUSTOM1', name: 'Example Request', status: 'Submitted', createdAt: earlier }],
    todayCollections: [{ payment: { status: 'Paid', paidAt: stamp, amount: 700 } }],
  });
  const source = `import React, {useState} from 'react';import {createRoot} from 'react-dom/client';
    import {AdminWorkQueue} from './components/admin/AdminWorkQueue';
    import {OrderWorkflowPanel} from './components/admin/OrderWorkflowPanel';
    const root=createRoot(document.getElementById('root'));
    function Workflow(){const [order,setOrder]=useState(window.testOrder);return <><button onClick={()=>window.renderTest('queue')}>Back to work queue</button><OrderWorkflowPanel key={order.updatedAt} order={order} onSaved={setOrder} courierPartners={['Test Courier']}/></>;}
    window.renderTest=(mode)=>root.render(<main className="admin-portal admin-tidy mx-auto max-w-6xl space-y-5 p-4">{mode==='workflow'?<Workflow/>:<AdminWorkQueue summaryOnly={mode==='reports'} onOpenOrder={order=>{window.testOrder=order;window.renderTest('workflow');}} onOpenSection={(section,id)=>window.lastSection={section,id}}/>}</main>);`;
  const bundle = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false,
    platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'fake-auth', setup(builder) {
      builder.onResolve({ filter: /auth-context$/ }, () => ({ path: 'auth', namespace: 'qa' }));
      builder.onLoad({ filter: /.*/, namespace: 'qa' }, () => ({ contents: "const user={uid:'qa',getIdToken:async()=>'test-only'};export const useAuth=()=>({user});", loader: 'js' }));
    } }],
  });
  const html = await (await fetch(origin + '/admin')).text();
  const links = [...html.matchAll(/href="([^"]+\.css[^\"]*)"/g)].map(m => m[1].replaceAll('&amp;', '&'));
  const css = (await Promise.all(links.map(async url => (await fetch(origin + url)).text()))).join('\n');
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/admin-workflow-qa', route => route.fulfill({ contentType: 'text/html', body: `<html><head><style>${css}</style></head><body><div id="root"></div></body></html>` }));
  await page.route('**/api/admin/work-queue', route => route.fulfill({ json: queue() }));
  await page.route('**/api/admin/order-workflow*', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { order } });
    const body = route.request().postDataJSON();
    try {
      assert.equal(body.updatedAt, order.updatedAt);
      const patch = workflowPatch(order, 'Online', body, new Date(Math.max(Date.now(), Date.parse(order.updatedAt) + 1)).toISOString());
      order = Object.fromEntries(Object.entries({ ...order, ...patch }).filter(([, value]) => value !== undefined));
      writes.push(body.action); await route.fulfill({ json: { order } });
    } catch (error) { await route.fulfill({ status: 409, json: { error: error.message } }); }
  });
  await page.goto(origin + '/admin-workflow-qa', { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ content: bundle.outputFiles[0].text }); await page.evaluate(() => window.renderTest('queue'));
  await page.getByRole('heading', { name: 'AP-TEST', exact: true }).waitFor();
  assert.equal(await page.getByLabel('Work queue channel').locator('option').allTextContents().then(values => values.includes('Counter')), false);
  assert.equal(await page.getByText('Counter collections today', { exact: true }).count(), 0);
  assert.ok((await page.locator('body').innerText()).includes('Waiting for 2 days'));
  await page.locator('summary[aria-label="Filters"]').click();
  await page.getByLabel('Work queue channel').selectOption('Refunds');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Review refund', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.lastSection), { section: 'refunds', id: 'REFUND1' });
  await page.locator('summary[aria-label="Filters"]').click();
  await page.getByLabel('Work queue channel').selectOption('Online');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  fs.mkdirSync('tmp/order-desk-qa', { recursive: true });
  await page.screenshot({ path: 'tmp/order-desk-qa/queue-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: 'tmp/order-desk-qa/queue-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Verify details', exact: true }).click();
  await page.getByRole('heading', { name: 'Verify details', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Verify details', exact: true }).isDisabled(), true);
  assert.equal(await page.locator('select, input[type=date]').count(), 0);
  await page.getByLabel(/I have checked the party details/).check();
  await page.getByRole('button', { name: 'Verify details', exact: true }).click();
  await page.getByRole('heading', { name: 'Mark preparation complete', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Mark preparation complete', exact: true }).isDisabled(), true);
  await page.getByLabel('The prepared document matches the verified details.').check();
  await page.getByLabel(/The stamp denomination and all 2 copies/).check();
  await page.getByLabel('All pages, signing areas and witness space are checked.').check();
  await page.getByRole('button', { name: 'Mark preparation complete', exact: true }).click();
  await page.getByRole('heading', { name: 'Dispatch', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Dispatch', exact: true }).isDisabled(), true);
  await page.getByLabel('Tracking number', { exact: true }).fill('TRACK123');
  await page.getByLabel('Courier partner', { exact: true }).fill('');
  assert.equal(await page.getByRole('button', { name: 'Dispatch', exact: true }).isDisabled(), true);
  await page.getByLabel('Courier partner', { exact: true }).fill('Test Courier');
  await page.screenshot({ path: 'tmp/order-desk-qa/dispatch-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Dispatch', exact: true }).click();
  await page.getByRole('heading', { name: 'Complete delivery', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Complete delivery', exact: true }).isDisabled(), true);
  await page.getByLabel('Delivery has been confirmed with the customer or courier.').check();
  await page.getByRole('button', { name: 'Complete delivery', exact: true }).click();
  await page.getByRole('heading', { name: 'Complete', exact: true }).waitFor();
  assert.equal(order.status, 'Delivered'); assert.deepEqual(writes, ['verify', 'prepare', 'dispatch', 'complete']);
  assert.equal(JSON.stringify(order.payment), initialPayment);
  await page.evaluate(() => window.renderTest('reports'));
  await page.getByText('Counter collections today', { exact: true }).waitFor();
  assert.ok((await page.locator('body').innerText()).includes('700'));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: 'tmp/order-desk-qa/reports-mobile.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS queue filters, no counter orders, waiting time, mobile layout, four checked workflow actions, tracking and confirmation guards, separate collection summary. No live records changed.');
  await browser.close();
})();
