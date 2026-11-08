/**
 * Default 风格的列表筛选条：Add Filter 字段菜单 + 过滤表达式输入 + Clear / Apply。
 * 表达式形如 `name:web & description:入门`；具体过滤由调用方执行/请求。
 */
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Filter, Search } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";

export interface FilterKey {
	key: string;
	label: string;
}

export function FilterBar({
	keys,
	value,
	onChange,
	onApply,
	onClear,
	placeholder,
	className,
}: {
	keys: FilterKey[];
	value: string;
	onChange: (value: string) => void;
	onApply: () => void;
	onClear: () => void;
	placeholder?: string;
	className?: string;
}) {
	const { t } = useTranslation();
	const inputRef = useRef<HTMLInputElement>(null);

	function add(key: string) {
		const token = `${key}:`;
		onChange(value.trim() ? `${value.trim()} & ${token}` : token);
		requestAnimationFrame(() => inputRef.current?.focus());
	}

	return (
		<div className={className ?? "flex w-full flex-wrap items-center gap-1"}>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="outline" size="sm">
						<Filter aria-hidden="true" />
						{t("common.filter.add")}
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start">
					<DropdownMenuLabel>{t("common.filter.byField")}</DropdownMenuLabel>
					<DropdownMenuSeparator />
					{keys.map((item) => (
						<DropdownMenuItem key={item.key} onSelect={() => add(item.key)}>
							{item.label}
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
			<Input
				ref={inputRef}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				placeholder={placeholder ?? t("common.filter.placeholder")}
				className="min-w-0 flex-1 sm:w-72"
				aria-label={placeholder ?? t("common.filter.placeholder")}
				onKeyDown={(event) => {
					if (event.key === "Enter") onApply();
				}}
			/>
			<Button variant="outline" size="sm" onClick={onClear}>
				{t("common.clear")}
			</Button>
			<Button size="sm" onClick={onApply}>
				<Search aria-hidden="true" />
				{t("common.filter.apply")}
			</Button>
		</div>
	);
}
