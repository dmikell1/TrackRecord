# TrackRecord billing (RevenueCat + Apple)

Apple / RevenueCat own trials. The API does **not** grant a signup trial; new companies start `expired` until the owner starts a store trial or purchase.

## Plans

| Plan | Athletes | Recorder seats |
|------|----------|----------------|
| Core | 10 | 1 |
| Pro | 20 | 1 |
| Elite | unlimited | higher (see entitlements) |

Product IDs in App Store Connect / RevenueCat must contain `core`, `pro`, or `elite` (case-insensitive) so the API can parse the plan.

## Keys

| Surface | Key | Prefix |
|---------|-----|--------|
| Mobile (local / Test Store) | `EXPO_PUBLIC_REVENUECAT_API_KEY` | `test_` |
| Mobile (TestFlight / production) | `EXPO_PUBLIC_REVENUECAT_API_KEY` | `appl_` |
| API webhook auth | `REVENUECAT_WEBHOOK_SECRET` | any strong secret |
| API (optional server tools) | `REVENUECAT_SECRET_API_KEY` | `sk_` — never in the app |

Set mobile keys per EAS profile with secrets named `EXPO_PUBLIC_REVENUECAT_API_KEY` (development → `test_…`, preview/production → `appl_…`).

## Webhook

- Endpoint: `POST /billing/revenuecat/webhook`
- Header: `Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>`
- Outside `local` / `testing`, an empty secret returns `503 webhook_secret_unconfigured`
- Production boot requires a non-empty secret (`ENVIRONMENT_NAME=production`)

Configure the same bearer value in the RevenueCat dashboard webhook settings.

## Free trials (ASC + RevenueCat)

1. In App Store Connect, add an **introductory offer → free trial** on each subscription product (Core / Pro / Elite, monthly and yearly if offered).
2. Attach products to the RevenueCat offering packages the app loads.
3. On purchase, RevenueCat should report entitlement `periodType` / webhook `period_type` = `TRIAL`.
4. Client sync and webhook set company `subscription_status = trial` and `trial_ends_at` from the store expiration.
5. When the trial converts, period becomes `NORMAL` → status `active`.

**Note:** RevenueCat Test Store often does **not** report `TRIAL`. Use Apple Sandbox (or `pnpm billing:test set --state=trial`) to verify trial UI.

## Local / fake testing (no Apple)

```bash
cd trackrecord-api
pnpm billing:test status --email=you@example.com
pnpm billing:test set --state=expired --email=you@example.com
pnpm billing:test set --state=trial --plan=pro --email=you@example.com
pnpm billing:test webhook --event=purchase --plan=pro --email=you@example.com
pnpm billing:test webhook --event=expire --email=you@example.com
pnpm billing:test fill-athletes --plan=core --email=you@example.com
```

Reload the mobile app after DB changes so GraphQL refetches `company.subscription`.

## Manual ops checklist (launch)

- [x] ASC intro free trials on all subscription products
- [x] RevenueCat products + entitlements + Current offering (6 packages)
- [ ] Prod API: `REVENUECAT_WEBHOOK_SECRET` set; RC webhook Authorization matches
- [x] EAS: `appl_` key for preview/production builds (`EXPO_PUBLIC_REVENUECAT_API_KEY`)
- [ ] Live Terms / Privacy at trackrecord.app
- [ ] Apple Sandbox trial E2E (`status: trial` after purchase) — Test Store cannot prove this
- [ ] Sandbox matrix in `trackrecord-mobile/QA_MATRIX.md` signed off
