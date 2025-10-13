# PHP Report Card Access Prototype

This directory contains a PHP-based simulation of the report card access workflow. It complements the broader VEA portal by providing a lightweight environment to exercise the core access rules without deploying the entire Next.js stack.

## Pages

| Page | Description |
| --- | --- |
| `parent-dashboard.php` | Parent view showing Paystack payment flow, banners, and live access updates. |
| `manual-access.php` | Admin console for manually granting or revoking report card access with offline fallbacks. |
| `approve-report.php` | Simulated report approval workflow that grants manual access to selected parents on publish. |

All pages rely on `api/report_access.php` for data mutations and `includes/storage.php` for persistence.

## Storage

State is stored in `data/storage.json`. The helper will create this file automatically on first use, but you can reset it by deleting the file. Default parents, students, and sessions are seeded for demonstration.

## Paystack

Set the following environment variables before exercising the automatic payment flow:

```bash
export PAYSTACK_PUBLIC_KEY=pk_test_xxx
export PAYSTACK_SECRET_KEY=sk_test_xxx
```

If the secret key is missing, the payment verification endpoint returns an informative error and the parent dashboard displays a red banner. This allows the UI to work offline or in demo environments.

## Offline Behaviour

- The manual access page caches the latest payload in `localStorage` and reuses it if the API request fails.
- The parent dashboard polls every few seconds so toggles and approvals reflect immediately without refreshes.
- API handlers enforce that parents can only manage linked students and normalise terms (`First/Second/Third Term`) with a default session of `2024/2025`.

These behaviours mirror the production specification: payments flip access to `Payment`, manual overrides show a blue badge, and revocations take effect instantly.
