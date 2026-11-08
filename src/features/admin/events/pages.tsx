/**
 * `/admin/events` —— 赛事列表 / 新建 / 编辑 / 删除。
 *
 * 数据全部来自 `client.admin.events.*`；`filter` 用后端 `apply_filters` 的
 * `key:value` 语法（`title` / `family` / `is_virtual` 均为后端已声明的过滤键）。
 * 文案全部走 `adminEvents` 命名空间；状态 / 赛制由 `~/lib/event-status.ts` 提供。
 */

import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Plus, RefreshCw, Search, Trash2 } from "lucide-react";

import { call, callList } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { BooleanPill, TonePill } from "~/components/app/badges";
import { useConfirm } from "~/components/app/confirm";
import type { DataTableColumn } from "~/components/app/data-table";
import { PageBody, PageHeader, SectionCard, Toolbar } from "~/components/app/page";
import { EmptyBlock } from "~/components/app/states";
import { toast } from "~/components/app/toast";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { EventFamily } from "@floatctf/sdk/entity";
import type { Events } from "@floatctf/sdk/entity";
import { formatRange } from "~/lib/format";
import { useDebouncedValue, useDocumentTitle } from "~/lib/hooks";

import { EventFormSheet } from "./event-form";
import {
	EventFamilyPill,
	EventPurposePills,
	EventStatusPill,
	MobileFacts,
	PagedTable,
	ParticipantModePill,
	useEventLabels,
} from "./shared";

type Scope = "normal" | "virtual";

export function EventsListPage(): ReactNode {
	const { t } = useTranslation();
	const labels = useEventLabels();
	useDocumentTitle(t("adminEvents.list.documentTitle"));
	const client = useClient();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const navigate = useNavigate();

	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(20);
	const [search, setSearch] = useState("");
	const [scope, setScope] = useState<Scope>("normal");
	const [family, setFamily] = useState<"all" | EventFamily>("all");
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [sheet, setSheet] = useState<{ event: Events | null } | null>(null);

	const keyword = useDebouncedValue(search, 300);

	const filter = useMemo(() => {
		const parts = [scope === "virtual" ? "is_virtual:true" : "is_virtual:false"];
		if (family !== "all") parts.push(`family:${family}`);
		const cleaned = keyword.replace(/[&|]/g, " ").trim();
		if (cleaned !== "") parts.push(`title:${cleaned}`);
		return parts.join(" & ");
	}, [scope, family, keyword]);

	const query = useQuery({
		queryKey: qk.admin.events({ page, limit: pageSize, filter }),
		queryFn: () => callList<Events>(client.admin.events.fetch({ page, limit: pageSize, filter })),
	});

	const removeEvents = useMutation({
		mutationFn: (ids: string[]) =>
			call<number>(client.admin.events.remove(ids), t("adminEvents.actions.deleteEvent")),
		onSuccess: (count) => {
			toast.success(t("adminEvents.list.delete.success", { count }));
			setSelectedIds([]);
			void queryClient.invalidateQueries({ queryKey: qk.admin.events() });
			void queryClient.invalidateQueries({ queryKey: qk.admin.dashboard() });
		},
		onError: (error) => toast.apiError(t("adminEvents.list.delete.failed"), error),
	});

	async function confirmRemove(targets: Events[]) {
		if (targets.length === 0) return;
		const single = targets.length === 1 ? targets[0] : null;
		const ok = await confirm({
			title: single
				? t("adminEvents.list.delete.singleTitle", { title: single.title })
				: t("adminEvents.list.delete.bulkTitle", { count: targets.length }),
			description: t("adminEvents.list.delete.description"),
			consequences: [
				t("adminEvents.list.delete.consequence1"),
				t("adminEvents.list.delete.consequence2"),
				t("adminEvents.list.delete.consequence3"),
				t("adminEvents.list.delete.consequence4"),
			],
			tone: "danger",
			confirmText: t("adminEvents.list.delete.confirm"),
			confirmPhrase: single ? single.title : t("adminEvents.list.delete.phraseBulk"),
		});
		if (!ok) return;
		removeEvents.mutate(targets.map((item) => item.id));
	}

	const columns: DataTableColumn<Events>[] = [
		{
			id: "title",
			header: t("adminEvents.list.columns.title"),
			cell: (row) => (
				<div className="min-w-0">
					<Link
						to={`/admin/events/${row.id}`}
						className="font-medium underline-offset-4 hover:underline"
					>
						{row.title}
					</Link>
					<div className="mt-1 flex flex-wrap items-center gap-1">
						{row.hidden ? (
							<TonePill tone="muted" title={t("adminEvents.list.visibility.hidden")}>
								{t("adminEvents.list.visibility.hidden")}
							</TonePill>
						) : null}
						{row.system_key ? (
							<TonePill tone="warning" title={t("adminEvents.list.badgeSystem")}>
								{t("adminEvents.list.badgeSystem")}
							</TonePill>
						) : null}
					</div>
				</div>
			),
			sortValue: (row) => row.title,
		},
		{
			id: "family",
			header: t("adminEvents.list.columns.family"),
			cell: (row) => <EventFamilyPill family={row.family} />,
			sortValue: (row) => labels.family(row.family),
		},
		{
			id: "participant_mode",
			header: t("adminEvents.list.columns.participantMode"),
			cell: (row) => <ParticipantModePill mode={row.participant_mode} />,
			sortValue: (row) => row.participant_mode,
		},
		{
			id: "window",
			header: t("adminEvents.list.columns.window"),
			cell: (row) => (
				<span className="tnum text-xs whitespace-nowrap">
					{formatRange(row.start_time, row.end_time ?? null)}
				</span>
			),
			sortValue: (row) => Date.parse(row.start_time),
			hideBelow: "lg",
		},
		{
			id: "status",
			header: t("adminEvents.list.columns.status"),
			cell: (row) => <EventStatusPill event={row} />,
			sortValue: (row) => row.start_time,
		},
		{
			id: "hidden",
			header: t("adminEvents.list.columns.visibility"),
			cell: (row) => (
				<BooleanPill
					value={row.hidden}
					trueText={t("adminEvents.list.visibility.hidden")}
					falseText={t("adminEvents.list.visibility.public")}
					trueTone="muted"
					falseTone="success"
				/>
			),
			sortValue: (row) => (row.hidden ? 1 : 0),
			hideBelow: "md",
		},
		{
			id: "purpose",
			header: t("adminEvents.list.columns.purpose"),
			cell: (row) => <EventPurposePills event={row} />,
			sortValue: (row) => `${row.purpose}-${row.is_virtual ? "v" : "n"}`,
			hideBelow: "lg",
		},
	];

	const rowActions = (row: Events): ReactNode => {
		const actionsLabel = t("adminEvents.list.row.actions", { name: row.title });
		return (
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="icon-sm" aria-label={actionsLabel} title={actionsLabel}>
						<MoreHorizontal />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuLabel className="max-w-56 truncate">{row.title}</DropdownMenuLabel>
					<DropdownMenuItem onSelect={() => void navigate(`/admin/events/${row.id}`)}>
						{t("adminEvents.list.row.openConsole")}
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={() => setSheet({ event: row })}>
						{t("adminEvents.list.row.edit")}
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					{row.system_key ? (
						<DropdownMenuItem
							disabled
							title={t("adminEvents.config.hints.systemManaged")}
						>
							<Trash2 /> {t("adminEvents.list.row.delete")}
						</DropdownMenuItem>
					) : (
						<DropdownMenuItem variant="destructive" onSelect={() => void confirmRemove([row])}>
							<Trash2 /> {t("adminEvents.list.row.delete")}
						</DropdownMenuItem>
					)}
				</DropdownMenuContent>
			</DropdownMenu>
		);
	};

	const mobileCard = (row: Events): ReactNode => (
		<div className="space-y-2">
			<MobileFacts
				items={[
					{
						k: t("adminEvents.list.mobile.title"),
						v: (
							<Link
								to={`/admin/events/${row.id}`}
								className="font-medium underline-offset-4 hover:underline"
							>
								{row.title}
							</Link>
						),
					},
					{ k: t("adminEvents.list.mobile.family"), v: <EventFamilyPill family={row.family} /> },
					{
						k: t("adminEvents.list.mobile.participantMode"),
						v: <ParticipantModePill mode={row.participant_mode} />,
					},
					{ k: t("adminEvents.list.mobile.status"), v: <EventStatusPill event={row} /> },
					{
						k: t("adminEvents.list.mobile.window"),
						v: (
							<span className="tnum text-xs">
								{formatRange(row.start_time, row.end_time ?? null)}
							</span>
						),
					},
					{ k: t("adminEvents.list.mobile.purpose"), v: <EventPurposePills event={row} /> },
					{
						k: t("adminEvents.list.mobile.visibility"),
						v: (
							<BooleanPill
								value={row.hidden}
								trueText={t("adminEvents.list.visibility.hidden")}
								falseText={t("adminEvents.list.visibility.public")}
								trueTone="muted"
								falseTone="success"
							/>
						),
					},
				]}
			/>
			<div className="flex items-center justify-between gap-2">
				<Button variant="outline" size="xs" asChild>
					<Link to={`/admin/events/${row.id}`}>{t("adminEvents.list.row.openConsole")}</Link>
				</Button>
				{rowActions(row)}
			</div>
		</div>
	);

	return (
		<PageBody>
			<PageHeader
				title={t("adminEvents.list.title")}
				description={t("adminEvents.list.description")}
				actions={
					<Toolbar>
						<Button
							variant="outline"
							onClick={() => {
								void queryClient.invalidateQueries({ queryKey: qk.admin.events() });
							}}
							disabled={query.isFetching}
						>
							<RefreshCw className={query.isFetching ? "animate-spin" : undefined} />{" "}
							{t("common.refresh")}
						</Button>
						<Button
							onClick={() => setSheet({ event: null })}
							disabled={scope === "virtual"}
							title={scope === "virtual" ? t("adminEvents.list.createDisabledHint") : undefined}
						>
							<Plus /> {t("adminEvents.list.create")}
						</Button>
					</Toolbar>
				}
			/>

			<SectionCard
				title={
					scope === "virtual"
						? t("adminEvents.list.sectionTitleVirtual")
						: t("adminEvents.list.sectionTitleCompetition")
				}
				description={
					scope === "virtual"
						? t("adminEvents.list.sectionDescriptionVirtual")
						: t("adminEvents.list.sectionDescriptionCompetition")
				}
				actions={
					<Toolbar>
						<div className="relative w-48">
							<Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								value={search}
								onChange={(changeEvent) => {
									setSearch(changeEvent.target.value);
									setPage(1);
								}}
								placeholder={t("adminEvents.list.searchPlaceholder")}
								className="pl-8"
								aria-label={t("adminEvents.list.searchAria")}
							/>
						</div>
						<Select
							value={family}
							onValueChange={(value) => {
								setFamily(value as "all" | EventFamily);
								setPage(1);
							}}
						>
							<SelectTrigger
								size="sm"
								className="w-40"
								aria-label={t("adminEvents.list.familyFilterAria")}
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">{t("adminEvents.list.familyAll")}</SelectItem>
								<SelectItem value={EventFamily.Jeopardy}>
									{labels.family(EventFamily.Jeopardy)}
								</SelectItem>
								<SelectItem value={EventFamily.Awd}>{labels.family(EventFamily.Awd)}</SelectItem>
								<SelectItem value={EventFamily.Awdp}>{labels.family(EventFamily.Awdp)}</SelectItem>
							</SelectContent>
						</Select>
						<Select
							value={scope}
							onValueChange={(value) => {
								setScope(value as Scope);
								setPage(1);
								setSelectedIds([]);
							}}
						>
							<SelectTrigger
								size="sm"
								className="w-36"
								aria-label={t("adminEvents.list.scopeFilterAria")}
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="normal">
									{t("adminEvents.list.scopeCompetition")}
								</SelectItem>
								<SelectItem value="virtual">{t("adminEvents.list.scopeVirtual")}</SelectItem>
							</SelectContent>
						</Select>
						{selectedIds.length > 0 ? (
							<Button
								variant="destructive"
								size="sm"
								onClick={() => {
									const targets = (query.data?.items ?? []).filter((item) =>
										selectedIds.includes(item.id),
									);
									void confirmRemove(targets);
								}}
							>
								<Trash2 /> {t("adminEvents.list.deleteSelected", { count: selectedIds.length })}
							</Button>
						) : null}
					</Toolbar>
				}
			>
				<PagedTable
					query={query}
					columns={columns}
					getRowId={(row) => row.id}
					page={page}
					pageSize={pageSize}
					onPageChange={setPage}
					onPageSizeChange={(size) => {
						setPageSize(size);
						setPage(1);
					}}
					rowActions={rowActions}
					selectable
					selectedIds={selectedIds}
					onSelectionChange={setSelectedIds}
					mobileCard={mobileCard}
					errorTitle={t("adminEvents.list.loadError")}
					empty={
						<EmptyBlock
							title={
								search.trim() === "" && family === "all"
									? t("adminEvents.list.empty.title")
									: t("adminEvents.list.empty.filteredTitle")
							}
							description={
								search.trim() === "" && family === "all"
									? scope === "virtual"
										? t("adminEvents.list.empty.descriptionVirtual")
										: t("adminEvents.list.empty.descriptionCompetition")
									: t("adminEvents.list.empty.filteredDescription", {
											query: search.trim() || family,
										})
							}
							variant={search.trim() === "" && family === "all" ? "empty" : "filtered"}
						/>
					}
				/>
			</SectionCard>

			{sheet ? (
				<EventFormSheet
					open
					onOpenChange={(next) => {
						if (!next) setSheet(null);
					}}
					event={sheet.event}
				/>
			) : null}

			<p className="text-xs text-muted-foreground">{t("adminEvents.list.footnote")}</p>
		</PageBody>
	);
}
