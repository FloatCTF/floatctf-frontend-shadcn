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
import { isNotFound } from "~/api/errors";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { TonePill } from "~/components/app/badges";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
import { FilterBar, type FilterKey } from "~/components/app/filter-bar";
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
	NotFoundBlock,
	QueryState,
	TableSkeleton,
} from "~/components/app/states";
import { RelativeTime, UserAvatar, UserCell } from "~/components/app/user-cell";
import { Button } from "~/components/ui/button";
import { formatDateTime } from "~/lib/format";
import { useDocumentTitle } from "~/lib/hooks";


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
	const [draftFilter, setDraftFilter] = useState("");
	const [appliedFilter, setAppliedFilter] = useState("");

	const query = useQuery({
		queryKey: qk.writeups.list({}),
		queryFn: () => callList<UnifiedWriteupResult>(client.service.challenges.getAllWriteups()),
	});

	const filtered = useMemo(() => {
		const items = query.data?.items ?? [];
		const clauses = appliedFilter
			.split("&")
			.map((clause) => clause.trim())
			.filter(Boolean);
		if (clauses.length === 0) return items;
		return items.filter((item) =>
			clauses.every((clause) => {
				const separator = clause.indexOf(":");
				const key = (separator >= 0 ? clause.slice(0, separator) : "").trim();
				const value = (separator >= 0 ? clause.slice(separator + 1) : clause).trim().toLowerCase();
				const record = item as Record<string, unknown>;
				if (key in record) return String(record[key] ?? "").toLowerCase().includes(value);
				return `${item.content_name} ${item.nickname} ${item.email}`.toLowerCase().includes(clause.toLowerCase());
			}),
		);
	}, [query.data, appliedFilter]);

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
			id: "writeup_type",
			header: t("community.writeups.columns.type"),
			sortValue: (row) => row.writeup_type,
			cell: (row) => (
				<TonePill tone={writeupTypeTone(row.writeup_type)}>
					{writeupTypeLabel(t, row.writeup_type)}
				</TonePill>
			),
		},
		{
			id: "email",
			header: t("community.writeups.columns.email"),
			sortValue: (row) => row.email,
			cell: (row) =>
				row.email ? (
					<a href={`mailto:${row.email}`} className="text-xs hover:underline">
						{row.email}
					</a>
				) : (
					<span className="text-xs text-muted-foreground">{t("common.empty")}</span>
				),
		},
		{
			id: "updated_at",
			header: t("community.writeups.columns.updatedAt"),
			sortValue: (row) => row.updated_at,
			cell: (row) => <span className="tnum text-xs">{formatDateTime(row.updated_at)}</span>,
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
					<FilterBar
						keys={[
							{ key: "challenge_id", label: t("community.writeups.columns.content") },
						] satisfies FilterKey[]}
						value={draftFilter}
						onChange={setDraftFilter}
						onApply={() => {
							setAppliedFilter(draftFilter.trim());
							setPage(1);
						}}
						onClear={() => {
							setDraftFilter("");
							setAppliedFilter("");
							setPage(1);
						}}
						placeholder={t("common.filter.placeholder")}
					/>
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
						appliedFilter === "" ? (
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
								title={t("community.writeups.filtered.title")}
								description={t("community.writeups.filtered.description", {
									count: query.data?.items.length ?? 0,
									query: appliedFilter,
								})}
								action={
									<Button size="sm" variant="outline" onClick={() => {
										setDraftFilter("");
										setAppliedFilter("");
									}}>
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

	if (query.isError && isNotFound(query.error)) {
		return (
			<PageBody>
				<NotFoundBlock
					title={t("community.writeups.detail.notFoundTitle")}
					description={t("community.writeups.detail.notFoundDescription")}
					action={
						<Button asChild variant="outline">
							<Link to="/writeups">{t("community.writeups.detail.back")}</Link>
						</Button>
					}
				/>
			</PageBody>
		);
	}

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
							{writeup.email ? (
								<a
									href={`mailto:${writeup.email}`}
									className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
								>
									<Mail aria-hidden="true" className="size-4" />
									{writeup.email}
								</a>
							) : null}
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
									<Link to={`/training/runs/${writeup.content_id}`}>
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
