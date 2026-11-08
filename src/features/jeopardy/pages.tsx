/**
 * 题库（练习）/ 题集 —— 选手端解题入口。
 * 题目目录用**全量拉取 + 客户端筛选**（与 Default 的 GenericTable 过滤语义一致：
 * 平台列表接口没有服务端分类过滤，`QueryParams.filter` 只有一个自由文本字段）。
 */

import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Blocks, CheckCircle2, ChevronRight, Puzzle, Search } from "lucide-react";

import { call, callList } from "~/api/call";
import { isNotFound } from "~/api/errors";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
import {
	MonoText,
	PageBody,
	FilterChips,
	PageHeader,
	PaginationBar,
	SectionCard,
	Toolbar,
} from "~/components/app/page";
import {
	EmptyBlock,
	LoadingBlock,
	NotFoundBlock,
	QueryState,
	TableSkeleton,
} from "~/components/app/states";
import { TonePill } from "~/components/app/badges";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import type { ChallengesListItem } from "@floatctf/sdk";
import type { ChallengeSets } from "@floatctf/sdk/entity";
import { formatRelative } from "~/lib/format";
import { useDebouncedValue, useDocumentTitle, useNow } from "~/lib/hooks";
import { ChallengeWorkbench, ChallengeWriteups } from "./workbench";

/** 表格里统一的空值占位（theme.md §3.3）。 */
function EmptyCell() {
	return <span className="text-xs text-muted-foreground">—</span>;
}

export function ChallengesCatalogPage() {
	const { t } = useTranslation();
	useDocumentTitle(t("jeopardy.list.documentTitle"));
	const client = useClient();
	const [search, setSearch] = useState("");
	const [category, setCategory] = useState("all");
	const [onlyUnsolved, setOnlyUnsolved] = useState(false);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(20);
	const debouncedSearch = useDebouncedValue(search, 300);
	const now = useNow(60_000);

	const clearFilters = () => {
		setSearch("");
		setCategory("all");
		setOnlyUnsolved(false);
		setPage(1);
	};

	const query = useQuery({
		queryKey: qk.challenges.list({ page: 1, limit: 200 }),
		queryFn: () => callList(client.service.challenges.fetch({ page: 1, limit: 200 })),
	});

	const items = query.data?.items ?? [];
	const categories = useMemo(
		() => Array.from(new Set(items.map((item) => item.category).filter(Boolean))).sort(),
		[items],
	);

	const filtered = useMemo(() => {
		const keyword = debouncedSearch.trim().toLowerCase();
		return items.filter((item) => {
			if (category !== "all" && item.category !== category) return false;
			if (onlyUnsolved && item.solved) return false;
			if (keyword === "") return true;
			return (
				item.name.toLowerCase().includes(keyword) ||
				item.category.toLowerCase().includes(keyword) ||
				(item.description ?? "").toLowerCase().includes(keyword)
			);
		});
	}, [items, category, onlyUnsolved, debouncedSearch]);

	const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

	const columns: DataTableColumn<ChallengesListItem>[] = [
		{
			id: "name",
			header: t("jeopardy.list.columns.challenge"),
			sortValue: (row) => row.name,
			cell: (row) => (
				<div className="min-w-0">
					<Link
						to={`/challenges/${row.id}`}
						className="truncate text-sm font-medium hover:underline"
						title={row.name}
					>
						{row.name}
					</Link>
					<p className="truncate text-xs text-muted-foreground" title={row.safe_name}>
						{row.safe_name}
					</p>
				</div>
			),
		},
		{
			id: "category",
			header: t("jeopardy.list.columns.category"),
			sortValue: (row) => row.category,
			cell: (row) => (
				<TonePill tone="neutral">
					{row.category || t("jeopardy.common.categoryFallback")}
				</TonePill>
			),
		},
		{
			id: "solved",
			header: t("jeopardy.list.columns.status"),
			sortValue: (row) => (row.solved ? 1 : 0),
			cell: (row) =>
				row.solved ? (
					<TonePill tone="success" icon={<CheckCircle2 aria-hidden="true" />}>
						{t("jeopardy.common.solved")}
					</TonePill>
				) : (
					<TonePill tone="muted">{t("jeopardy.common.unsolved")}</TonePill>
				),
		},
		{
			id: "author",
			header: t("jeopardy.list.columns.author"),
			hideBelow: "md",
			cell: (row) =>
				row.author ? (
					<span className="text-xs" data-user-data>
						{row.author}
					</span>
				) : (
					<EmptyCell />
				),
		},
		{
			id: "version",
			header: t("jeopardy.list.columns.version"),
			hideBelow: "sm",
			sortValue: (row) => row.version ?? "",
			cell: (row) =>
				row.version ? <MonoText>{row.version}</MonoText> : <EmptyCell />,
		},
		{
			id: "updated_at",
			header: t("jeopardy.list.columns.updatedAt"),
			hideBelow: "lg",
			sortValue: (row) => Date.parse(row.updated_at),
			cell: (row) => (
				<span className="tnum text-xs text-muted-foreground">
					{formatRelative(row.updated_at, now)}
				</span>
			),
		},
	];

	return (
		<PageBody>
			<PageHeader
				title={t("jeopardy.list.title")}
				description={t("jeopardy.list.subtitle")}
				actions={
					<Toolbar>
						<Button variant="outline" asChild>
							<Link to="/challenge-sets">
								<Blocks aria-hidden="true" />
								{t("jeopardy.list.setsAction")}
							</Link>
						</Button>
					</Toolbar>
				}
			/>

			<SectionCard
				title={t("jeopardy.list.cardTitle")}
				description={
					query.isSuccess ? (
						<span className="tnum">
							{filtered.length === items.length
								? t("jeopardy.list.countAll", { total: items.length })
								: t("jeopardy.list.countSummary", {
										total: items.length,
										filtered: filtered.length,
									})}
						</span>
					) : undefined
				}
				contentClassName="px-0"
				footer={
					filtered.length > 0 ? (
						<PaginationBar
							page={page}
							pageSize={pageSize}
							total={filtered.length}
							onPageChange={setPage}
							onPageSizeChange={(size) => {
								setPageSize(size);
								setPage(1);
							}}
						/>
					) : null
				}
			>
				<Toolbar className="px-4 pb-4">
					<div className="relative w-full sm:w-56">
						<Search
							className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
							aria-hidden="true"
						/>
						<Input
							value={search}
							onChange={(event) => {
								setSearch(event.target.value);
								setPage(1);
							}}
							placeholder={t("jeopardy.list.searchPlaceholder")}
							aria-label={t("jeopardy.list.searchLabel")}
							className="pl-8"
						/>
					</div>
					<Select
						value={category}
						onValueChange={(value) => {
							setCategory(value);
							setPage(1);
						}}
					>
						<SelectTrigger
							className="w-full sm:w-36"
							aria-label={t("jeopardy.list.categoryFilterLabel")}
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">{t("jeopardy.list.allCategories")}</SelectItem>
							{categories.map((item) => (
								<SelectItem key={item} value={item}>
									{item}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Button
						variant={onlyUnsolved ? "default" : "outline"}
						size="sm"
						aria-pressed={onlyUnsolved}
						onClick={() => {
							setOnlyUnsolved((value) => !value);
							setPage(1);
						}}
					>
						{onlyUnsolved
							? t("jeopardy.list.onlyUnsolved")
							: t("jeopardy.list.includeSolved")}
					</Button>
				</Toolbar>
				<FilterChips
					filters={[
						...(category !== "all"
							? [
									{
										key: "category",
										label: category,
										onRemove: () => {
											setCategory("all");
											setPage(1);
										},
									},
								]
							: []),
						...(onlyUnsolved
							? [
									{
										key: "unsolved",
										label: t("jeopardy.list.onlyUnsolved"),
										onRemove: () => {
											setOnlyUnsolved(false);
											setPage(1);
										},
									},
								]
							: []),
					]}
					onClearAll={clearFilters}
					className="px-4"
				/>
				<QueryState
					query={query}
					skeleton={<TableSkeleton rows={8} columns={5} />}
					isEmpty={() => items.length === 0}
					empty={
						<EmptyBlock
							title={t("jeopardy.list.emptyTitle")}
							description={t("jeopardy.list.emptyDescription")}
						/>
					}
					errorTitle={t("jeopardy.list.loadError")}
				>
					{() =>
						filtered.length === 0 ? (
							<EmptyBlock
								variant="filtered"
								title={t("jeopardy.list.filteredTitle")}
								description={t("jeopardy.list.filteredDescription")}
								action={
									<Button variant="outline" size="sm" onClick={clearFilters}>
										{t("jeopardy.list.filteredAction")}
									</Button>
								}
							/>
						) : (
							<DataTable
								data={paged}
								getRowId={(row) => row.id}
								columns={columns}
								mobileCard={(row) => (
									<div className="flex items-center justify-between gap-3">
										<div className="min-w-0">
											<Link
												to={`/challenges/${row.id}`}
												className="truncate text-sm font-medium hover:underline"
												title={row.name}
											>
												{row.name}
											</Link>
											<p className="truncate text-xs text-muted-foreground">
												{row.category || t("jeopardy.common.categoryFallback")}
											</p>
										</div>
										<div className="flex shrink-0 items-center gap-2">
											{row.solved ? (
												<TonePill tone="success" icon={<CheckCircle2 aria-hidden="true" />}>
													{t("jeopardy.common.solved")}
												</TonePill>
											) : (
												<TonePill tone="muted">{t("jeopardy.common.unsolved")}</TonePill>
											)}
											<ChevronRight
												className="size-4 text-muted-foreground"
												aria-hidden="true"
											/>
										</div>
									</div>
								)}
							/>
						)
					}
				</QueryState>
			</SectionCard>
		</PageBody>
	);
}

export function ChallengeDetailPage() {
	const { t } = useTranslation();
	const { challengeId = "" } = useParams<{ challengeId: string }>();
	const client = useClient();
	const query = useQuery({
		queryKey: qk.challenges.detail(challengeId),
		queryFn: () => call(client.service.challenges.get(challengeId), "题目详情"),
		enabled: challengeId !== "",
	});

	useDocumentTitle(
		query.data
			? t("jeopardy.detail.documentTitle", { name: query.data.name })
			: t("jeopardy.detail.documentTitleFallback"),
	);

	if (query.isError && isNotFound(query.error)) {
		return (
			<PageBody>
				<NotFoundBlock
					title={t("jeopardy.detail.notFoundTitle")}
					description={t("jeopardy.detail.notFoundDescription")}
					action={
						<Button asChild variant="outline">
							<Link to="/challenges">{t("jeopardy.detail.backToCatalog")}</Link>
						</Button>
					}
				/>
			</PageBody>
		);
	}

	return (
		<PageBody className="lg:flex lg:h-[calc(100svh-3.5rem)] lg:flex-col lg:gap-4 lg:space-y-0 lg:overflow-hidden">
			<QueryState
				query={query}
				skeleton={<LoadingBlock label={t("jeopardy.detail.loading")} className="lg:flex-1" />}
				errorTitle={t("jeopardy.detail.loadError")}
			>
				{(challenge) => (
					<>
						<PageHeader
							title={challenge.name}
							description={<MonoText>{challenge.safe_name}</MonoText>}
							breadcrumbs={
								<span className="flex items-center gap-1">
									<Link to="/challenges" className="hover:underline">
										{t("jeopardy.detail.breadcrumbCatalog")}
									</Link>
									<ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
									<span>{challenge.category || t("jeopardy.common.categoryFallback")}</span>
								</span>
							}
							badge={
								challenge.solved ? (
									<TonePill tone="success" icon={<CheckCircle2 aria-hidden="true" />}>
										{t("jeopardy.common.solved")}
									</TonePill>
								) : null
							}
						/>
						<Tabs defaultValue="challenge" className="flex min-h-0 flex-1 flex-col gap-3">
							<TabsList className="w-fit">
								<TabsTrigger value="challenge">
									{t("jeopardy.detail.tabs.challenge")}
								</TabsTrigger>
								<TabsTrigger value="writeup">
									{t("jeopardy.detail.tabs.writeup")}
								</TabsTrigger>
							</TabsList>
							<TabsContent value="challenge" className="min-h-0 flex-1">
								<ChallengeWorkbench
									challenge={challenge}
									mode={{ kind: "practice" }}
									className="lg:min-h-0 lg:flex-1"
								/>
							</TabsContent>
							<TabsContent value="writeup" className="min-h-0 flex-1 overflow-y-auto">
								<SectionCard
									title={t("jeopardy.detail.writeupsTitle")}
									description={t("jeopardy.detail.writeupsDescription")}
								>
									<ChallengeWriteups challengeId={challengeId} />
								</SectionCard>
							</TabsContent>
						</Tabs>
					</>
				)}
			</QueryState>
		</PageBody>
	);
}

export function ChallengeSetsPage() {
	const { t } = useTranslation();
	useDocumentTitle(t("jeopardy.sets.documentTitle"));
	const client = useClient();
	const now = useNow(60_000);
	const [keyword, setKeyword] = useState("");
	const [selected, setSelected] = useState<ChallengeSets | null>(null);
	const query = useQuery({
		queryKey: qk.sets.list({}),
		queryFn: () => call(client.service.challenges.getChallengeSets(), "题集列表"),
	});

	const columns: DataTableColumn<ChallengeSets>[] = [
		{
			id: "name",
			header: t("jeopardy.sets.columns.name"),
			sortValue: (row) => row.name,
			cell: (row) => (
				<div className="min-w-0">
					<p className="truncate text-sm font-medium">{row.name}</p>
					<MonoText className="text-muted-foreground">{row.id}</MonoText>
				</div>
			),
		},
		{
			id: "description",
			header: t("jeopardy.sets.columns.description"),
			cell: (row) => (
				<p className="line-clamp-2 text-sm text-muted-foreground">
					{row.description || t("jeopardy.sets.noDescription")}
				</p>
			),
		},
		{
			id: "updated_at",
			header: t("jeopardy.sets.columns.updatedAt"),
			sortValue: (row) => Date.parse(row.updated_at),
			cell: (row) => (
				<span className="tnum text-xs text-muted-foreground">
					{formatRelative(row.updated_at, now)}
				</span>
			),
			hideBelow: "md",
		},
	];

	return (
		<PageBody>
			<PageHeader
				title={t("jeopardy.sets.title")}
				description={t("jeopardy.sets.subtitle")}
				actions={
					<Button variant="outline" asChild>
						<Link to="/challenges">
							<Puzzle aria-hidden="true" />
							{t("jeopardy.sets.allChallenges")}
						</Link>
					</Button>
				}
			/>
			<QueryState
				query={query}
				skeleton={<LoadingBlock label={t("jeopardy.sets.loading")} />}
				errorTitle={t("jeopardy.sets.loadError")}
				isEmpty={(sets) => sets.length === 0}
				empty={
					<EmptyBlock
						title={t("jeopardy.sets.emptyTitle")}
						description={t("jeopardy.sets.emptyDescription")}
					/>
				}
			>
				{(sets) => {
					const normalized = keyword.trim().toLowerCase();
					const filtered = normalized
						? sets.filter((set) =>
								`${set.name} ${set.description ?? ""}`.toLowerCase().includes(normalized),
							)
						: sets;
					return (
						<>
							<SectionCard
								title={t("jeopardy.sets.listTitle")}
								description={t("jeopardy.sets.listDescription")}
								actions={
									<div className="relative w-full sm:w-72">
										<Search
											aria-hidden="true"
											className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
										/>
										<Input
											value={keyword}
											onChange={(event) => setKeyword(event.target.value)}
											placeholder={t("jeopardy.sets.filterPlaceholder")}
											className="pl-9"
											aria-label={t("jeopardy.sets.filterPlaceholder")}
										/>
									</div>
								}
							>
								<DataTable
									columns={columns}
									data={filtered}
									getRowId={(row) => row.id}
									onRowClick={setSelected}
									empty={
										<EmptyBlock
											title={t("jeopardy.sets.filteredEmptyTitle")}
											description={t("jeopardy.sets.filteredEmptyDescription")}
											action={
												<Button variant="outline" size="sm" onClick={() => setKeyword("")}>
													{t("common.clear")}
												</Button>
											}
										/>
									}
									mobileCard={(row) => (
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0">
												<p className="truncate text-sm font-medium">{row.name}</p>
												<p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
													{row.description || t("jeopardy.sets.noDescription")}
												</p>
											</div>
											<ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
										</div>
									)}
								/>
							</SectionCard>
							<PlayerChallengeSetDialog
								set={selected}
								onOpenChange={(open) => {
									if (!open) setSelected(null);
								}}
							/>
						</>
					);
				}}
			</QueryState>
		</PageBody>
	);
}

function PlayerChallengeSetDialog({
	set,
	onOpenChange,
}: {
	set: ChallengeSets | null;
	onOpenChange: (open: boolean) => void;
}) {
	const { t } = useTranslation();
	const client = useClient();
	const setId = set?.id ?? "";
	const query = useQuery({
		queryKey: qk.sets.detail(setId),
		queryFn: () => call(client.service.challenges.getChallengeSet(setId), "题集详情"),
		enabled: setId !== "",
	});

	const columns: DataTableColumn<ChallengesListItem>[] = [
		{
			id: "name",
			header: t("jeopardy.setDetail.columns.challenge"),
			sortValue: (row) => row.name,
			cell: (row) => (
				<div className="min-w-0">
					<Link
						to={`/challenges/${row.id}`}
						className="truncate text-sm font-medium hover:underline"
					>
						{row.name}
					</Link>
					<p className="truncate text-xs text-muted-foreground">{row.safe_name}</p>
				</div>
			),
		},
		{
			id: "category",
			header: t("jeopardy.setDetail.columns.category"),
			cell: (row) => <TonePill tone="neutral">{row.category}</TonePill>,
			sortValue: (row) => row.category,
		},
		{
			id: "solved",
			header: t("jeopardy.setDetail.columns.status"),
			cell: (row) =>
				row.solved ? (
					<TonePill tone="success" icon={<CheckCircle2 aria-hidden="true" />}>
						{t("jeopardy.common.solved")}
					</TonePill>
				) : (
					<TonePill tone="muted">{t("jeopardy.common.unsolved")}</TonePill>
				),
			sortValue: (row) => (row.solved ? 1 : 0),
		},
	];

	return (
		<Dialog open={set !== null} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>{set?.name ?? t("jeopardy.sets.title")}</DialogTitle>
					<DialogDescription>
						{set?.description || t("jeopardy.sets.noDescription")}
					</DialogDescription>
				</DialogHeader>
				<QueryState
					query={query}
					skeleton={<LoadingBlock label={t("jeopardy.setDetail.loading")} />}
					errorTitle={t("jeopardy.setDetail.loadError")}
					isEmpty={(items) => items.length === 0}
					empty={
						<EmptyBlock
							title={t("jeopardy.setDetail.emptyTitle")}
							description={t("jeopardy.setDetail.emptyDescription")}
						/>
					}
				>
					{(items) => (
						<div className="space-y-3">
							<p className="text-xs text-muted-foreground">
								{t("jeopardy.setDetail.count", { count: items.length })}
							</p>
							<DataTable columns={columns} data={items} getRowId={(row) => row.id} />
						</div>
					)}
				</QueryState>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						{t("common.close")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function ChallengeSetDetailPage() {
	const { t } = useTranslation();
	useDocumentTitle(t("jeopardy.setDetail.documentTitle"));
	const { setId = "" } = useParams<{ setId: string }>();
	const client = useClient();
	const query = useQuery({
		queryKey: qk.sets.detail(setId),
		queryFn: () => call(client.service.challenges.getChallengeSet(setId), "题集详情"),
		enabled: setId !== "",
	});
	// 后端 getChallengeSet 对不存在的 id 返回空数组（与「空题集」无法区分），
	// 用题集列表确认存在性；列表页使用同一 key，通常直接命中缓存。
	const setsQuery = useQuery({
		queryKey: qk.sets.list({}),
		queryFn: () => call<ChallengeSets[]>(client.service.challenges.getChallengeSets(), "题集列表"),
	});

	if (setsQuery.isSuccess && !setsQuery.data.some((item) => item.id === setId)) {
		return (
			<PageBody>
				<NotFoundBlock
					title={t("jeopardy.setDetail.notFoundTitle")}
					description={t("jeopardy.setDetail.notFoundDescription")}
					action={
						<Button asChild variant="outline">
							<Link to="/challenge-sets">{t("jeopardy.setDetail.backToSets")}</Link>
						</Button>
					}
				/>
			</PageBody>
		);
	}

	const columns: DataTableColumn<ChallengesListItem>[] = [
		{
			id: "name",
			header: t("jeopardy.setDetail.columns.challenge"),
			sortValue: (row) => row.name,
			cell: (row) => (
				<div className="min-w-0">
					<Link
						to={`/challenges/${row.id}`}
						className="truncate text-sm font-medium hover:underline"
						title={row.name}
					>
						{row.name}
					</Link>
					<p className="truncate text-xs text-muted-foreground" title={row.safe_name}>
						{row.safe_name}
					</p>
				</div>
			),
		},
		{
			id: "category",
			header: t("jeopardy.setDetail.columns.category"),
			sortValue: (row) => row.category,
			cell: (row) => (
				<TonePill tone="neutral">
					{row.category || t("jeopardy.common.categoryFallback")}
				</TonePill>
			),
		},
		{
			id: "solved",
			header: t("jeopardy.setDetail.columns.status"),
			align: "right",
			sortValue: (row) => (row.solved ? 1 : 0),
			cell: (row) =>
				row.solved ? (
					<TonePill tone="success" icon={<CheckCircle2 aria-hidden="true" />}>
						{t("jeopardy.common.solved")}
					</TonePill>
				) : (
					<TonePill tone="muted">{t("jeopardy.common.unsolved")}</TonePill>
				),
		},
	];

	return (
		<PageBody>
			<PageHeader
				title={t("jeopardy.setDetail.title")}
				breadcrumbs={
					<Link to="/challenge-sets" className="hover:underline">
						{t("jeopardy.setDetail.breadcrumbSets")}
					</Link>
				}
			/>
			<QueryState
				query={query}
				skeleton={<LoadingBlock label={t("jeopardy.setDetail.loading")} />}
				errorTitle={t("jeopardy.setDetail.loadError")}
				isEmpty={(items) => items.length === 0}
				empty={
					<NotFoundBlock
						title={t("jeopardy.setDetail.emptyTitle")}
						description={t("jeopardy.setDetail.emptyDescription")}
						action={
							<Button variant="outline" asChild>
								<Link to="/challenge-sets">{t("jeopardy.setDetail.backToSets")}</Link>
							</Button>
						}
					/>
				}
			>
				{(items) => (
					<SectionCard
						title={
							<span className="tnum">
								{t("jeopardy.setDetail.count", { count: items.length })}
							</span>
						}
						contentClassName="px-0"
					>
						<DataTable
							data={items}
							getRowId={(row) => row.id}
							columns={columns}
							mobileCard={(row) => (
								<div className="flex items-center justify-between gap-3">
									<div className="min-w-0">
										<Link
											to={`/challenges/${row.id}`}
											className="truncate text-sm font-medium hover:underline"
											title={row.name}
										>
											{row.name}
										</Link>
										<p className="truncate text-xs text-muted-foreground">
											{row.category || t("jeopardy.common.categoryFallback")}
										</p>
									</div>
									{row.solved ? (
										<TonePill tone="success" icon={<CheckCircle2 aria-hidden="true" />}>
											{t("jeopardy.common.solved")}
										</TonePill>
									) : (
										<TonePill tone="muted">{t("jeopardy.common.unsolved")}</TonePill>
									)}
								</div>
							)}
						/>
					</SectionCard>
				)}
			</QueryState>
		</PageBody>
	);
}
