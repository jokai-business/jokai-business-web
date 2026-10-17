import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { login } from '../e2e/helpers';

const routes = [
  '/api/v1/dashboard',
  '/api/v1/customers',
  '/api/v1/opportunities',
  '/api/v1/projects',
  '/api/v1/quotes',
  '/api/v1/invoices',
];
type Sample = { route: string; ms: number; status: number; valid: boolean };

function metrics(samples: Sample[]) {
  const durations = samples.map(s => s.ms).sort((a, b) => a - b);
  const percentile = (p: number) => Math.round(durations[Math.ceil(durations.length * p) - 1] ?? 0);
  return {
    requests: samples.length,
    errors: samples.filter(s => !s.valid).length,
    p50Ms: percentile(0.5), p95Ms: percentile(0.95), p99Ms: percentile(0.99),
    maxMs: Math.round(durations.at(-1) ?? 0),
    statuses: samples.reduce<Record<string, number>>((counts, s) => {
      counts[String(s.status)] = (counts[String(s.status)] ?? 0) + 1;
      return counts;
    }, {}),
  };
}

test('authenticated business reads meet the local concurrency baseline', async ({ page, request }, testInfo) => {
  const headers = await login(page, 'admin@example.test');
  // End background browser traffic; keep only the captured in-memory test token.
  await page.close();
  async function read(route: string): Promise<Sample> {
    const start = performance.now();
    let status = 0;
    let valid = false;
    try {
      const response = await request.get(route, { headers, timeout: 10_000, maxRedirects: 0 });
      try {
        status = response.status();
        const body = await response.json();
        valid = status === 200 && body.data != null && (
          route === '/api/v1/dashboard'
            ? typeof body.data.today === 'string'
            : Array.isArray(body.data)
        );
      } finally {
        await response.dispose();
      }
    } catch {
      // Do not persist raw network exceptions, authorization headers or response data.
    }
    return { route, ms: performance.now() - start, status, valid };
  }

  for (const route of routes) {
    const sample = await read(route);
    expect(sample.valid, `Warm-up failed for ${route} (HTTP ${sample.status})`).toBe(true);
  }
  const phases = [];
  for (const concurrency of [1, 5, 10]) {
    const samples: Sample[] = [];
    const started = performance.now();
    await Promise.all(Array.from({ length: concurrency }, async (_, worker) => {
      for (let step = 0; step < routes.length * 5; step++) {
        samples.push(await read(routes[(step + worker) % routes.length]));
        // At most about 33 requests/sec at ten workers, below the API's 100/sec limiter.
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }));
    const elapsedSeconds = (performance.now() - started) / 1000;
    phases.push({
      concurrency, elapsedSeconds: Number(elapsedSeconds.toFixed(2)),
      requestsPerSecond: Number((samples.length / elapsedSeconds).toFixed(2)),
      ...metrics(samples),
      routes: routes.map(route => ({ route, ...metrics(samples.filter(s => s.route === route)) })),
    });
  }
  const report = {
    measuredAt: new Date().toISOString(),
    scope: 'Local read-only HTTP baseline, one administrator identity, existing fixture data; not production capacity.',
    thresholds: { errors: 0, routeP95Ms: 1500 },
    phases,
  };
  const reportPath = testInfo.outputPath('load-smoke.json');
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  await testInfo.attach('Sanitized load baseline', { path: reportPath, contentType: 'application/json' });
  for (const phase of phases) {
    console.log(`Concurrency ${phase.concurrency}: ${phase.requests} reads, ${phase.errors} errors, p95 ${phase.p95Ms}ms, ${phase.requestsPerSecond} req/s`);
    expect(phase.requests).toBe(phase.concurrency * routes.length * 5);
    expect.soft(phase.errors, `Concurrency ${phase.concurrency}: unexpected responses/timeouts`).toBe(0);
    for (const route of phase.routes) {
      expect.soft(route.p95Ms, `Concurrency ${phase.concurrency}: ${route.route} p95`).toBeLessThanOrEqual(1500);
    }
  }
});
