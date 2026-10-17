import { expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
const accounts: { email: string; password: string }[] = JSON.parse(readFileSync(process.env.TEST_ACCOUNTS_FILE || '../jokai-business-deployment/.local/accounts.json', 'utf8'));
export async function login(page: Page, email: string) {
 const account = accounts.find(account => account.email === email)!;
 await page.goto('/');
 await page.getByRole('button', { name: 'Sign in', exact: true }).click({ timeout: 20000 });
 await page.locator('#username').fill(account.email);
 await page.locator('#password').fill(account.password);
 const meRequest = page.waitForRequest(request => request.url().endsWith('/api/v1/me') && !!request.headers()['authorization']);
 await page.locator('#kc-login').click();
 const request = await meRequest;
 await expect(page.getByRole('heading', { name: /^Welcome,/ })).toBeVisible();
 return { Authorization: request.headers()['authorization'] };
}
