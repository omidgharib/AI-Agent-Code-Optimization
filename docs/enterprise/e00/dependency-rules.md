# Domain dependency rules

Normative target: `apps/workers -> domain public APIs -> contracts + platform ports`.

- Domains may import contracts and platform ports, never another domain implementation or platform adapter.
- Platform never imports analyzers, crawlers, patches, or domain implementations.
- Combined Audit invokes public Code/SEO commands and correlates immutable findings. It owns no analyzer rule and cannot override domain policy.
- Reporting consumes versioned contracts and artifact ports, not analyzer internals.
- Apps/workers are composition roots. Cross-domain links use identifiers, not shared persistence models.
- Runtime schemas validate process, network, and persistence boundaries.

E01 must enforce these rules with architecture tests. Current violations are migration work, not exceptions.
