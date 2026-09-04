# E10 - Observability, SLOs and Operations

## Objective

Make failures diagnosable, capacity measurable and production operation repeatable.

## Telemetry

### Logs

- Structured JSON with timestamp, service, environment, tenant-safe project ID, job ID, attempt ID and trace ID.
- Error code and causal chain without secrets or full sensitive URLs.
- Explicit log truncation markers.
- Separate security audit log from operational logs.

### Metrics

- API request rate, latency and error rate.
- Queue depth, lease age, retry count and dead-letter count.
- Job duration, success, cancellation and failure category.
- Crawl URLs/sec, robots blocks, response bytes and origin throttling.
- Browser launch time, crash rate, memory and pool utilization.
- Analyzer duration, timeout and output size.
- Connector quota, freshness and sync lag.
- AI requests, tokens, cost, validation failures and rejected patches.

### Traces

- Propagate trace context from API through queue, worker, artifact and connector operations.
- Create spans for job steps, origin fetches, analyzers and verification.
- Apply sampling and URL/query redaction policies.

## Initial SLOs

- API availability: 99.9% monthly for team mode.
- Accepted-job durability: 100% persisted before acknowledgement.
- Job state freshness: 99% updated within 30 seconds while running.
- Cancellation acknowledgement: 99% within 10 seconds excluding documented non-interruptible operations.
- Report availability: 99.9% for retained completed runs.
- Connector freshness: provider-specific and visible to users.

## Implementation tasks

- [ ] Add OpenTelemetry-compatible logging, metrics and tracing ports.
- [ ] Define stable error taxonomy and user-safe messages.
- [ ] Add `/health`, `/ready` and worker heartbeat endpoints.
- [ ] Add graceful shutdown and lease release.
- [ ] Add dashboards for API, queues, workers, crawler, browser and connectors.
- [ ] Add alert rules tied to SLO burn rates and capacity.
- [ ] Add dead-letter inspection and controlled replay.
- [ ] Add runbooks for major failure classes.
- [ ] Add capacity and cost dashboards per tenant/project.
- [ ] Add feature flags and kill switches for crawler, browser and AI mutations.

## Runbooks

- Database unavailable or migration failed.
- Queue backlog and expired leases.
- Browser crash loop or Chromium incompatibility.
- Origin-wide crawl blocking or WAF responses.
- Connector token revocation or quota exhaustion.
- Object storage unavailable or checksum mismatch.
- AI provider outage or abnormal patch rejection rate.
- Suspected tenant-isolation or secret-leak incident.

## Tests

- Telemetry redaction tests with seeded secrets and personal data.
- Graceful shutdown and forced termination drills.
- Queue backlog and worker autoscaling tests.
- Dependency outage and partial degradation tests.
- Alert routing and runbook exercises.
- Backup restore and disaster recovery drills.

## Acceptance criteria

- [ ] Every job can be traced across API, queue and worker without exposing secrets.
- [ ] Readiness fails when required dependencies are unavailable.
- [ ] Operators can identify the top failure category without reading raw worker output.
- [ ] SLO dashboards and burn-rate alerts exist before production onboarding.
- [ ] Every critical alert links to an owned runbook.
- [ ] Recovery objectives are measured in a disaster recovery exercise.

