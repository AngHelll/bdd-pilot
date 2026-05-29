import { DomainGroup, FeatureInfo } from "./model";

/**
 * Derives a domain name from a feature file path by taking the path segment
 * immediately after a "Features"/"Feature" folder (singular and plural are both
 * supported, since different frameworks use different conventions).
 *   .../Features/Trading/BuyingPower/BuyingPower.feature -> "Trading"
 *   .../Feature/TradingMx/Market/Stocks.feature          -> "TradingMx"
 *   .../Feature/Login.feature                            -> "General"
 */
export function deriveDomain(filePath: string): string {
  const segments = filePath.split(/[\\/]/).filter((s) => s.length > 0);
  const featuresIdx = segments.findIndex((s) => {
    const lower = s.toLowerCase();
    return lower === "features" || lower === "feature";
  });
  if (featuresIdx >= 0 && featuresIdx + 1 < segments.length - 1) {
    return segments[featuresIdx + 1];
  }
  return "General";
}

export function groupByDomain(features: FeatureInfo[]): DomainGroup[] {
  const map = new Map<string, FeatureInfo[]>();
  for (const feature of features) {
    const domain = deriveDomain(feature.filePath);
    const list = map.get(domain) ?? [];
    list.push(feature);
    map.set(domain, list);
  }

  return [...map.entries()]
    .map(([name, list]) => ({
      name,
      features: list.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
