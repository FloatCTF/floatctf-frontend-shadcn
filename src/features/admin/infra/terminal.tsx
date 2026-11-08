/**
 * 管理端 · Web 终端（`/admin/infra/terminal`，specialized 能力，**宿主权限**）。
 *
 * ## 逃生舱声明（PUBLIC SDK GAP · class B）
 *
 * 终端**没有** SDK 抽象，必须走逃生舱（SDK 只提供 HTTP / SSE 门面）：
 * 1. `await client.adminHttp.post("/terminal/session")`
 *    → 后端 `POST /api/admin/terminal/session` 用**一次性** short-lived ticket 签发
 *      HttpOnly cookie（`path=/api/admin/terminal/ws`、SameSite=Strict、60s）；
 *    **token 绝不进 URL**：常规超管 JWT 只通过 Authorization 头发这一次。
 * 2. `new WebSocket(<ws url>)` → 后端 `GET /api/admin/terminal/ws`（actix-ws），
 *    ticket 由 cookie 携带并在升级前原子消费（一次性）。
 *    WS URL 由 `client.adminBaseUrl` 派生（http(s) → ws(s)，路径改为 `/terminal/ws`），
 *    与 Default `routes/admin/terminal.tsx` 的语义一致。
 *
 * 协议：文本帧 = 终端输入 / 后端输出；客户端还会发 `{"type":"resize","cols","rows"}`；
 * 后端可能下发二进制帧，因此 `binaryType = "arraybuffer"` 并按 Uint8Array 写入 xterm。
 *
 * 失败态：功能由 TOML `[features].enable_web_terminal` 门控，关闭时 `POST /terminal/session`
 * 返回 404；后端文案（纯文本 body）会原样显示在页面上，并给出重连入口。
 *
 * 高危约束（docs/theme.md §8.2 / 本仓库 CONVENTIONS §0.5）：会话等于宿主 shell，
 * **必须**先 `useConfirm()`（含 `confirmPhrase`）才建立连接；不自动连接。
 *
 * 主题：xterm 的背景 / 前景 / 光标 / 选区在挂载时从 CSS 令牌（`--background` 等）读取，
 * 并在亮暗切换时重设 `terminal.options.theme`，绝不写死十六进制颜色。
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal, type ITheme } from "@xterm/xterm";
import type { TFunction } from "i18next";
import { PlugZap, RotateCw, ShieldAlert, TerminalSquare } from "lucide-react";
import "@xterm/xterm/css/xterm.css";

import { FloatCTFError } from "@floatctf/sdk";

import { useClient } from "~/api/client";
import { errorText } from "~/api/errors";
import { TonePill, type PillTone } from "~/components/app/badges";
import { useConfirm } from "~/components/app/confirm";
import { MonoText, PageBody, PageHeader, SectionCard, Toolbar } from "~/components/app/page";
import { EmptyBlock } from "~/components/app/states";
import { Button } from "~/components/ui/button";
import { useDocumentTitle } from "~/lib/hooks";
import { useTheme } from "~/lib/theme";

type TerminalStatus =
	| "idle"
	| "authorizing"
	| "connecting"
	| "connected"
	| "closed"
	| "error";

const STATUS_TONE: Record<TerminalStatus, PillTone> = {
	idle: "muted",
	authorizing: "info",
	connecting: "info",
	connected: "success",
	closed: "warning",
	error: "danger",
};

const STATUS_TEXT_KEY: Record<TerminalStatus, string> = {
	idle: "adminInfra.terminal.status.idle",
	authorizing: "adminInfra.terminal.status.authorizing",
	connecting: "adminInfra.terminal.status.connecting",
	connected: "adminInfra.terminal.status.connected",
	closed: "adminInfra.terminal.status.closed",
	error: "adminInfra.terminal.status.error",
};

/** 打开宿主 shell 前必须输入的确认词（只在 UI 层）。 */
const CONNECT_PHRASE = "CONNECT";

/** oklch(L C H [/ A]) → xterm 可解析的 sRGB 字符串（令牌是 oklch，xterm 只认 hex/rgb/hsl）。 */
function oklchToCss(value: string): string | null {
	const match =
		/^oklch\(\s*([0-9.]+)(%?)\s+([0-9.]+)\s+([0-9.]+)(?:deg)?\s*(?:\/\s*([0-9.]+)(%?))?\s*\)$/i.exec(
			value.trim(),
		);
	if (!match) return null;
	const lightness = Number(match[1]) / (match[2] === "%" ? 100 : 1);
	const chroma = Number(match[3]);
	const hue = (Number(match[4]) * Math.PI) / 180;
	const alpha = match[5] ? Number(match[5]) / (match[6] === "%" ? 100 : 1) : 1;

	// OKLCh → OKLab → 线性 sRGB（Björn Ottosson 的矩阵）。
	const a = chroma * Math.cos(hue);
	const b = chroma * Math.sin(hue);
	const lPrime = lightness + 0.3963377774 * a + 0.2158037573 * b;
	const mPrime = lightness - 0.1055613458 * a - 0.0638541728 * b;
	const sPrime = lightness - 0.0894841775 * a - 1.291485548 * b;
	const l = lPrime ** 3;
	const m = mPrime ** 3;
	const s = sPrime ** 3;
	const linear = [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	];
	const channels = linear.map((channel) => {
		const clamped = Math.min(1, Math.max(0, channel));
		const encoded =
			clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
		return Math.round(encoded * 255);
	});
	return alpha >= 1
		? `rgb(${channels[0]}, ${channels[1]}, ${channels[2]})`
		: `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${Number(alpha.toFixed(3))})`;
}

/** 读取一个 CSS 颜色令牌，换算成 xterm 能解析的颜色字符串。 */
function readTokenColor(name: string): string | undefined {
	if (typeof window === "undefined") return undefined;
	const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
	if (raw.length === 0) return undefined;
	return raw.toLowerCase().startsWith("oklch(") ? (oklchToCss(raw) ?? undefined) : raw;
}

/** xterm 主题：全部来自语义令牌，亮暗切换时重新读取。 */
function readTerminalTheme(): ITheme {
	const background = readTokenColor("--background");
	const foreground = readTokenColor("--foreground");
	const border = readTokenColor("--border");
	return {
		background,
		foreground,
		cursor: foreground,
		cursorAccent: background,
		selectionBackground: border,
	};
}

/** 从 `client.adminBaseUrl` 派生 WS URL：http(s) → ws(s)，路径加 `/terminal/ws`。 */
export function buildTerminalWsUrl(adminBaseUrl: string, origin: string): string {
	const base = new URL(adminBaseUrl, origin);
	const protocol = base.protocol === "https:" ? "wss:" : "ws:";
	const path = `${base.pathname.replace(/\/+$/, "")}/terminal/ws`;
	return `${protocol}//${base.host}${path}`;
}

/**
 * 后端错误文案：actix 的 `ErrorNotFound("Web terminal is disabled")` 是**纯文本** body，
 * 平台错误模型只解析 JSON `message`，因此这里额外把纯文本 body 附上。
 */
function describeTerminalError(error: unknown, t: TFunction): string {
	const base = errorText(error, t("adminInfra.terminal.error.fallback"));
	if (error instanceof FloatCTFError) {
		const data = error.response?.data;
		if (typeof data === "string" && data.trim().length > 0) {
			return t("adminInfra.terminal.error.withBackend", {
				message: base,
				backend: data.trim(),
			});
		}
		if (error.httpStatus === 404) {
			return t("adminInfra.terminal.error.disabledHint", { message: base });
		}
	}
	return base;
}

export function AdminTerminalPage(): ReactNode {
	const { t } = useTranslation();
	useDocumentTitle(t("adminInfra.terminal.documentTitle"));
	const client = useClient();
	const confirm = useConfirm();
	const theme = useTheme();
	const containerRef = useRef<HTMLDivElement>(null);
	const terminalRef = useRef<Terminal | null>(null);
	const [status, setStatus] = useState<TerminalStatus>("idle");
	const [error, setError] = useState<string | null>(null);
	const [attempt, setAttempt] = useState(0);

	// 终端内的提示文案不应因切换语言而重建会话（那会杀掉 shell），因此用 ref 取最新 t。
	const tRef = useRef(t);
	tRef.current = t;

	const adminBaseUrl = client.adminBaseUrl;

	const connectEffect = useCallback(() => {
		const container = containerRef.current;
		if (!container) return undefined;

		let disposed = false;
		const terminal = new Terminal({
			cursorBlink: true,
			cursorStyle: "bar",
			fontSize: 14,
			fontFamily: 'Menlo, Monaco, "Courier New", monospace',
			allowProposedApi: true,
			// 语义色对比度兜底：亮色模式下 ANSI 调色板也保持可读。
			minimumContrastRatio: 4.5,
			// 挂载时从 CSS 变量读取，亮色模式不会残留暗色终端。
			theme: readTerminalTheme(),
		});
		terminalRef.current = terminal;
		const fitAddon = new FitAddon();
		terminal.loadAddon(fitAddon);

		let socket: WebSocket | null = null;
		let observer: ResizeObserver | null = null;
		let initializeTimer = 0;
		let fitFrame: number | null = null;

		const sendResize = () => {
			if (socket?.readyState === WebSocket.OPEN) {
				socket.send(JSON.stringify({ type: "resize", cols: terminal.cols, rows: terminal.rows }));
			}
		};

		const dataDisposable = terminal.onData((data) => {
			if (socket?.readyState === WebSocket.OPEN) socket.send(data);
		});
		const resizeDisposable = terminal.onResize(() => sendResize());

		function writeLine(text: string, tone: "info" | "error" | "muted" = "muted") {
			const color = tone === "error" ? "\x1b[31m" : tone === "info" ? "\x1b[32m" : "\x1b[90m";
			terminal.writeln(`\r\n${color}● ${text}\x1b[0m`);
		}

		async function connect() {
			setStatus("authorizing");
			setError(null);
			try {
				// 一次性 HttpOnly ticket cookie；JWT 只在 Authorization 头里出现一次。
				await client.adminHttp.post("/terminal/session");
			} catch (sessionError) {
				if (disposed) return;
				const message = describeTerminalError(sessionError, tRef.current);
				setStatus("error");
				setError(message);
				writeLine(message, "error");
				return;
			}
			if (disposed) return;

			setStatus("connecting");
			const url = buildTerminalWsUrl(adminBaseUrl, window.location.origin);
			let ws: WebSocket;
			try {
				ws = new WebSocket(url);
			} catch (socketError) {
				if (disposed) return;
				const message = describeTerminalError(socketError, tRef.current);
				setStatus("error");
				setError(message);
				writeLine(message, "error");
				return;
			}
			ws.binaryType = "arraybuffer";
			socket = ws;

			ws.onopen = () => {
				if (disposed) return;
				setStatus("connected");
				writeLine(tRef.current("adminInfra.terminal.section.connectedLine"), "info");
				sendResize();
			};

			ws.onmessage = (event) => {
				if (disposed) return;
				if (event.data instanceof ArrayBuffer) {
					terminal.write(new Uint8Array(event.data));
					return;
				}
				if (event.data instanceof Blob) {
					void event.data.arrayBuffer().then((buffer) => {
						if (!disposed) terminal.write(new Uint8Array(buffer));
					});
					return;
				}
				if (typeof event.data === "string") terminal.write(event.data);
			};

			ws.onerror = () => {
				if (disposed) return;
				const message = tRef.current("adminInfra.terminal.error.wsError");
				setStatus("error");
				setError(message);
				writeLine(message, "error");
			};

			ws.onclose = (event) => {
				if (disposed) return;
				setStatus((previous) => (previous === "error" ? previous : "closed"));
				const translate = tRef.current;
				const closedText =
					event.code === 1000
						? translate("adminInfra.terminal.error.closed")
						: event.reason
							? translate("adminInfra.terminal.error.closedWithReason", {
									code: event.code,
									reason: event.reason,
								})
							: translate("adminInfra.terminal.error.closedWithCode", {
									code: event.code,
								});
				writeLine(closedText, event.code === 1000 ? "muted" : "error");
				if (socket === ws) socket = null;
			};
		}

		// xterm 的 Viewport.open() 会注册不可取消的延迟回调：StrictMode 探测时若同步
		// open 后立刻 dispose 会访问已释放的 renderService，因此把 open 推迟一个 turn。
		initializeTimer = window.setTimeout(() => {
			if (disposed) return;
			terminal.open(container);
			observer = new ResizeObserver(() => {
				if (disposed) return;
				try {
					fitAddon.fit();
				} catch {
					// 容器在切换 / 卸载边界上的尺寸变化无需影响连接。
				}
			});
			observer.observe(container);

			fitFrame = window.requestAnimationFrame(() => {
				fitFrame = null;
				if (disposed) return;
				try {
					fitAddon.fit();
				} catch {
					// ResizeObserver 后续仍会在尺寸就绪时重试。
				}
				void connect();
			});
		}, 0);

		return () => {
			disposed = true;
			window.clearTimeout(initializeTimer);
			if (fitFrame !== null) window.cancelAnimationFrame(fitFrame);
			observer?.disconnect();
			dataDisposable.dispose();
			resizeDisposable.dispose();
			if (socket) {
				socket.onopen = null;
				socket.onmessage = null;
				socket.onerror = null;
				socket.onclose = null;
				socket.close();
				socket = null;
			}
			terminalRef.current = null;
			terminal.dispose();
			setStatus("idle");
		};
	}, [adminBaseUrl, client]);

	useEffect(() => {
		if (attempt === 0) return;
		const cleanup = connectEffect();
		return cleanup;
		// attempt 变化时整体重连（先 dispose 旧终端 / socket）。
	}, [connectEffect, attempt]);

	// 亮暗切换：重设 xterm 主题，不重建会话（重建会杀掉正在使用的 shell）。
	useEffect(() => {
		const terminal = terminalRef.current;
		if (!terminal) return;
		terminal.options.theme = readTerminalTheme();
	}, [theme, status]);

	/** 高危：建立会话前必须显式确认，确认词只在 UI 层。 */
	async function requestSession() {
		const ok = await confirm({
			title: t("adminInfra.terminal.confirm.title"),
			description: t("adminInfra.terminal.confirm.description"),
			consequences: [
				t("adminInfra.terminal.confirm.consequenceHost"),
				t("adminInfra.terminal.confirm.consequenceRealtime"),
				t("adminInfra.terminal.confirm.consequenceSession"),
			],
			tone: "danger",
			confirmText: t("adminInfra.terminal.confirm.confirm"),
			confirmPhrase: CONNECT_PHRASE,
		});
		if (!ok) return;
		setError(null);
		setAttempt((value) => value + 1);
	}

	const statusMeta = {
		tone: STATUS_TONE[status],
		text: t(STATUS_TEXT_KEY[status]),
	};
	const busy = status === "authorizing" || status === "connecting";
	const wsEndpoint = `${adminBaseUrl.replace(/\/+$/, "")}/terminal/ws`;

	return (
		<PageBody>
			<PageHeader
				title={t("adminInfra.terminal.title")}
				description={t("adminInfra.terminal.description")}
				badge={<TonePill tone="muted">{t("adminInfra.specialized")}</TonePill>}
				actions={
					<Toolbar>
						<TonePill tone={statusMeta.tone} icon={<PlugZap />}>
							{statusMeta.text}
						</TonePill>
						<Button size="sm" onClick={() => void requestSession()} disabled={busy}>
							{attempt === 0 ? (
								<TerminalSquare className="size-4" aria-hidden="true" />
							) : (
								<RotateCw className="size-4" aria-hidden="true" />
							)}
							{attempt === 0
								? t("adminInfra.terminal.actions.connect")
								: t("adminInfra.terminal.actions.reconnect")}
						</Button>
					</Toolbar>
				}
			/>

			<div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
				<ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
				<span>{t("adminInfra.terminal.warning")}</span>
			</div>

			{error ? (
				<div
					className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"
					role="alert"
				>
					<span className="text-destructive">{error}</span>
					<Button variant="outline" size="sm" onClick={() => void requestSession()}>
						<RotateCw className="size-4" aria-hidden="true" />
						{t("common.retry")}
					</Button>
				</div>
			) : null}

			<SectionCard
				title={
					<span className="inline-flex items-center gap-2">
						<TerminalSquare className="size-4" aria-hidden="true" />
						{t("adminInfra.terminal.section.title")}
					</span>
				}
				description={
					<Trans
						i18nKey="adminInfra.terminal.section.description"
						values={{ url: wsEndpoint }}
						components={{ mono: <MonoText>{null}</MonoText> }}
					/>
				}
				contentClassName="p-0"
			>
				{attempt === 0 ? (
					<div className="p-4">
						<EmptyBlock
							title={t("adminInfra.terminal.section.idleTitle")}
							description={t("adminInfra.terminal.section.idleDescription")}
							icon={<TerminalSquare className="size-6" />}
						/>
					</div>
				) : (
					<div className="h-[68svh] min-h-80 bg-background p-2">
						<div ref={containerRef} className="h-full w-full" />
					</div>
				)}
			</SectionCard>
		</PageBody>
	);
}
