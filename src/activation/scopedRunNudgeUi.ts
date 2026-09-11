import * as vscode from "vscode";
import { DomainGroup } from "../core/gherkin/model";
import { TagGroup } from "../core/gherkin/groupByTag";
import { MessageKey } from "../core/i18n";
import { RunTarget } from "../core/runner/filterBuilder";
import {
  countLeavesInDomain,
  countLeavesInTagGroup,
  shouldSuggestScopedRunBeforeAll,
} from "../core/runner/scopedRunNudge";
import { TreeGroupBy } from "../providers/treeSettings";

/** In-memory “Don’t ask this session” for Run All scoped nudge. */
let sessionSuppressed = false;

export function resetScopedRunNudgeSessionForTests(): void {
  sessionSuppressed = false;
}

export function isScopedRunNudgeSessionSuppressed(): boolean {
  return sessionSuppressed;
}

export type ScopedRunNudgeResult =
  | { action: "cancel" }
  | { action: "continueAll" }
  | { action: "scoped"; target: RunTarget };

export interface PromptScopedRunNudgeDeps {
  tr: (key: MessageKey, params?: Record<string, string | number>) => string;
  suggestEnabled: boolean;
  groupBy: TreeGroupBy;
  domains: DomainGroup[];
  tagGroups: TagGroup[];
  estimatedLeafCount: number;
}

/**
 * Soft pre-Run All nudge. Returns continueAll when thresholds not met or user proceeds.
 */
export async function promptScopedRunNudgeIfNeeded(
  deps: PromptScopedRunNudgeDeps,
): Promise<ScopedRunNudgeResult> {
  const containerCount =
    deps.groupBy === "tag" ? deps.tagGroups.length : deps.domains.length;

  if (
    !shouldSuggestScopedRunBeforeAll({
      containerCount,
      estimatedLeafCount: deps.estimatedLeafCount,
      suggestEnabled: deps.suggestEnabled,
      sessionSuppressed,
    })
  ) {
    return { action: "continueAll" };
  }

  const pickLabel =
    deps.groupBy === "tag"
      ? deps.tr("action.pickTagScope")
      : deps.tr("action.pickDomainScope");
  const continueLabel = deps.tr("action.continueRunAll");
  const suppressLabel = deps.tr("action.dontAskThisSession");

  const choice = await vscode.window.showWarningMessage(
    deps.tr("scopedRunNudge.message"),
    {
      modal: true,
      detail: deps.tr("scopedRunNudge.detail", {
        containers: containerCount,
        leaves: deps.estimatedLeafCount,
      }),
    },
    pickLabel,
    continueLabel,
    suppressLabel,
  );

  if (choice === undefined) {
    return { action: "cancel" };
  }
  if (choice === suppressLabel) {
    sessionSuppressed = true;
    return { action: "continueAll" };
  }
  if (choice === continueLabel) {
    return { action: "continueAll" };
  }
  if (choice !== pickLabel) {
    return { action: "cancel" };
  }

  if (deps.groupBy === "tag") {
    const picked = await vscode.window.showQuickPick(
      deps.tagGroups
        .map((group) => ({
          label: `@${group.tag}`,
          description: deps.tr("scopedRunNudge.pickCount", {
            count: countLeavesInTagGroup(group),
          }),
          group,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      { placeHolder: deps.tr("scopedRunNudge.pickTagPlaceholder") },
    );
    if (!picked) {
      return { action: "cancel" };
    }
    return { action: "scoped", target: { kind: "tag", tag: picked.group.tag } };
  }

  const picked = await vscode.window.showQuickPick(
    deps.domains
      .map((group) => ({
        label: group.name,
        description: deps.tr("scopedRunNudge.pickCount", {
          count: countLeavesInDomain(group),
        }),
        group,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    { placeHolder: deps.tr("scopedRunNudge.pickDomainPlaceholder") },
  );
  if (!picked) {
    return { action: "cancel" };
  }
  return { action: "scoped", target: { kind: "domain", group: picked.group } };
}
