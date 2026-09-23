/**
 * smart-read.ts
 *
 * Prevents agents from using shell commands just to read files.
 *
 * Converts / blocks:
 *   cat file.ts
 *   type file.ts
 *   Get-Content file.ts
 *   head file.ts
 *   tail file.ts
 *
 * The agent is instructed to use Pi's native `read` tool instead.
 *
 * IMPORTANT:
 * This intentionally does NOT touch commands involving:
 *   - pipes |
 *   - redirects > < >>
 *   - && / ||
 *   - command substitution
 *   - heredocs
 *   - multiple shell operations
 */

function isSimpleFileRead(command: string): {
  detected: boolean;
  file?: string;
  operation?: string;
} {
  let cmd = command.trim();

  // Remove one layer of surrounding quotes.
  if (
    (cmd.startsWith('"') && cmd.endsWith('"')) ||
    (cmd.startsWith("'") && cmd.endsWith("'"))
  ) {
    cmd = cmd.slice(1, -1).trim();
  }

  // Never interfere with compound shell commands.
  if (
    /[|><]|&&|\|\||;/.test(cmd) ||
    /\$\(|`/.test(cmd) ||
    /<<-?/.test(cmd)
  ) {
    return { detected: false };
  }

  /*
   * Unix:
   *
   * cat file
   * cat ./file
   * cat "file name.ts"
   */
  let match = cmd.match(
    /^cat\s+(?:"([^"]+)"|'([^']+)'|(\S+))\s*$/i,
  );

  if (match) {
    return {
      detected: true,
      operation: "cat",
      file: match[1] ?? match[2] ?? match[3],
    };
  }

  /*
   * Windows CMD:
   *
   * type file
   * type "file name.ts"
   */
  match = cmd.match(
    /^type\s+(?:"([^"]+)"|'([^']+)'|(\S+))\s*$/i,
  );

  if (match) {
    return {
      detected: true,
      operation: "type",
      file: match[1] ?? match[2] ?? match[3],
    };
  }

  /*
   * PowerShell:
   *
   * Get-Content file
   * gc file
   * cat file
   */
  match = cmd.match(
    /^(?:Get-Content|gc)\s+(?:"([^"]+)"|'([^']+)'|(\S+))\s*$/i,
  );

  if (match) {
    return {
      detected: true,
      operation: "Get-Content",
      file: match[1] ?? match[2] ?? match[3],
    };
  }

  /*
   * head:
   *
   * head file
   * head -n 100 file
   * head -100 file
   */
  match = cmd.match(
    /^head\s+(?:(?:-n\s*)?(\d+)\s+)?(?:"([^"]+)"|'([^']+)'|(\S+))\s*$/i,
  );

  if (match) {
    return {
      detected: true,
      operation: match[1] ? `head -${match[1]}` : "head",
      file: match[2] ?? match[3] ?? match[4],
    };
  }

  /*
   * tail:
   *
   * tail file
   * tail -n 100 file
   * tail -100 file
   */
  match = cmd.match(
    /^tail\s+(?:(?:-n\s*)?(\d+)\s+)?(?:"([^"]+)"|'([^']+)'|(\S+))\s*$/i,
  );

  if (match) {
    return {
      detected: true,
      operation: match[1] ? `tail -${match[1]}` : "tail",
      file: match[2] ?? match[3] ?? match[4],
    };
  }

  return { detected: false };
}

export default function smartRead(pi: any) {
  pi.on("tool_call", async (event: any, ctx: any) => {
    // Only inspect bash calls.
    if (event.toolName !== "bash") {
      return;
    }

    const command =
      event.input?.command ??
      event.input?.cmd ??
      "";

    if (
      typeof command !== "string" ||
      !command.trim()
    ) {
      return;
    }

    const result = isSimpleFileRead(command);

    if (!result.detected || !result.file) {
      return;
    }

    const file = result.file;

    /*
     * Stop bash from executing.
     *
     * We deliberately don't execute `read` ourselves.
     * The model gets a clear correction and can issue the
     * native Pi `read` tool on its next tool call.
     */
    return {
      block: true,
      reason:
        `smart-read: "${result.operation}" is a file-reading operation. ` +
        `Do not use bash to read files. ` +
        `Use the native "read" tool instead: ` +
        `read({ path: ${JSON.stringify(file)} })`,
    };
  });
}
