# JOKAI web

Next.js 16 App Router, React, TypeScript and Tailwind. Build with `npm ci && npm run build`. Runtime uses standalone output on port 3000; the Docker image runs as the Node user.

For the complete local app, run the sibling deployment project's Compose stack. `/api/` and `/auth/` must be routed by Traefik on the same HTTPS origin. `npm run dev` alone does not provide those services.

`api/openapi.json` is a versioned copy of the API repository's canonical contract. Update it using the root sync script (or copy the released contract when repositories are split), then run `npm run generate:api`. Never edit `src/lib/api/schema.d.ts` manually.

Keycloak's adapter holds tokens in memory and refreshes before API requests. The UI renders permissions for usability; backend checks remain authoritative. Local browser tests need the generated account fixture file; use `TEST_ACCOUNTS_FILE` to override its location.

`npm run test:load` runs an opt-in, localhost-only authenticated read baseline at 1/5/10 concurrent request loops. It produces a sanitized timing report and enforces error/latency thresholds. See [Local load baseline](../docs/LOCAL_LOAD_BASELINE.md) for Docker instructions and measurement limits.
