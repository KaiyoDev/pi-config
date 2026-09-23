import { spawn } from "node:child_process";

const BIN =
  "C:/Users/Admin/AppData/Local/Programs/codebase-memory-mcp/codebase-memory-mcp.exe";

/**
 * OpenAI-compatible providers require every function tool
 * to have a `parameters` JSON Schema.
 *
 * Codebase Memory currently generates tools without it,
 * so we provide a permissive schema.
 */
const PARAMETERS = {
  type: "object",
  properties: {},
  additionalProperties: true,
};

async function call(
  tool: string,
  args: unknown,
  signal?: AbortSignal,
) {
  return new Promise((resolve) => {
    const child = spawn(
      BIN,
      ["cli", tool, JSON.stringify(args ?? {})],
      {
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          CBM_LOG_LEVEL: "error",
        },
      },
    );

    let out = "";

    const onAbort = () => {
      if (!child.killed) {
        child.kill();
      }
    };

    signal?.addEventListener("abort", onAbort, {
      once: true,
    });

    child.stdout.on("data", (data) => {
      out += data.toString();
    });

    child.on("error", (error) => {
      signal?.removeEventListener("abort", onAbort);

      resolve({
        error: String(
          error instanceof Error
            ? error.message
            : error,
        ),
      });
    });

    child.on("close", () => {
      signal?.removeEventListener("abort", onAbort);

      const lines = out
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          return resolve(JSON.parse(lines[i]));
        } catch {
          // Keep looking for the last valid JSON response.
        }
      }

      resolve({
        error:
          "no JSON response from codebase-memory-mcp",
      });
    });
  });
}

export default function (pi) {
  const tools = [
    "index_repository",
    "search_graph",
    "query_graph",
    "trace_path",
    "get_code_snippet",
    "get_graph_schema",
    "get_architecture",
    "search_code",
    "list_projects",
    "delete_project",
    "index_status",
    "check_index_coverage",
    "detect_changes",
    "manage_adr",
    "ingest_traces",
  ];

  for (const name of tools) {
    pi.registerTool({
      name,
      parameters: PARAMETERS,

      run: (args, ctx) =>
        call(name, args, ctx?.signal),
    });
  }
}