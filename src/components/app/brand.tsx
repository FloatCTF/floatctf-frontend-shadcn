/**
 * 品牌标识 —— FloatCTF 官方 logo（`float.png`，来自 default 前端的同一份资产）。
 *
 * logo 是**纯黑线稿 + 透明底**，因此暗色下用 `dark:invert` 反白，保持与中性主题一致的
 * 单色观感（docs/theme.md §5.2：圆形、size-8 / size-9、`ring-1 ring-border/60`）。
 */

import logoUrl from "~/assets/float-logo.png";
import { cn } from "~/lib/utils";

const markSize = {
	sm: "size-7",
	md: "size-8",
	lg: "size-9",
} as const;

export function BrandMark({
	size = "md",
	className,
}: {
	size?: keyof typeof markSize;
	className?: string;
}) {
	return (
		<img
			src={logoUrl}
			alt="FloatCTF"
			width={36}
			height={36}
			className={cn(
				"shrink-0 rounded-full object-contain ring-1 ring-border/60 dark:invert",
				markSize[size],
				className,
			)}
		/>
	);
}

/** 字标：产品名 + 可选的一句话定位。 */
export function BrandLockup({
	title = "FloatCTF",
	subtitle,
	className,
}: {
	title?: string;
	subtitle?: string;
	className?: string;
}) {
	return (
		<span className={cn("flex items-center gap-2", className)}>
			<BrandMark />
			<span className="grid min-w-0 leading-tight">
				<span className="truncate text-sm font-semibold tracking-tight">{title}</span>
				{subtitle ? (
					<span className="truncate text-xs text-muted-foreground">{subtitle}</span>
				) : null}
			</span>
		</span>
	);
}
