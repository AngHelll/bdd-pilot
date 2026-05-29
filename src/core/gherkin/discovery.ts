import * as fs from "fs";
import { findFiles } from "../config/projectLocator";
import { DomainGroup, FeatureInfo } from "./model";
import { groupByDomain } from "./grouping";
import { parseFeature } from "./parser";

/**
 * Walks the project directory, parses every .feature file and groups the
 * resulting features by domain. Files that fail to read/parse are skipped so a
 * single malformed file never breaks discovery.
 */
export function discoverFeatures(projectDir: string): FeatureInfo[] {
  const featurePaths = findFiles(projectDir, ".feature", 2000);
  const features: FeatureInfo[] = [];
  for (const filePath of featurePaths) {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      features.push(parseFeature(filePath, content));
    } catch {
      // Skip unreadable/invalid feature files.
    }
  }
  return features;
}

export function discoverDomains(projectDir: string): DomainGroup[] {
  return groupByDomain(discoverFeatures(projectDir));
}
