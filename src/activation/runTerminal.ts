import * as vscode from "vscode";

const TERMINAL_NAME = "BDD Pilot";

/**
 * Pseudoterminal that receives the `dotnet test` stream.
 * The child process stays in `runDotnetTest`; this only paints.
 */
class RunPty implements vscode.Pseudoterminal {
  private readonly writeEmitter = new vscode.EventEmitter<string>();
  onDidWrite = this.writeEmitter.event;
  private opened = false;
  private pending = "";

  open(): void {
    this.opened = true;
    if (this.pending.length > 0) {
      this.writeEmitter.fire(this.pending);
      this.pending = "";
    }
  }

  close(): void {
    this.opened = false;
    if (pty === this) {
      pty = undefined;
      terminal = undefined;
    }
  }

  write(data: string): void {
    if (!this.opened) {
      this.pending += data;
      return;
    }
    this.writeEmitter.fire(data);
  }
}

let pty: RunPty | undefined;
let terminal: vscode.Terminal | undefined;
let closeHooked = false;

function hookClose(): void {
  if (closeHooked) {
    return;
  }
  closeHooked = true;
  vscode.window.onDidCloseTerminal((closed) => {
    if (closed === terminal) {
      terminal = undefined;
      pty = undefined;
    }
  });
}

function ensure(): RunPty {
  if (pty && terminal) {
    return pty;
  }
  pty = new RunPty();
  terminal = vscode.window.createTerminal({ name: TERMINAL_NAME, pty });
  hookClose();
  return pty;
}

/** Pseudoterminals advance the cursor with CR+LF. */
function toPty(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");
}

export function writeRunTerminal(text: string): void {
  if (text.length === 0) {
    return;
  }
  ensure().write(toPty(text));
}

/** `preserveFocus` true matches OutputChannel.show(true): visible, editor keeps focus. */
export function showRunTerminal(preserveFocus = true): void {
  ensure();
  terminal?.show(preserveFocus);
}
