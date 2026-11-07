/**
 * 题解 —— 列表与详情（`challenges.getAllWriteups` / `challenges.getWriteup`）。
 *
 * 真实语义（已在 SDK / 后端源码核对）：
 * - `GET /writeups` **一次性返回全部条目，不返回分页 meta**，也不支持文本搜索
 *   （后端只支持 `id` / `challenge_id` 两个过滤键）。因此本页的搜索与分页是
 *   **视图内**行为，页面上如实写明，不做假的「服务端搜索」。
 * - `GET /writeups/{id}` 同时覆盖 challenge 与 gamebox（AWDP 练习）两类题解；
 *   gamebox 条目的 `id` 就是 `run_id`，且只对属主可见（非本人 403）。
 * - 题解正文是 Markdown，用 `<MarkdownView>` 渲染（不启用 raw HTML）。
 */

import { useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, ExternalLink, Mail } from "lucide-react";

import type { UnifiedWriteupDetail, UnifiedWriteupResult } from "@floatctf/sdk";

import { call, callList } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { TonePill } from "~/components/app/badges";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
import { MarkdownView } from "~/components/app/markdown";
import {
	PageBody,
	PageHeader,
	PaginationBar,
	SectionCard,
	Toolbar,
} from "~/components/app/page";
import {
	EmptyBlock,
	LoadingBlock,
	QueryState,
	RefreshingBadge,
	TableSkeleton,
} from "~/components/app/states";
import { RelativeTime, UserAvatar, UserCell } from "~/components/app/user-cell";
import { Button } from "~/components/ui/button";
import { useDebouncedValue, useDocumentTitle } from "~/lib/hooks";

import { SearchField } from "./components";

function writeupTypeLabel(t: TFunction, type: UnifiedWriteupResult["writeup_type"]): string {
	return type === "gamebox"
		? t("community.writeups.type.gamebox")
		: t("community.writeups.type.challenge");
}

function writeupTypeTone(type: UnifiedWriteupResult["writeup_type"]): "info" | "success" {
	return type === "gamebox" ? "success" : "info";
}

/** 题解列表：接口一次返回全部，视图内搜索 + 分页。 */
export function WriteupsPage(): ReactNode {
	const { t } = useTranslation();
	useDocumentTitle(t("community.writeups.documentTitle"));
	const client = useClient();
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(20);
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebouncedValue(search, 300);

	const query = useQuery({
		queryKey: qk.writeups.list({}),
		queryFn: () => callList<UnifiedWriteupResult>(client.service.challenges.getAllWriteups()),
	});

	const trimmed = debouncedSearch.trim().toLowerCase();
	const filtered = useMemo(() => {
		const items = query.data?.items ?? [];
		if (trimmed === "") return items;
		return items.filter(
			(item) =>
				item.content_name.toLowerCase().includes(trimmed) ||
				item.nickname.toLowerCase().includes(trimmed) ||
				item.email.toLowerCase().includes(trimmed),
		);
	}, [query.data, trimmed]);

	const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

	const columns: DataTableColumn<UnifiedWriteupResult>[] = [
		{
			id: "content_name",
			header: t("community.writeups.columns.content"),
			sortValue: (row) => row.content_name,
			cell: (row) => (
				<Link to={`/writeups/${row.id}`} className="text-sm font-medium hover:underline">
					{row.content_name}
				</Link>
			),
		},
		{
			id: "writeup_type",
			header: t("community.writeups.columns.type"),
			hideBelow: "sm",
			sortValue: (row) => row.writeup_type,
			cell: (row) => (
				<TonePill tone={writeupTypeTone(row.writeup_type)}>
					{writeupTypeLabel(t, row.writeup_type)}
				</TonePill>
			),
		},
		{
			id: "nickname",
			header: t("community.writeups.columns.author"),
			sortValue: (row) => row.nickname,
			cell: (row) => (
				<UserCell
					username={row.nickname}
					nickname={row.nickname}
					avatar={row.avatar ?? null}
					secondary="none"
				/>
			),
		},
		{
			id: "email",
			header: t("community.writeups.columns.email"),
			hideBelow: "lg",
			sortValue: (row) => row.email,
			cell: (row) =>
				row.email ? (
					<a
						href={`mailto:${row.email}`}
						className="inline-flex items-center gap-1 text-xs hover:underline"
					>
						<Mail aria-hidden="true" className="size-4" />
						{row.email}
					</a>
				) : (
					<span className="text-xs text-muted-foreground">{t("common.empty")}</span>
				),
		},
		{
			id: "updated_at",
			header: t("community.writeups.columns.updatedAt"),
			align: "right",
			sortValue: (row) => row.updated_at,
			cell: (row) => <RelativeTime value={row.updated_at} />,
		},
	];

	return (
		<PageBody>
			<PageHeader
				title={t("community.writeups.title")}
				description={t("community.writeups.subtitle")}
				badge={<TonePill tone="info">{t("community.writeups.badge")}</TonePill>}
			/>

			<SectionCard
				title={t("community.writeups.section.title")}
				description={t("community.writeups.section.description")}
				actions={
					<Toolbar>
						<RefreshingBadge active={query.isFetching && !query.isPending} />
						<SearchField
							value={search}
							placeholder={t("community.writeups.search.placeholder")}
							onChange={(value) => {
								setSearch(value);
								setPage(1);
							}}
						/>
					</Toolbar>
				}
				contentClassName="px-0"
				footer={
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
				}
			>
				<QueryState
					query={query}
					skeleton={<TableSkeleton rows={6} columns={5} />}
					errorTitle={t("community.writeups.errors.load")}
					// 搜索是视图内的：过滤后为空也要走空态（而不是让表格显示空白）。
					isEmpty={() => filtered.length === 0}
					empty={
						trimmed === "" ? (
							<EmptyBlock
								title={t("community.writeups.empty.title")}
								description={t("community.writeups.empty.description")}
								icon={<BookOpen aria-hidden="true" />}
								action={
									<Button size="sm" asChild>
										<Link to="/challenges">{t("community.writeups.empty.action")}</Link>
									</Button>
								}
							/>
						) : (
							<EmptyBlock
								variant="filtered"
								description={t("community.writeups.filtered.description", {
									count: query.data?.items.length ?? 0,
									query: debouncedSearch.trim(),
								})}
								action={
									<Button size="sm" variant="outline" onClick={() => setSearch("")}>
										{t("community.writeups.filtered.clear")}
									</Button>
								}
							/>
						)
					}
				>
					{() => (
						<DataTable
							data={paged}
							getRowId={(row) => row.id}
							columns={columns}
							mobileCard={(row) => (
								<div className="space-y-1.5">
									<div className="flex items-start justify-between gap-2">
										<Link
											to={`/writeups/${row.id}`}
											className="text-sm font-medium hover:underline"
										>
											{row.content_name}
										</Link>
										<TonePill tone={writeupTypeTone(row.writeup_type)}>
											{writeupTypeLabel(t, row.writeup_type)}
										</TonePill>
									</div>
									<UserCell
										username={row.nickname}
										nickname={row.nickname}
										avatar={row.avatar ?? null}
										secondary="none"
									/>
									<div className="flex items-center justify-between text-xs text-muted-foreground">
										<span className="truncate">{row.email}</span>
										<RelativeTime value={row.updated_at} />
									</div>
								</div>
							)}
						/>
					)}
				</QueryState>
			</SectionCard>
		</PageBody>
	);
}

/** 题解详情：challenge 与 gamebox 统一渲染。 */
export function WriteupDetailPage(): ReactNode {
	const { t } = useTranslation();
	const params = useParams<{ id: string }>();
	const writeupId = params.id ?? "";
	const client = useClient();

	const query = useQuery({
		queryKey: qk.writeups.detail(writeupId),
		queryFn: () =>
			call<UnifiedWriteupDetail>(
				client.service.challenges.getWriteup(writeupId),
				t("community.requests.writeupDetail"),
			),
		enabled: writeupId !== "",
	});

	const writeup = query.data;
	useDocumentTitle(
		writeup
			? t("community.writeups.detail.documentTitle", { title: writeup.content_name })
			: t("community.writeups.detail.documentTitleFallback"),
	);

	return (
		<PageBody>
			<PageHeader
				title={writeup?.content_name ?? t("community.writeups.detail.titleFallback")}
				description={
					writeup ? (
						<span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
							<span className="inline-flex items-center gap-1.5">
								<UserAvatar
									name={writeup.nickname}
									avatar={writeup.avatar ?? null}
									size="sm"
								/>
								<span className="text-foreground">{writeup.nickname}</span>
							</span>
							<span className="text-xs text-muted-foreground">
								{t("community.writeups.detail.updatedLabel")}{" "}
								<RelativeTime value={writeup.updated_at} />
							</span>
							<span className="text-xs text-muted-foreground">
								{t("community.writeups.detail.createdLabel")}{" "}
								<RelativeTime value={writeup.created_at} />
							</span>
						</span>
					) : (
						t("community.writeups.detail.subtitleFallback")
					)
				}
				badge={
					writeup ? (
						<TonePill tone={writeupTypeTone(writeup.writeup_type)}>
							{writeupTypeLabel(t, writeup.writeup_type)}
						</TonePill>
					) : null
				}
				breadcrumbs={
					<Link to="/writeups" className="inline-flex items-center gap-1 hover:underline">
						<ArrowLeft aria-hidden="true" className="size-4" /> {t("community.writeups.detail.back")}
					</Link>
				}
				actions={
					writeup ? (
						<Toolbar>
							{writeup.writeup_type === "challenge" ? (
								<Button variant="outline" asChild>
									<Link to={`/challenges/${writeup.content_id}`}>
										<ExternalLink aria-hidden="true" /> {t("community.writeups.detail.openChallenge")}
									</Link>
								</Button>
							) : (
								<Button variant="outline" asChild>
									<Link to={`/training/runs/${writeup.id}`}>
										<ExternalLink aria-hidden="true" /> {t("community.writeups.detail.openRun")}
									</Link>
								</Button>
							)}
						</Toolbar>
					) : null
				}
			/>

			<QueryState
				query={query}
				skeleton={<LoadingBlock label={t("community.writeups.detail.loading")} />}
				errorTitle={t("community.writeups.detail.loadError")}
			>
				{(data) => (
					<div className="space-y-5">
						<SectionCard
							title={t("community.writeups.detail.metaTitle")}
							description={t("community.writeups.detail.metaDescription")}
						>
							<div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
								<span className="text-muted-foreground">
									{t("community.writeups.detail.contentLabel")}
									{data.writeup_type === "challenge" ? (
										<Link
											to={`/challenges/${data.content_id}`}
											className="text-foreground hover:underline"
										>
											{data.category ? `${data.category} / ` : ""}
											{data.content_name}
										</Link>
									) : (
										<span className="text-foreground">{data.content_name}</span>
									)}
								</span>
								<span className="text-muted-foreground">
									{t("community.writeups.detail.authorLabel")}
									<span className="text-foreground">{data.nickname}</span>
								</span>
								{data.email ? (
									<a
										href={`mailto:${data.email}`}
										className="inline-flex items-center gap-1 text-muted-foreground hover:underline"
									>
										<Mail aria-hidden="true" className="size-4" />
										{data.email}
									</a>
								) : null}
							</div>
						</SectionCard>

						<SectionCard
							title={t("community.writeups.detail.contentTitle")}
							description={t("community.writeups.detail.contentDescription")}
						>
							<div className="rounded-md border bg-muted/20 px-4 py-3">
								<MarkdownView>{data.content}</MarkdownView>
							</div>
						</SectionCard>
					</div>
				)}
			</QueryState>
		</PageBody>
	);
}
