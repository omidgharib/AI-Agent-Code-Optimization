# Domain glossary and ownership

| Term | Definition | Owner |
| --- | --- | --- |
| Tenant | Top-level security, billing, and isolation boundary; local mode has one implicit tenant. | Platform |
| Workspace | Tenant-scoped container for projects, policies, and members. | Platform |
| Project | Workspace member identified by ID and kind; never implies a repository. | Platform identity |
| CodeProject | Project configured around a repository/ref and code policy. | Code Audit |
| SeoProject | Project configured around a site/environments; valid with URL data alone. | SEO Workspace |
| Repository | Source tree or remote VCS location inspected by Code Audit. | Code Audit |
| RepositoryLink | Optional SeoProject-to-CodeProject relationship. | Platform relationship |
| Site | Canonical web property (domain plus scope). | SEO Workspace |
| Environment | Named site deployment with base URL and crawl policy. | SEO Workspace |
| Run | Immutable execution record for one project and policy snapshot. | Platform lifecycle/domain semantics |
| Finding | Versioned evidence-backed observation. | Emitting domain |
| Proposal | Non-applied recommended change. | Emitting domain |
| Patch | Bounded source change with verification state. | Code Audit |
| Artifact | Immutable blob with classification, integrity, and retention metadata. | Platform |

Combined Audit references independent Code and SEO runs and correlates findings. It owns no analyzer logic and cannot weaken either policy.
