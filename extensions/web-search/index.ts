import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { Text } from "@mariozechner/pi-tui";
import * as fs from "node:fs";
import * as path from "node:path";
import { URL } from "node:url";

interface SearchResult {
	title: string;
	url: string;
	snippet: string;
}

interface StructuredSearchArgs {
	query?: string;
	exactPhrases?: string[];
	excludeTerms?: string[];
	site?: string;
	count?: number;
	provider?: "duckduckgo" | "exa";
}

interface BuiltSearchQuery {
	query: string;
	baseQuery?: string;
	exactPhrases: string[];
	excludeTerms: string[];
	site?: string;
}

// ── Exa Search (requires API key) ──

async function exaSearch(
	query: string,
	count: number,
	apiKey: string,
	signal?: AbortSignal,
): Promise<SearchResult[]> {
	const num = Math.min(count, 10);
	const url = new URL("https://api.exa.ai/search");

	const resp = await fetch(url.toString(), {
		method: "POST",
		signal,
		headers: {
			"Content-Type": "application/json",
			"x-api-key": apiKey,
		},
		body: JSON.stringify({
			query,
			type: "auto",
			numResults: num,
			contents: { highlights: true },
		}),
	});

	if (!resp.ok) {
		const body = await resp.text();
		throw new Error(`Exa API ${resp.status}: ${body.slice(0, 200)}`);
	}

	const data = (await resp.json()) as {
		results?: Array<{
			title?: string;
			url: string;
			highlights?: string[];
			score?: number;
		}>;
	};

	if (!data.results || data.results.length === 0) return [];

	return data.results.map((item) => ({
		title: item.title ?? item.url,
		url: item.url,
		snippet: item.highlights?.join(" ") ?? "",
	}));
}

function loadExaCredentials(): string | null {
	const envKey = process.env.EXA_API_KEY;
	if (envKey) return envKey;

	if (!fs.existsSync(AUTH_PATH)) return null;
	try {
		const config = JSON.parse(fs.readFileSync(AUTH_PATH, "utf-8"));
		const key = config.exa_api_key as string;
		if (key) return key;
	} catch {}
	return null;
}

// ── DuckDuckGo Search (HTML scraping, no API key needed) ──

async function duckduckgoSearch(
	query: string,
	count: number,
	signal?: AbortSignal,
): Promise<SearchResult[]> {
	const num = Math.min(count, 10);
	const url = new URL("https://duckduckgo.com/");
	url.searchParams.set("q", query);

	const resp = await fetch(url.toString(), {
		signal,
		headers: {
			"User-Agent":
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
			"Accept-Language": "en-US,en;q=0.9",
		},
	});

	if (!resp.ok) {
		throw new Error(`DuckDuckGo HTTP ${resp.status}`);
	}

	const html = await resp.text();

	// Parse results from DDG HTML
	const results: SearchResult[] = [];
	const resultRegex = /class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
	let match;

	while (results.length < num && (match = resultRegex.exec(html)) !== null) {
		const rawUrl = match[1]
			.replace(/&amp;/g, "&")
			.replace(/&lt;/g, "<")
			.replace(/&gt;/g, ">")
			.replace(/&quot;/g, '"')
			.replace(/&#x27;/g, "'");
		// Skip DDG internal links
		if (rawUrl.startsWith("javascript:") || rawUrl.startsWith("#")) continue;

		const title = match[2].trim();
		results.push({ title, url: rawUrl, snippet: "" });
	}

	// Try to extract snippets
	const snippetRegex = /class="result__snippet"[^>]*>([^<]+)<\/span>/g;
	const decodedHtml = html
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"');
	let snippetMatch;
	let resultIdx = 0;
	while (results.length < num && (snippetMatch = snippetRegex.exec(decodedHtml)) !== null) {
		if (resultIdx < results.length) {
			results[resultIdx].snippet = snippetMatch[1].trim();
			resultIdx++;
		}
	}

	// Fallback: if no results from regex, try to find links in result divs
	if (results.length === 0) {
		const divRegex = /class="result[^"]*"[^>]*>(.*?)<\/div>\s*<div/g;
		const linkRegex = /href="([^"]+)"/g;
		const textRegex = /<[^>]+>/g;

		let divMatch;
		while (results.length < num && (divMatch = divRegex.exec(html)) !== null) {
			const divContent = divMatch[1];
			let linkMatch;
			while ((linkMatch = linkRegex.exec(divContent)) !== null) {
				const rawUrl = linkMatch[1]
					.replace(/&amp;/g, "&")
					.replace(/&lt;/g, "<")
					.replace(/&gt;/g, ">");
				if (rawUrl.startsWith("javascript:") || rawUrl.startsWith("#") || rawUrl.includes("duckduckgo.com")) continue;
				const textOnly = divContent.replace(textRegex, "").trim().slice(0, 200);
				results.push({ title: textOnly.slice(0, 80), url: rawUrl, snippet: textOnly });
				break;
			}
		}
	}

	return results;
}

const EXT_DIR = path.dirname(new URL(import.meta.url).pathname);
const AUTH_PATH = path.join(EXT_DIR, "auth.json");

function formatResults(results: SearchResult[]): string {
	if (results.length === 0) return "No results found.";
	return results
		.map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`)
		.join("\n\n");
}

function stripWrappingQuotes(value: string): string {
	return value.length >= 2 && value.startsWith('"') && value.endsWith('"')
		? value.slice(1, -1).trim()
		: value;
}

function cleanItems(values?: string[]): string[] {
	if (!values) return [];
	return values
		.map((value) => stripWrappingQuotes(value.trim().replace(/\s+/g, " ")))
		.filter(Boolean);
}

function cleanQuery(value?: string): string | undefined {
	if (typeof value !== "string") return undefined;
	const cleaned = value.trim().replace(/\s+/g, " ");
	return cleaned || undefined;
}

function normalizeSite(site?: string): string | undefined {
	if (typeof site !== "string") return undefined;

	let value = site.trim().replace(/^site:/i, "").trim();
	if (!value) return undefined;

	try {
		const candidate = /^[a-z]+:\/\//i.test(value)
			? value
			: `https://${value}`;
		const url = new URL(candidate);
		if (url.hostname) value = url.hostname;
	} catch {}

	return value.replace(/\/+$/, "") || undefined;
}

function quoteForSearch(value: string): string {
	return `"${value.replace(/"/g, '\\"')}"`;
}

function buildSearchQuery(args: StructuredSearchArgs): BuiltSearchQuery {
	const baseQuery = cleanQuery(args.query);
	const exactPhrases = cleanItems(args.exactPhrases);
	const excludeTerms = cleanItems(args.excludeTerms);
	const site = normalizeSite(args.site);

	if (!baseQuery && exactPhrases.length === 0) {
		throw new Error(
			"At least one of 'query' or 'exactPhrases' is required.",
		);
	}

	const parts: string[] = [];
	if (baseQuery) parts.push(baseQuery);
	for (const phrase of exactPhrases) {
		parts.push(quoteForSearch(phrase));
	}
	for (const term of excludeTerms) {
		parts.push(`-${term.includes(" ") ? quoteForSearch(term) : term}`);
	}
	if (site) {
		parts.push(`site:${site}`);
	}

	return {
		query: parts.join(" "),
		baseQuery,
		exactPhrases,
		excludeTerms,
		site,
	};
}

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "web_search",
		label: "Web Search",
		description:
			"Search the web via DuckDuckGo (default) or Exa (semantic search with AI highlights). Build one search per call from a base query string, exact phrases, exclusions, and an optional site. Returns title, URL, and snippet.",
		promptSnippet:
			"Search the web via a query string plus optional exactPhrases, excludeTerms, and site. Use one tool call per search angle.",
		promptGuidelines: [
			"Use exactPhrases for exact phrase matching instead of embedding quote marks inside the main query string.",
			"Use one web_search tool call per search angle instead of batching multiple searches into one call.",
			"Default provider is DuckDuckGo (no API key needed). Use provider: 'exa' for AI-powered semantic search with highlights (requires EXA_API_KEY)."
		],

		parameters: Type.Object({
			query: Type.Optional(
				Type.String({
					description:
						"Base search query as a normal string. Prefer this for the main search wording.",
				}),
			),
			exactPhrases: Type.Optional(
				Type.Array(Type.String(), {
					description:
						"Exact phrases to match. Each item becomes a quoted phrase in the final query.",
				}),
			),
			excludeTerms: Type.Optional(
				Type.Array(Type.String(), {
					description:
						"Terms or phrases to exclude. Multi-word items are excluded as exact phrases.",
				}),
			),
			site: Type.Optional(
				Type.String({
					description:
						"Optional site/domain restriction, such as example.com or a full URL.",
				}),
			),
			count: Type.Optional(
				Type.Number({
					description: "Number of results to return (default: 5, max: 10)",
					minimum: 1,
					maximum: 10,
				}),
			),
			provider: Type.Optional(
				Type.Union([
					Type.Literal("duckduckgo"),
					Type.Literal("exa"),
				], {
					description: "Search provider: 'duckduckgo' (default, no API key) or 'exa' (semantic search with highlights, requires EXA_API_KEY)",
				}),
			),
		}),

		async execute(_toolCallId, params: StructuredSearchArgs, signal) {
			const count = params.count ?? 5;
			const built = buildSearchQuery(params);

			let results: SearchResult[];
			const provider = params.provider ?? "duckduckgo";

			if (provider === "exa") {
				const apiKey = loadExaCredentials();
				if (!apiKey) {
					throw new Error(
						`Exa provider selected but no API key found. Set EXA_API_KEY environment variable or add exa_api_key to auth.json. Get key at https://exa.ai/`,
					);
				}
				results = await exaSearch(built.query, count, apiKey, signal);
			} else {
				results = await duckduckgoSearch(built.query, count, signal);
			}

			return {
				content: [
					{
						type: "text" as const,
						text: formatResults(results),
					},
				],
				details: {
					composedQuery: built.query,
					query: built.baseQuery,
					exactPhrases: built.exactPhrases,
					excludeTerms: built.excludeTerms,
					site: built.site,
					provider,
					resultCount: results.length,
				},
			};
		},

		renderCall(args, theme, context) {
			const text =
				(context.lastComponent as Text | undefined) ??
				new Text("", 0, 0);
			const { count, provider, ...searchArgs } = args as StructuredSearchArgs;

			try {
				const built = buildSearchQuery(searchArgs);
				const display =
					built.query.length > 70
						? built.query.slice(0, 67) + "..."
						: built.query;
				const lines = [
					theme.fg("toolTitle", theme.bold("search ")) +
						theme.fg("accent", `"${display}"`),
				];
				if (provider && provider !== "duckduckgo") {
					lines.push(theme.fg("dim", `  provider: ${provider}`));
				}
				if (count && count !== 5) {
					lines.push(theme.fg("dim", `  count: ${count}`));
				}
				text.setText(lines.join("\n"));
				return text;
			} catch {
				text.setText(
					theme.fg("toolTitle", theme.bold("search ")) +
						theme.fg("error", "(invalid query)"),
				);
				return text;
			}
		},

		renderResult(result, { expanded, isPartial }, theme, context) {
			const text =
				(context.lastComponent as Text | undefined) ??
				new Text("", 0, 0);

			if (isPartial) {
				text.setText(theme.fg("warning", "Searching…"));
				return text;
			}

			if (context.isError) {
				const msg =
					result.content.find((c) => c.type === "text")?.text ||
					"Error";
				text.setText(theme.fg("error", msg));
				return text;
			}

			const details = result.details as {
				composedQuery?: string;
				resultCount?: number;
				provider?: string;
			};
			const status = theme.fg(
				"success",
				`${details?.resultCount ?? 0} results`,
			);
			if (!expanded) {
				const providerLabel = details?.provider && details.provider !== "duckduckgo"
					? theme.fg("dim", ` (${details.provider})`)
					: "";
				text.setText(status + providerLabel);
				return text;
			}

			const content =
				result.content.find((c) => c.type === "text")?.text || "";
			const preview =
				content.length > 500 ? content.slice(0, 500) + "..." : content;
			const queryLine = details?.composedQuery
				? theme.fg("dim", `query: ${details.composedQuery}`)
				: "";
			text.setText(
				[status, queryLine, theme.fg("dim", preview)]
					.filter(Boolean)
					.join("\n"),
			);
			return text;
		},
	});
}
