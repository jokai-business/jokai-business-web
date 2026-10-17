import { expect, test, type BrowserContext } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { login } from '../e2e/helpers';

const fixtures = [
  { label: 'primary-admin', email: 'admin@example.test', organization: 'Local Business', usersStatus: 200 },
  { label: 'primary-sales', email: 'sales@example.test', organization: 'Local Business', usersStatus: 403 },
  { label: 'other-admin', email: 'other@example.test', organization: 'Other Organization', usersStatus: 200 },
];
const routes = ['/api/v1/me', '/api/v1/users', '/api/v1/customers'];
type Sample = { actor: string; route: string; status: number; valid: boolean; ms: number };
type Actor = typeof fixtures[number] & {
  context: BrowserContext;
  headers: { Authorization: string };
  userId: string;
  organizationId: string;
};

function metrics(samples: Sample[]) {
  const durations = samples.map(s => s.ms).sort((a, b) => a - b);
  return {
    requests: samples.length,
    errors: samples.filter(s => !s.valid).length,
    p95Ms: Math.round(durations[Math.ceil(durations.length * 0.95) - 1] ?? 0),
    statuses: samples.reduce<Record<string, number>>((counts, s) => {
      counts[s.status] = (counts[s.status] ?? 0) + 1;
      return counts;
    }, {}),
  };
}

test('independent users retain tenant and role boundaries during sustained reads', async ({ browser }, testInfo) => {
  const contexts: BrowserContext[] = [];
  const actors: Actor[] = [];
  const samples: Sample[] = [];
  try {
    for (const fixture of fixtures) {
      const context = await browser.newContext({ baseURL: 'https://localhost:8443', ignoreHTTPSErrors: true });
      contexts.push(context);
      const page = await context.newPage();
      const headers = await login(page, fixture.email);
      await page.close();
      const response = await context.request.get('/api/v1/me', { headers, maxRedirects: 0, timeout: 10_000 });
      try {
        expect(response.status()).toBe(200);
        const body = await response.json();
        // Assert booleans so failed assertions cannot print private identities.
        expect(body.data.user.email === fixture.email).toBe(true);
        expect(body.data.organization.name === fixture.organization).toBe(true);
        actors.push({ ...fixture, context, headers, userId: body.data.user.id as string, organizationId: body.data.organization.id as string });
      } finally {
        await response.dispose();
      }
    }
    expect(new Set(actors.map(a => a.userId)).size).toBe(3);
    expect(actors[0].organizationId === actors[1].organizationId).toBe(true);
    expect(actors[0].organizationId !== actors[2].organizationId).toBe(true);
    const started = performance.now();
    const deadline = started + 60_000;
    await Promise.all(actors.map(async (actor, index) => {
      let step = 0;
      while (performance.now() < deadline) {
        const route = routes[step++ % routes.length];
        const before = performance.now();
        let status = 0;
        let valid = false;
        try {
          const foreignOrganization = actors[index === 2 ? 0 : 2].organizationId;
          const response = await actor.context.request.get(route, {
            headers: { ...actor.headers, 'X-Organization-ID': foreignOrganization },
            timeout: 10_000, maxRedirects: 0,
          });
          try {
            status = response.status();
            const body = await response.json();
            if (route === '/api/v1/me') {
              valid = status === 200 && body.data?.user?.id === actor.userId
                && body.data?.organization?.id === actor.organizationId;
            } else if (route === '/api/v1/users') {
              valid = status === actor.usersStatus && (actor.usersStatus === 403
                ? body.error?.code === 'FORBIDDEN'
                : Array.isArray(body.data) && body.data.every((user: { email: string }) =>
                  actor.label === 'other-admin' ? user.email === actor.email : user.email !== fixtures[2].email));
            } else {
              valid = status === 200 && Array.isArray(body.data);
            }
          } finally {
            await response.dispose();
          }
        } catch {
          // Persist no response contents, raw exceptions, IDs or tokens.
        }
        samples.push({ actor: actor.label, route, status, valid, ms: performance.now() - before });
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }));
    const groups = fixtures.flatMap(actor => routes.map(route => ({
      actor: actor.label, route, ...metrics(samples.filter(s => s.actor === actor.label && s.route === route)),
    })));
    const report = {
      measuredAt: new Date().toISOString(),
      scope: 'Local 60-second read-only run, three independent users, two organizations; not production capacity or full authorization coverage.',
      durationSeconds: Number(((performance.now() - started) / 1000).toFixed(2)),
      thresholds: { errors: 0, perActorRouteP95Ms: 1500, minRequestsPerActorRoute: 10 },
      ...metrics(samples), groups,
    };
    const path = testInfo.outputPath('multi-user-load.json');
    await writeFile(path, JSON.stringify(report, null, 2));
    await testInfo.attach('Sanitized multi-user load result', { path, contentType: 'application/json' });
    console.log(`Multi-user: ${report.requests} reads, ${report.errors} errors, p95 ${report.p95Ms}ms`);
    for (const group of groups) {
      expect.soft(group.requests, `${group.actor} ${group.route}: insufficient samples`).toBeGreaterThanOrEqual(10);
      expect.soft(group.errors, `${group.actor} ${group.route}: unexpected response or identity`).toBe(0);
      expect.soft(group.p95Ms, `${group.actor} ${group.route}: latency`).toBeLessThanOrEqual(1500);
    }
  } finally {
    await Promise.all(contexts.map(context => context.close()));
  }
});
