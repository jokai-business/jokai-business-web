import { test, expect } from '@playwright/test';
import { login } from './helpers';
import { randomUUID } from 'node:crypto';
test('HTTPS, liveness, readiness, unauthenticated and invalid-token rejection', async ({ request }) => {
 const health = await request.get('/health'); expect(health.status()).toBe(200);
 expect(health.headers()['strict-transport-security']).toContain('max-age=');
 expect((await request.get('/ready')).status()).toBe(200);
 const denied = await request.get('/api/v1/me'); expect(denied.status()).toBe(401);
 expect((await denied.json()).error.requestId).toMatch(/^req_/);
 expect((await request.get('/api/v1/me', { headers: { Authorization: 'Bearer forged' } })).status()).toBe(401);
});
test('administrator login, tenant-safe user creation, audit and logout', async ({ page, request }) => {
 const headers = await login(page, 'admin@example.test');
 const me = await (await request.get('/api/v1/me', { headers })).json();
 expect(me.data.organization.name).toBe('Local Business');
 expect(me.data.permissions).toContain('user.manage');
 const ownUsers = await (await request.get('/api/v1/users', { headers: { ...headers, 'X-Organization-ID': randomUUID() } })).json();
 expect(ownUsers.data.some((user: { email: string }) => user.email === 'other@example.test')).toBe(false);
 const injection = await request.post('/api/v1/users', { headers, data: { organization_id: randomUUID() } });
 expect(injection.status()).toBe(400);
 await page.getByRole('button', { name: 'Users', exact: true }).click();
 const unique = randomUUID();
 await page.getByLabel('Full name').fill('Test Team Member');
 await page.getByLabel('Email', { exact: true }).fill(`team-${unique}@example.test`);
 await page.getByLabel('Keycloak user ID').fill(unique);
 await page.getByRole('button', { name: 'Add user', exact: true }).click();
 await expect(page.getByRole('status')).toContainText('User added');
 await page.getByRole('button', { name: 'Audit log', exact: true }).click();
 await expect(page.getByRole('cell', { name: 'user.created', exact: true }).first()).toBeVisible();
 const audit = await (await request.get('/api/v1/audit-logs', { headers })).json();
 expect(audit.data.some((row: { action: string }) => row.action === 'login')).toBe(true);
 await page.getByRole('button', { name: 'Sign out', exact: true }).click();
 await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
});
test('sales role cannot read or create users or read audit', async ({ page, request }) => {
 const headers = await login(page, 'sales@example.test');
 await expect(page.getByRole('button', { name: 'Users', exact: true })).toHaveCount(0);
 expect((await request.get('/api/v1/users', { headers })).status()).toBe(403);
 expect((await request.post('/api/v1/users', { headers, data: {} })).status()).toBe(403);
 expect((await request.get('/api/v1/audit-logs', { headers })).status()).toBe(403);
});
test('second organization sees only its own membership and audit', async ({ page, request }) => {
 const headers = await login(page, 'other@example.test');
 const users = await (await request.get('/api/v1/users', { headers })).json();
 expect(users.data.map((user: { email: string }) => user.email)).toEqual(['other@example.test']);
 const me = await (await request.get('/api/v1/me', { headers })).json();
 expect(me.data.organization.name).toBe('Other Organization');
 const logs = await (await request.get('/api/v1/audit-logs', { headers })).json();
 expect(logs.data.every((row: { actorId: string }) => row.actorId === me.data.user.id)).toBe(true);
});
test('mobile sign-in page fits the viewport', async ({ page }) => {
 await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
 await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
