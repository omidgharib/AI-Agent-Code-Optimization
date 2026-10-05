# Architecture and bundle optimization

The Code Audit dashboard includes a directed module graph. Arrows go from an
importer to its dependency. Search or select a module, click a neighbor, or
filter to cycle participants. Red outlines indicate cycle participants.
Change impact counts transitive importers and excludes the selected module.
The graph shows at most 24 neighbors; the complete clickable list remains below
it. All controls support Persian and English.

## Bundle metadata

Build the target project using its existing build process and put one of these
files in its root before auditing:

- `esbuild-meta.json`: esbuild metafile containing `outputs.*.inputs.*.bytesInOutput`.
- `bundle-stats.json`: Webpack stats with `modules`, names, sizes and chunk IDs;
  or a Vite/Rollup report with `chunks`, `fileName`, and
  `modules.*.renderedLength`. A Vite report can include `"tool": "vite"`.

For Vite/Rollup, export the generated chunks' `fileName` and `modules` from the
build's `generateBundle` hook. An ordinary Vite manifest lacks module byte sizes
and is not a substitute for this report. Webpack nested modules inherit chunk
IDs from their container and are counted without counting the container again.

Metadata discovery is read-only, limited to 10 MB, and rejects files resolving
outside the repository root. The auditor does not run a build to generate it.
Unsupported or malformed data produces an explicit unavailable-data message.

The bundle panel shows module weights and percentage shares, supports search
and multi-chunk filtering, and exposes each selected module's output chunks.
These are reported module bytes, not compressed network transfer bytes.
`duplicatedBytes` retains its legacy name in JSON: it represents the combined
weight of modules present in multiple chunks, not proven removable duplication.
Review chunk semantics before extracting shared code or removing dependencies.

Bundle data is stored under `performanceLab.bundleReport` in `report.json` and
loaded directly by the dashboard. Historical reports without this field remain
readable and display an unavailable-data message.
