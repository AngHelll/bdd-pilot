import * as vscode from "vscode";
import { ExecutionProfile, normalizeProfiles } from "../core/config/profiles";

const PROFILES_KEY = "bddPilot.executionProfiles";

export class ProfileStore {
  constructor(private context: vscode.ExtensionContext) {}

  list(): ExecutionProfile[] {
    return normalizeProfiles(this.context.workspaceState.get(PROFILES_KEY));
  }

  async save(profile: ExecutionProfile): Promise<void> {
    const list = this.list().filter((p) => p.id !== profile.id);
    list.push(profile);
    await this.context.workspaceState.update(PROFILES_KEY, list);
  }

  async remove(id: string): Promise<void> {
    const list = this.list().filter((p) => p.id !== id);
    await this.context.workspaceState.update(PROFILES_KEY, list);
  }
}
