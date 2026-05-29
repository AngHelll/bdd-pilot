// Smoke test for the discovery layer against a real project.
// Usage: node scripts/smoke-discover.js <projectDir>
const { discoverDomains } = require("../out-test/core/gherkin/discovery");

const projectDir = process.argv[2];
if (!projectDir) {
  console.error("Usage: node scripts/smoke-discover.js <projectDir>");
  process.exit(1);
}

const domains = discoverDomains(projectDir);
let features = 0;
let scenarios = 0;

for (const domain of domains) {
  const domScenarios = domain.features.reduce((n, f) => n + f.scenarios.length, 0);
  features += domain.features.length;
  scenarios += domScenarios;
  console.log(`\n${domain.name}  (${domain.features.length} features, ${domScenarios} scenarios)`);
  for (const feature of domain.features) {
    const tags = feature.tags.length ? "  " + feature.tags.map((t) => "@" + t).join(" ") : "";
    console.log(`  - ${feature.name} [${feature.scenarios.length}]${tags}`);
  }
}

console.log(`\nTOTAL: ${domains.length} domains, ${features} features, ${scenarios} scenarios`);
