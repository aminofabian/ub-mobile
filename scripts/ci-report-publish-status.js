#!/usr/bin/env node
/**
 * Reports tenant mobile build progress to the API (GitHub Actions).
 * Usage: node scripts/ci-report-publish-status.js <building|submitted|failed>
 *
 * Env: TENANT_SLUG, API_PUBLIC_BASE_URL, MOBILE_PUBLISH_CALLBACK_SECRET
 * Optional: WORKFLOW_RUN_URL, PUBLISH_ERROR
 */
async function main() {
  const status = process.argv[2]?.trim();
  const slug = process.env.TENANT_SLUG?.trim();
  const apiBase = process.env.API_PUBLIC_BASE_URL?.trim().replace(/\/$/, '');
  const secret = process.env.MOBILE_PUBLISH_CALLBACK_SECRET?.trim();
  const workflowUrl = process.env.WORKFLOW_RUN_URL?.trim();
  const lastError = process.env.PUBLISH_ERROR?.trim();

  if (!status || !['building', 'submitted', 'failed'].includes(status)) {
    console.error('Usage: node ci-report-publish-status.js <building|submitted|failed>');
    process.exit(1);
  }

  if (!slug || !apiBase || !secret) {
    console.log('Skipping publish status callback (TENANT_SLUG, API_PUBLIC_BASE_URL, or secret not set)');
    process.exit(0);
  }

  const body = { slug, status };
  if (workflowUrl) {
    body.workflowUrl = workflowUrl;
  }
  if (lastError) {
    body.lastError = lastError;
  }

  const response = await fetch(`${apiBase}/webhooks/mobile-publish/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Mobile-Publish-Secret': secret,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Callback failed (${response.status}): ${text}`);
  }

  console.log(`Reported publish status "${status}" for ${slug}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
