/**
 * Custom Header Extension — full option + system stats + GitHub stars
 *
 * - Khung viền full-width: chào, ngày giờ, thời tiết + AQI, âm lịch + Tết,
 *   CPU/RAM/GPU/user/BTC, stars + credit
 * - Không auto-refresh → không giật terminal
 * - System stats: CPU% (đo 2 mẫu), RAM%, GPU% + nhiệt (nvidia-smi, nếu có),
 *   user OS, giá BTC (CoinGecko), stars repo pi (GitHub API)
 * - Cái nào không lấy được thì tự ẩn
 *
 * Usage: edit file này, /reload trong pi.
 * Restore built-in: xóa/rename file này, /reload.
 */

import type { ExtensionAPI, ExtensionContext, Theme } from "@mariozechner/pi-coding-agent";
import { VERSION } from "@mariozechner/pi-coding-agent";
import * as os from "node:os";
import { exec } from "node:child_process";

// ── Config ────────────────────────────────────────────────
const TZ = "Asia/Ho_Chi_Minh";
const LAT = 10.8231, LON = 106.6297; // TP. Hồ Chí Minh
const USER_NAME = "Kaiyo"; // <-- đổi tên ở đây

// Ngày Tết Nguyên Đán (dương lịch) vài năm tới
const TET_DATES = ["2027-02-06", "2028-01-26", "2029-02-13", "2030-02-03"];

const DATE_FMT = new Intl.DateTimeFormat("vi-VN", {
	timeZone: TZ, weekday: "long", day: "2-digit", month: "2-digit", year: "numeric",
});
const TIME_FMT = new Intl.DateTimeFormat("vi-VN", {
	timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false,
});
const HOUR_FMT = new Intl.DateTimeFormat("vi-VN", {
	timeZone: TZ, hour: "2-digit", hour12: false,
});
const YMD_FMT = new Intl.DateTimeFormat("en-CA", {
	timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
});

// WMO weather code → mô tả tiếng Việt
const WEATHER_CODE = new Map<number, string>([
	[0, "Trời quang"],
	[1, "Quang đãng"],
	[2, "Ít mây"],
	[3, "Nhiều mây"],
	[45, "Sương mù"], [48, "Sương mù"],
	[51, "Mưa phùn nhẹ"], [53, "Mưa phùn"], [55, "Mưa phùn dày"],
	[56, "Mưa phùn lạnh"], [57, "Mưa phùn lạnh"],
	[61, "Mưa nhẹ"], [63, "Mưa vừa"], [65, "Mưa to"],
	[66, "Mưa đá"], [67, "Mưa đá"],
	[71, "Tuyết nhẹ"], [73, "Tuyết"], [75, "Tuyết dày"], [77, "Mưa tuyết"],
	[80, "Mưa rào nhẹ"], [81, "Mưa rào"], [82, "Mưa rào to"],
	[85, "Tuyết rơi"], [86, "Tuyết rơi dày"],
	[95, "Dông"], [96, "Dông kèm mưa đá"], [99, "Dông kèm mưa đá"],
]);

const CAN = ["Giáp", "Ất", "Bính", "Đinh", "Mậu", "Kỷ", "Canh", "Tân", "Nhâm", "Quý"];
const CHI = ["Tý", "Sửu", "Dần", "Mão", "Thìn", "Tỵ", "Ngọ", "Mùi", "Thân", "Dậu", "Tuất", "Hợi"];
const canChi = (year: number) => `${CAN[(year + 6) % 10]} ${CHI[(year + 8) % 12]}`;

// ── State ─────────────────────────────────────────────────
type WeatherState =
	| { status: "loading" }
	| { status: "error" }
	| { status: "ok"; temp: number; feels: number; humidity: number; wind: number; desc: string };

type SysInfo = {
	cpu: number | null; ram: number;
	gpuUtil: number | null; gpuTemp: number | null;
	user: string;
};

let weatherState: WeatherState = { status: "loading" };
let aqi: number | null = null;
let sys: SysInfo | null = null;
let btcPrice: number | null = null;
let ghStars: number | null = null;

// ── Helpers ───────────────────────────────────────────────
async function fetchWithTimeout(url: string, ms = 10_000): Promise<Response> {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), ms);
	try {
		return await fetch(url, { signal: ctrl.signal });
	} finally {
		clearTimeout(t);
	}
}

function execCmd(cmd: string, timeoutMs: number): Promise<string> {
	return new Promise((resolve, reject) => {
		exec(cmd, { timeout: timeoutMs, windowsHide: true }, (err, stdout) => {
			if (err) reject(err);
			else resolve(stdout);
		});
	});
}

// ── Fetch ngoài (1 lần duy nhất mỗi session) ──────────────
async function fetchWeather(): Promise<void> {
	try {
		const res = await fetchWithTimeout(
			`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
			`&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
			`&wind_speed_unit=kmh&timezone=${encodeURIComponent(TZ)}`,
		);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const data = (await res.json()) as {
			current?: {
				temperature_2m: number; apparent_temperature: number;
				relative_humidity_2m: number; weather_code: number; wind_speed_10m: number;
			};
		};
		const c = data.current;
		if (!c) throw new Error("no current data");
		weatherState = {
			status: "ok", temp: c.temperature_2m, feels: c.apparent_temperature,
			humidity: c.relative_humidity_2m, wind: c.wind_speed_10m,
			desc: WEATHER_CODE.get(c.weather_code) ?? "Không rõ",
		};
	} catch {
		weatherState = { status: "error" };
	}
}

async function fetchAqi(): Promise<void> {
	try {
		const res = await fetchWithTimeout(
			`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LAT}&longitude=${LON}&current=us_aqi`,
		);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const data = (await res.json()) as { current?: { us_aqi?: number } };
		if (typeof data.current?.us_aqi === "number") aqi = Math.round(data.current.us_aqi);
	} catch {
		aqi = null;
	}
}

async function fetchBtc(): Promise<void> {
	try {
		const res = await fetchWithTimeout(
			"https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
		);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const data = (await res.json()) as { bitcoin?: { usd?: number } };
		if (typeof data.bitcoin?.usd === "number") btcPrice = Math.round(data.bitcoin.usd);
	} catch {
		btcPrice = null;
	}
}

async function fetchGhStars(): Promise<void> {
	try {
		const res = await fetchWithTimeout("https://api.github.com/repos/badlogic/pi-mono", 10_000);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const data = (await res.json()) as { stargazers_count?: number };
		if (typeof data.stargazers_count === "number") ghStars = data.stargazers_count;
	} catch {
		ghStars = null;
	}
}

function formatStars(n: number): string {
	if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
	return `${n}`;
}

// ── System stats (best-effort, thiếu thì ẩn) ───────────────
function cpuSnapshot(): { idle: number; total: number } {
	let idle = 0, total = 0;
	for (const c of os.cpus()) {
		idle += c.times.idle;
		total += c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq;
	}
	return { idle, total };
}

async function cpuUsage(sampleMs = 400): Promise<number | null> {
	try {
		const a = cpuSnapshot();
		await new Promise((r) => setTimeout(r, sampleMs));
		const b = cpuSnapshot();
		const idle = b.idle - a.idle, total = b.total - a.total;
		if (total <= 0) return null;
		return Math.round((1 - idle / total) * 100);
	} catch {
		return null;
	}
}

async function gpuInfo(): Promise<{ util: number; temp: number } | null> {
	try {
		const out = await execCmd("nvidia-smi --query-gpu=utilization.gpu,temperature.gpu --format=csv,noheader,nounits", 5000);
		const m = out.match(/(\d+)\s*,\s*(\d+)/);
		if (!m) return null;
		return { util: parseInt(m[1], 10), temp: parseInt(m[2], 10) };
	} catch {
		return null;
	}
}

function osUsername(): string {
	try {
		return os.userInfo().username;
	} catch {
		return "unknown";
	}
}

// ── Âm lịch (thuật toán Hồ Ngọc Đức, múi giờ VN = +7) ─────
function jdFromDate(dd: number, mm: number, yy: number): number {
	const a = Math.floor((14 - mm) / 12);
	const y = yy + 4800 - a;
	const m = mm + 12 * a - 3;
	let jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
	if (jd < 2299161) jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
	return jd;
}

function getNewMoonDay(k: number, timeZone: number): number {
	const T = k / 1236.85, T2 = T * T, T3 = T2 * T, dr = Math.PI / 180;
	let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
	Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
	const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
	const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
	const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
	let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * M * dr);
	C1 -= 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(2 * Mpr * dr);
	C1 -= 0.0004 * Math.sin(3 * Mpr * dr);
	C1 += 0.0104 * Math.sin(2 * F * dr) - 0.0051 * Math.sin((M + Mpr) * dr);
	C1 -= 0.0074 * Math.sin((M - Mpr) * dr) + 0.0004 * Math.sin((2 * F + M) * dr);
	C1 -= 0.0004 * Math.sin((2 * F - M) * dr) - 0.0006 * Math.sin((2 * F + Mpr) * dr);
	C1 += 0.0010 * Math.sin((2 * F - Mpr) * dr) + 0.0005 * Math.sin((2 * Mpr + M) * dr);
	let deltat: number;
	if (T < -11) deltat = 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3;
	else deltat = -0.000278 + 0.000265 * T + 0.000262 * T2;
	return Math.floor(Jd1 + C1 - deltat + 0.5 + timeZone / 24);
}

function getSunLongitude(jdn: number, timeZone: number): number {
	const T = (jdn - 2451545.5 - timeZone / 24) / 36525, T2 = T * T, dr = Math.PI / 180;
	const M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
	const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
	let DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
	DL += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.000290 * Math.sin(dr * 3 * M);
	let L = (L0 + DL) * dr;
	L -= Math.PI * 2 * Math.floor(L / (Math.PI * 2));
	return Math.floor(L / Math.PI * 6);
}

function getLunarMonth11(yy: number, timeZone: number): number {
	const off = jdFromDate(31, 12, yy) - 2415021;
	const k = Math.floor(off / 29.530588853);
	let nm = getNewMoonDay(k, timeZone);
	if (getSunLongitude(nm, timeZone) >= 9) nm = getNewMoonDay(k - 1, timeZone);
	return nm;
}

function getLeapMonthOffset(a11: number, timeZone: number): number {
	const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
	let last = 0, i = 1;
	let arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
	do {
		last = arc; i++;
		arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
	} while (arc !== last && i < 14);
	return i - 1;
}

// → [ngày, tháng, năm, nhuận?]
function convertSolar2Lunar(dd: number, mm: number, yy: number, timeZone: number): [number, number, number, number] {
	const dayNumber = jdFromDate(dd, mm, yy);
	const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853);
	let monthStart = getNewMoonDay(k + 1, timeZone);
	if (monthStart > dayNumber) monthStart = getNewMoonDay(k, timeZone);
	let a11 = getLunarMonth11(yy, timeZone), b11 = a11, lunarYear: number;
	if (a11 >= monthStart) {
		lunarYear = yy;
		a11 = getLunarMonth11(yy - 1, timeZone);
	} else {
		lunarYear = yy + 1;
		b11 = getLunarMonth11(yy + 1, timeZone);
	}
	const lunarDay = dayNumber - monthStart + 1;
	const diff = Math.floor((monthStart - a11) / 29);
	let lunarLeap = 0, lunarMonth = diff + 11;
	if (b11 - a11 > 365) {
		const leapDiff = getLeapMonthOffset(a11, timeZone);
		if (diff >= leapDiff) {
			lunarMonth = diff + 10;
			if (diff === leapDiff) lunarLeap = 1;
		}
	}
	if (lunarMonth > 12) lunarMonth -= 12;
	if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;
	return [lunarDay, lunarMonth, lunarYear, lunarLeap];
}

// ── Đếm ngược Tết ─────────────────────────────────────────
function tetCountdown(y: number, m: number, d: number): string {
	const today = Date.UTC(y, m - 1, d);
	for (const t of TET_DATES) {
		const [ty, tm, td] = t.split("-").map(Number);
		const diff = Math.round((Date.UTC(ty, tm - 1, td) - today) / 86400000);
		if (diff >= 0) {
			if (diff === 0) return "Hôm nay là mùng 1 Tết!";
			return `còn ${diff} ngày nữa đến Tết ${canChi(ty)}`;
		}
	}
	return "";
}

// ── Màu sắc ───────────────────────────────────────────────
function tempColorName(t: number): string {
	if (t >= 35) return "error";
	if (t >= 30) return "warning";
	return "success";
}

function pctColorName(p: number): string {
	if (p >= 80) return "error";
	if (p >= 50) return "warning";
	return "success";
}

function aqiInfo(a: number): [string, string] {
	if (a <= 50) return ["Tốt", "success"];
	if (a <= 100) return ["Trung bình", "warning"];
	if (a <= 150) return ["Kém cho nhóm nhạy cảm", "warning"];
	if (a <= 200) return ["Xấu", "error"];
	return ["Nguy hại", "error"];
}

function renderWeather(theme: Theme, w: WeatherState): string {
	if (w.status === "loading") return theme.fg("muted", "đang tải thời tiết…");
	if (w.status === "error") return theme.fg("muted", "không lấy được thời tiết");
	const temp = theme.bold(theme.fg(tempColorName(w.temp), `${w.temp.toFixed(1)}°C`));
	let s =
		temp +
		theme.fg("muted", ` (cảm giác ${w.feels.toFixed(1)}°C)`) +
		theme.fg("text", ` · ${w.desc}`) +
		theme.fg("muted", ` · ẩm ${Math.round(w.humidity)}%`) +
		theme.fg("muted", ` · gió ${w.wind.toFixed(1)} km/h`);
	if (aqi !== null) {
		const [label, color] = aqiInfo(aqi);
		s += theme.fg("muted", " · AQI ") + theme.bold(theme.fg(color, `${aqi}`)) + theme.fg("muted", ` (${label})`);
	}
	return s;
}

function renderSys(theme: Theme): string {
	if (!sys) return theme.fg("muted", "đang tải thông tin hệ thống…");
	const sep = theme.fg("muted", " · ");
	const parts: string[] = [];
	if (sys.cpu !== null) {
		parts.push(theme.fg("muted", "CPU ") + theme.bold(theme.fg(pctColorName(sys.cpu), `${sys.cpu}%`)));
	}
	parts.push(theme.fg("muted", "RAM ") + theme.bold(theme.fg(pctColorName(sys.ram), `${sys.ram}%`)));
	if (sys.gpuUtil !== null) {
		let g = theme.fg("muted", "GPU ") + theme.bold(theme.fg(pctColorName(sys.gpuUtil), `${sys.gpuUtil}%`));
		if (sys.gpuTemp !== null) g += " " + theme.bold(theme.fg(tempColorName(sys.gpuTemp), `${sys.gpuTemp}°C`));
		parts.push(g);
	}
	parts.push(theme.fg("muted", "user ") + theme.fg("text", sys.user));
	if (btcPrice !== null) {
		parts.push(theme.fg("muted", "BTC ") + theme.bold(theme.fg("warning", `$${btcPrice.toLocaleString("en-US")}`)));
	}
	return parts.join(sep);
}

// Chào theo giờ Hồ Chí Minh
function greeting(): string {
	const h = parseInt(HOUR_FMT.format(new Date()), 10);
	if (h >= 5 && h < 11) return "chào buổi sáng";
	if (h >= 11 && h < 13) return "chào buổi trưa";
	if (h >= 13 && h < 18) return "chào buổi chiều";
	if (h >= 18 && h < 23) return "chào buổi tối";
	return "khuya rồi còn chưa ngủ";
}

// ── Khung viền full-width ─────────────────────────────────
function visibleWidth(s: string): number {
	return s.replace(/\x1b\[[0-9;]*m/g, "").length;
}

function truncateVisible(s: string, max: number): string {
	let out = "", vis = 0, i = 0;
	while (i < s.length && vis < max) {
		if (s[i] === "\x1b") {
			const m = /^\x1b\[[0-9;]*m/.exec(s.slice(i));
			if (m) { out += m[0]; i += m[0].length; continue; }
		}
		out += s[i]; vis++; i++;
	}
	return out;
}

function frame(lines: string[], theme: Theme, width: number): string[] {
	const inner = Math.max(10, width - 4); // trừ "│ " và " │"
	const bd = (s: string) => theme.fg("accent", s);
	const top = bd("╭" + "─".repeat(inner + 2) + "╮");
	const bottom = bd("╰" + "─".repeat(inner + 2) + "╯");
	const body = lines.map((l) => {
		const w = visibleWidth(l);
		const content = w > inner ? truncateVisible(l, inner) : l + " ".repeat(inner - w);
		return bd("│ ") + content + bd(" │");
	});
	return [top, ...body, bottom];
}

// ── Header ────────────────────────────────────────────────
function buildHeader(theme: Theme, width: number): string[] {
	const title =
		theme.bold(theme.fg("accent", "π")) + "  " +
		theme.bold(theme.fg("accent", "pi")) +
		theme.fg("muted", ` v${VERSION}`) +
		theme.fg("text", `  — Hi, ${greeting()} ${USER_NAME}!`);

	const now = new Date();
	const dateLine =
		theme.bold(theme.fg("warning", DATE_FMT.format(now))) +
		theme.fg("muted", " · ") + theme.bold(theme.fg("accent", TIME_FMT.format(now))) +
		theme.fg("muted", " · Hồ Chí Minh");

	const weatherLine = renderWeather(theme, weatherState);

	// Âm lịch + đếm ngược Tết (tính theo ngày ở HCM)
	const [yy, mm, dd] = YMD_FMT.format(now).split("-").map(Number);
	const [ld, lm, ly, leap] = convertSolar2Lunar(dd, mm, yy, 7);
	const dayStr = ld === 15 ? "rằm" : ld <= 10 ? `mùng ${ld}` : `ngày ${ld}`;
	const lunarStr = `${dayStr} tháng ${leap ? "nhuận " : ""}${lm} năm ${canChi(ly)}`;
	const lifeLine =
		theme.fg("muted", "Âm lịch: ") + theme.fg("text", lunarStr) +
		theme.fg("muted", " · ") + theme.bold(theme.fg("warning", tetCountdown(yy, mm, dd)));

	const sysLine = renderSys(theme);

	// Dòng cuối: stars + credit, căn phải
	const inner = Math.max(10, width - 4);
	let credit = theme.fg("muted", "config by kaiyo");
	if (ghStars !== null) {
		credit = theme.fg("muted", "★ ") + theme.bold(theme.fg("warning", formatStars(ghStars))) +
			theme.fg("muted", " · ") + credit;
	}
	const creditLine = " ".repeat(Math.max(0, inner - visibleWidth(credit))) + credit;

	return frame([title, dateLine, weatherLine, lifeLine, sysLine, creditLine], theme, width);
}

function applyHeader(ctx: ExtensionContext) {
	if (!ctx.hasUI) return;
	ctx.ui.setHeader((_tui, theme) => ({
		render(width: number): string[] {
			return buildHeader(theme, width);
		},
		invalidate() {},
	}));
}

// ── Extension ─────────────────────────────────────────────
export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		if (!ctx.hasUI) return;
		weatherState = { status: "loading" };
		aqi = null; sys = null; btcPrice = null; ghStars = null;
		applyHeader(ctx);
		// Đo + fetch xong hết thì vẽ lại 1 lần duy nhất, sau đó đứng yên
		void (async () => {
			const [cpu, gpu] = await Promise.all([cpuUsage(400), gpuInfo()]);
			sys = {
				cpu,
				ram: Math.round((1 - os.freemem() / os.totalmem()) * 100),
				gpuUtil: gpu?.util ?? null,
				gpuTemp: gpu?.temp ?? null,
				user: osUsername(),
			};
			await Promise.all([fetchWeather(), fetchAqi(), fetchBtc(), fetchGhStars()]);
			applyHeader(ctx);
		})();
	});

	pi.registerCommand("builtin-header", {
		description: "Restore the built-in startup header",
		handler: async (_args, ctx) => {
			ctx.ui.setHeader(undefined);
			ctx.ui.notify("Built-in header restored", "info");
		},
	});
}
