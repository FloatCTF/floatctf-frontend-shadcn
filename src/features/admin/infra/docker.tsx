/**
 * 管理端 · Docker 容器 / 镜像 / 网络（`/admin/infra/docker`，specialized 能力）。
 *
 * 真实接口：`client.admin.docker.*`（全部经宿主 helper 的受限协议，API 自身无 Docker socket）。
 * 必须遵守的接口细节：
 * - 三个列表接口都用 **`offset` / `limit`** 分页（`apps/api/src/modules/platform/operations/docker.rs`），
 *   不是 `page`；`meta.total` 是真实总数。因此查询键用
 *   `[...qk.admin.dockerXxx(), params]` 扩展（qk 工厂本身无参，前缀失效仍然匹配）。
 * - 后端 Docker 接口**没有 filter 映射** ⇒ 搜索只在当前页内生效，界面上明确标注。
 * - `FloatDockerContainer.status` 来自 bollard 的 `{:?}`（`Running` / `Exited` / `Created` /
 *   `Paused` / `Restarting` / `Removing` / `Dead`），比较时必须忽略大小写；
 *   `ports` 是**字符串**（后端已拼好 `ip:public` 形式），`created` 是 Unix 秒。
 * - `NetworkInfo` 运行时**没有** `created` 字段（SDK 类型多声明了它），本页不读取。
 * - helper 未就绪 / Docker 不可达时后端返回 5xx，错误文案通过 `ErrorBlock` 原样显示。
 */

import { useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
	keepPreviousData,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import type { TFunction } from "i18next";
import {
	Container,
	HardDrive,
	Info,
	Network as NetworkIcon,
	Play,
	Plus,
	RefreshCw,
	Square,
	Trash2,
} from "lucide-react";

import type {
	FloatDockerContainer,
	ImageInfo,
	NetworkInfo,
	QueryParams,
} from "@floatctf/sdk";

import { call, callList, callVoid } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { TonePill, type PillTone } from "~/components/app/badges";
import { useConfirm } from "~/components/app/confirm";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
import { Field, FormFooter, FormGrid, FormSheet } from "~/components/app/form";
import {
	CopyText,
	MonoText,
	PageBody,
	PageHeader,
	PaginationBar,
	SectionCard,
	Toolbar,
} from "~/components/app/page";
import {
	EmptyBlock,
	QueryState,
	RefreshingBadge,
	TableSkeleton,
} from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { AbsoluteTime } from "~/components/app/user-cell";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { formatBytes, truncate } from "~/lib/format";
import { useDocumentTitle } from "~/lib/hooks";

import { SearchInput, filterCurrentPage, fromUnixSeconds, useListState } from "./components";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/** Docker 自身输出的「无标签」表示，属于技术标识，不做本地化。 */
const NONE_TAG = "<none>";
/** 高危确认词（只在 UI 层，后端契约是 ADMIN_CONFIRMED 前缀）。 */
const STOP_PHRASE = "STOP";
const DELETE_PHRASE = "DELETE";

/** 容器状态（bollard Debug 输出）→ 语义色。 */
function containerTone(status: string): PillTone {
	switch (status.toLowerCase()) {
		case "running":
			return "success";
		case "paused":
		case "restarting":
		case "created":
			return "warning";
		case "exited":
		case "dead":
		case "removing":
			return "muted";
		default:
			return "neutral";
	}
}

/** 已知状态的本地化标签；未知状态原样展示，不猜语义。 */
const CONTAINER_STATUS_KEYS: Record<string, string> = {
	created: "created",
	running: "running",
	paused: "paused",
	restarting: "restarting",
	removing: "removing",
	exited: "exited",
	dead: "dead",
};

function containerStatusText(status: string, t: TFunction): string {
	const key = CONTAINER_STATUS_KEYS[status.toLowerCase()];
	return key ? t(`adminInfra.docker.status.${key}`) : status;
}

function isRunning(status: string): boolean {
	return status.toLowerCase() === "running";
}

function offsetParams(page: number, pageSize: number): QueryParams {
	return { offset: (Math.max(1, page) - 1) * pageSize, limit: pageSize };
}

/** 容器的展示名：没有名称时用 ID 前缀（与 toast / 确认框保持一致）。 */
function containerLabel(row: FloatDockerContainer): string {
	return row.name || row.id.slice(0, 12);
}

export function AdminDockerPage(): ReactNode {
	const { t } = useTranslation();
	useDocumentTitle(t("adminInfra.docker.documentTitle"));

	return (
		<PageBody>
			<PageHeader
				title={t("adminInfra.docker.title")}
				description={t("adminInfra.docker.description")}
				badge={<TonePill tone="muted">{t("adminInfra.specialized")}</TonePill>}
			/>

			<Tabs defaultValue="containers">
				<TabsList className="max-w-full overflow-x-auto">
					<TabsTrigger value="containers">
						<Container className="size-4" aria-hidden="true" />
						{t("adminInfra.docker.tabs.containers")}
					</TabsTrigger>
					<TabsTrigger value="images">
						<HardDrive className="size-4" aria-hidden="true" />
						{t("adminInfra.docker.tabs.images")}
					</TabsTrigger>
					<TabsTrigger value="networks">
						<NetworkIcon className="size-4" aria-hidden="true" />
						{t("adminInfra.docker.tabs.networks")}
					</TabsTrigger>
				</TabsList>
				<TabsContent value="containers" className="mt-4">
					<ContainersTab />
				</TabsContent>
				<TabsContent value="images" className="mt-4">
					<ImagesTab />
				</TabsContent>
				<TabsContent value="networks" className="mt-4">
					<NetworksTab />
				</TabsContent>
			</Tabs>
		</PageBody>
	);
}

// ── 容器 ────────────────────────────────────────────────────────────────────

function ContainersTab(): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const list = useListState(20);
	const empty = t("common.empty");
	const params = offsetParams(list.page, list.pageSize);

	const query = useQuery({
		queryKey: [...qk.admin.dockerContainers(), params],
		queryFn: () =>
			callList<FloatDockerContainer>(client.admin.docker.fetchContainers(params)),
		placeholderData: keepPreviousData,
	});

	function invalidate() {
		void queryClient.invalidateQueries({ queryKey: qk.admin.dockerContainers() });
	}

	const startMutation = useMutation({
		mutationFn: (row: FloatDockerContainer) =>
			callVoid(
				client.admin.docker.startContainer(row.id),
				t("adminInfra.docker.containers.actions.start"),
			),
		onSuccess: (_data, row) => {
			toast.success(
				t("adminInfra.docker.containers.toast.started", { name: containerLabel(row) }),
			);
			invalidate();
		},
		onError: (error) =>
			toast.apiError(t("adminInfra.docker.containers.toast.startFailed"), error),
	});

	const stopMutation = useMutation({
		mutationFn: (row: FloatDockerContainer) =>
			callVoid(
				client.admin.docker.stopContainer(row.id),
				t("adminInfra.docker.containers.actions.stop"),
			),
		onSuccess: (_data, row) => {
			toast.success(
				t("adminInfra.docker.containers.toast.stopped", { name: containerLabel(row) }),
			);
			invalidate();
		},
		onError: (error) =>
			toast.apiError(t("adminInfra.docker.containers.toast.stopFailed"), error),
	});

	const deleteMutation = useMutation({
		mutationFn: (row: FloatDockerContainer) =>
			callVoid(
				client.admin.docker.deleteContainer(row.id),
				t("adminInfra.docker.containers.actions.delete"),
			),
		onSuccess: (_data, row) => {
			toast.success(
				t("adminInfra.docker.containers.toast.deleted", { name: containerLabel(row) }),
			);
			invalidate();
			void queryClient.invalidateQueries({ queryKey: qk.admin.dockerImages() });
			void queryClient.invalidateQueries({ queryKey: qk.admin.dockerNetworks() });
		},
		onError: (error) =>
			toast.apiError(t("adminInfra.docker.containers.toast.deleteFailed"), error),
	});

	async function startContainer(row: FloatDockerContainer) {
		const ok = await confirm({
			title: t("adminInfra.docker.containers.confirm.start.title", {
				name: containerLabel(row),
			}),
			description: t("adminInfra.docker.containers.confirm.start.description", {
				image: row.image,
			}),
			consequences: [
				t("adminInfra.docker.containers.confirm.start.consequenceResources"),
				t("adminInfra.docker.containers.confirm.start.consequenceLifecycle"),
			],
			confirmText: t("adminInfra.docker.containers.confirm.start.confirm"),
		});
		if (!ok) return;
		startMutation.mutate(row);
	}

	async function stopContainer(row: FloatDockerContainer) {
		const ok = await confirm({
			title: t("adminInfra.docker.containers.confirm.stop.title", {
				name: containerLabel(row),
			}),
			description: t("adminInfra.docker.containers.confirm.stop.description", {
				image: row.image,
				status: containerStatusText(row.status, t),
			}),
			consequences: [
				t("adminInfra.docker.containers.confirm.stop.consequenceProcesses"),
				t("adminInfra.docker.containers.confirm.stop.consequencePlayers"),
				t("adminInfra.docker.containers.confirm.stop.consequenceRestart"),
			],
			tone: "danger",
			confirmText: t("adminInfra.docker.containers.confirm.stop.confirm"),
			confirmPhrase: STOP_PHRASE,
		});
		if (!ok) return;
		stopMutation.mutate(row);
	}

	async function deleteContainer(row: FloatDockerContainer) {
		const ok = await confirm({
			title: t("adminInfra.docker.containers.confirm.delete.title", {
				name: containerLabel(row),
			}),
			description: t("adminInfra.docker.containers.confirm.delete.description", {
				image: row.image,
				status: containerStatusText(row.status, t),
			}),
			consequences: [
				t("adminInfra.docker.containers.confirm.delete.consequenceData"),
				t("adminInfra.docker.containers.confirm.delete.consequenceInstance"),
				t("adminInfra.docker.containers.confirm.delete.consequenceIrreversible"),
			],
			tone: "danger",
			confirmText: t("adminInfra.docker.containers.confirm.delete.confirm"),
			confirmPhrase: DELETE_PHRASE,
		});
		if (!ok) return;
		deleteMutation.mutate(row);
	}

	const rows = query.data?.items ?? [];
	const visible = filterCurrentPage(rows, list.filter, (row) => [
		row.id,
		row.name,
		row.image,
		row.status,
	]);

	const columns: DataTableColumn<FloatDockerContainer>[] = [
		{
			id: "id",
			header: t("adminInfra.docker.columns.containerId"),
			hideBelow: "md",
			cell: (row) => (
				<CopyText value={row.id} label={t("adminInfra.docker.columns.containerId")} />
			),
		},
		{
			id: "name",
			header: t("adminInfra.docker.columns.name"),
			sortValue: (row) => row.name,
			cell: (row) => <span className="font-mono font-medium">{row.name || empty}</span>,
		},
		{
			id: "image",
			header: t("adminInfra.docker.columns.image"),
			hideBelow: "lg",
			cell: (row) => (
				<MonoText className="text-muted-foreground" title={row.image}>
					{truncate(row.image, 34)}
				</MonoText>
			),
		},
		{
			id: "status",
			header: t("adminInfra.docker.columns.status"),
			sortValue: (row) => row.status,
			cell: (row) => (
				<TonePill tone={containerTone(row.status)} title={row.status}>
					{containerStatusText(row.status, t)}
				</TonePill>
			),
		},
		{
			id: "ports",
			header: t("adminInfra.docker.columns.ports"),
			hideBelow: "md",
			cell: (row) => (
				<MonoText className="text-muted-foreground">{row.ports || empty}</MonoText>
			),
		},
		{
			id: "created",
			header: t("adminInfra.docker.columns.createdAt"),
			align: "right",
			sortValue: (row) => row.created,
			cell: (row) => {
				const created = fromUnixSeconds(row.created);
				return created ? <AbsoluteTime value={created} /> : <span>{empty}</span>;
			},
		},
	];

	return (
		<SectionCard
			title={t("adminInfra.docker.containers.section.title")}
			description={t("adminInfra.docker.containers.section.description")}
			actions={
				<Toolbar>
					<RefreshingBadge active={query.isFetching && !query.isPending} />
					<SearchInput
						value={list.search}
						onChange={list.setSearch}
						placeholder={t("adminInfra.docker.containers.searchPlaceholder")}
					/>
					<Button
						variant="outline"
						size="sm"
						onClick={() => void query.refetch()}
						disabled={query.isFetching}
					>
						<RefreshCw className="size-4" aria-hidden="true" />
						{t("common.refresh")}
					</Button>
				</Toolbar>
			}
		>
			<QueryState
				query={query}
				skeleton={<TableSkeleton rows={6} columns={6} />}
				errorTitle={t("adminInfra.docker.containers.errorTitle")}
				isEmpty={(result) => result.items.length === 0}
				empty={
					<EmptyBlock
						title={t("adminInfra.docker.containers.empty.title")}
						description={t("adminInfra.docker.containers.empty.description")}
					/>
				}
			>
				{(result) => (
					<div className="space-y-3">
						{visible.length === 0 ? (
							<EmptyBlock
								variant="filtered"
								title={t("adminInfra.docker.containers.filtered.title")}
								description={t("adminInfra.docker.containers.filtered.description")}
							/>
						) : (
							<DataTable
								data={visible}
								getRowId={(row) => row.id}
								columns={columns}
								rowActions={(row) => (
									<div className="flex items-center gap-1">
										{isRunning(row.status) ? (
											<Button
												variant="ghost"
												size="icon-sm"
												aria-label={t("adminInfra.docker.containers.actions.stop")}
												title={t("adminInfra.docker.containers.actions.stop")}
												disabled={stopMutation.isPending}
												onClick={() => void stopContainer(row)}
											>
												<Square />
											</Button>
										) : (
											<Button
												variant="ghost"
												size="icon-sm"
												aria-label={t("adminInfra.docker.containers.actions.start")}
												title={t("adminInfra.docker.containers.actions.start")}
												disabled={startMutation.isPending}
												onClick={() => void startContainer(row)}
											>
												<Play />
											</Button>
										)}
										<Button
											variant="ghost"
											size="icon-sm"
											className="text-destructive"
											aria-label={t("adminInfra.docker.containers.actions.delete")}
											title={t("adminInfra.docker.containers.actions.delete")}
											disabled={deleteMutation.isPending}
											onClick={() => void deleteContainer(row)}
										>
											<Trash2 />
										</Button>
									</div>
								)}
								mobileCard={(row) => (
									<div className="space-y-2">
										<div className="flex items-start justify-between gap-2">
											<span className="min-w-0 font-mono font-medium break-words">
												{row.name || empty}
											</span>
											<TonePill tone={containerTone(row.status)} title={row.status}>
												{containerStatusText(row.status, t)}
											</TonePill>
										</div>
										<p className="text-xs text-muted-foreground">
											<MonoText>{truncate(row.image, 40)}</MonoText>
										</p>
										<p className="flex items-baseline gap-1 text-xs text-muted-foreground">
											{t("adminInfra.docker.containers.portsLabel")}
											<MonoText>{row.ports || empty}</MonoText>
										</p>
										<div className="flex items-center gap-2">
											{isRunning(row.status) ? (
												<Button
													variant="outline"
													size="sm"
													onClick={() => void stopContainer(row)}
												>
													<Square className="size-4" aria-hidden="true" />
													{t("adminInfra.docker.containers.actions.stopShort")}
												</Button>
											) : (
												<Button
													variant="outline"
													size="sm"
													onClick={() => void startContainer(row)}
												>
													<Play className="size-4" aria-hidden="true" />
													{t("adminInfra.docker.containers.actions.startShort")}
												</Button>
											)}
											<Button
												variant="ghost"
												size="sm"
												className="text-destructive"
												onClick={() => void deleteContainer(row)}
											>
												<Trash2 className="size-4" aria-hidden="true" />
												{t("adminInfra.docker.containers.actions.deleteShort")}
											</Button>
										</div>
									</div>
								)}
							/>
						)}
						<PaginationBar
							page={list.page}
							pageSize={list.pageSize}
							total={result.meta.total ?? rows.length}
							onPageChange={list.setPage}
							onPageSizeChange={list.setPageSize}
							pageSizeOptions={PAGE_SIZE_OPTIONS}
						/>
					</div>
				)}
			</QueryState>
		</SectionCard>
	);
}

// ── 镜像 ────────────────────────────────────────────────────────────────────

function ImagesTab(): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const list = useListState(20);
	const empty = t("common.empty");
	const params = offsetParams(list.page, list.pageSize);

	const query = useQuery({
		queryKey: [...qk.admin.dockerImages(), params],
		queryFn: () => callList<ImageInfo>(client.admin.docker.fetchImages(params)),
		placeholderData: keepPreviousData,
	});

	const deleteMutation = useMutation({
		mutationFn: (row: ImageInfo) =>
			callVoid(
				client.admin.docker.deleteImage(row.id),
				t("adminInfra.docker.images.actions.delete"),
			),
		onSuccess: () => {
			toast.success(t("adminInfra.docker.images.toast.deleted"));
			void queryClient.invalidateQueries({ queryKey: qk.admin.dockerImages() });
		},
		onError: (error) =>
			toast.apiError(t("adminInfra.docker.images.toast.deleteFailed"), error),
	});

	async function deleteImage(row: ImageInfo) {
		const label = row.repo_tags.length > 0 ? row.repo_tags.join(", ") : row.id.slice(0, 12);
		const ok = await confirm({
			title: t("adminInfra.docker.images.confirm.title", { name: truncate(label, 40) }),
			description: t("adminInfra.docker.images.confirm.description", {
				id: row.id.slice(0, 12),
				size: formatBytes(row.size),
			}),
			consequences: [
				t("adminInfra.docker.images.confirm.consequenceDependents"),
				t("adminInfra.docker.images.confirm.consequenceRebuild"),
				t("adminInfra.docker.images.confirm.consequenceIrreversible"),
			],
			tone: "danger",
			confirmText: t("adminInfra.docker.images.confirm.confirm"),
			confirmPhrase: DELETE_PHRASE,
		});
		if (!ok) return;
		deleteMutation.mutate(row);
	}

	const rows = query.data?.items ?? [];
	const visible = filterCurrentPage(rows, list.filter, (row) => [row.id, ...row.repo_tags]);

	const columns: DataTableColumn<ImageInfo>[] = [
		{
			id: "repo_tags",
			header: t("adminInfra.docker.columns.tags"),
			cell: (row) =>
				row.repo_tags.length === 0 ? (
					<TonePill tone="muted">{NONE_TAG}</TonePill>
				) : (
					<div className="flex flex-wrap gap-1">
						{row.repo_tags.map((tag) => (
							<MonoText key={tag} className="rounded-md bg-muted px-1.5 py-0.5">
								{tag}
							</MonoText>
						))}
					</div>
				),
		},
		{
			id: "id",
			header: t("adminInfra.docker.columns.imageId"),
			hideBelow: "md",
			cell: (row) => <MonoText className="text-muted-foreground">{row.id.slice(0, 24)}</MonoText>,
		},
		{
			id: "size",
			header: t("adminInfra.docker.columns.size"),
			align: "right",
			sortValue: (row) => row.size,
			cell: (row) => <MonoText>{formatBytes(row.size)}</MonoText>,
		},
		{
			id: "created",
			header: t("adminInfra.docker.columns.createdAt"),
			align: "right",
			sortValue: (row) => row.created,
			cell: (row) => {
				const created = fromUnixSeconds(row.created);
				return created ? <AbsoluteTime value={created} /> : <span>{empty}</span>;
			},
		},
	];

	return (
		<SectionCard
			title={t("adminInfra.docker.images.section.title")}
			description={t("adminInfra.docker.images.section.description")}
			actions={
				<Toolbar>
					<RefreshingBadge active={query.isFetching && !query.isPending} />
					<SearchInput
						value={list.search}
						onChange={list.setSearch}
						placeholder={t("adminInfra.docker.images.searchPlaceholder")}
					/>
					<Button
						variant="outline"
						size="sm"
						onClick={() => void query.refetch()}
						disabled={query.isFetching}
					>
						<RefreshCw className="size-4" aria-hidden="true" />
						{t("common.refresh")}
					</Button>
				</Toolbar>
			}
		>
			<QueryState
				query={query}
				skeleton={<TableSkeleton rows={5} columns={4} />}
				errorTitle={t("adminInfra.docker.images.errorTitle")}
				isEmpty={(result) => result.items.length === 0}
				empty={
					<EmptyBlock
						title={t("adminInfra.docker.images.empty.title")}
						description={t("adminInfra.docker.images.empty.description")}
					/>
				}
			>
				{(result) => (
					<div className="space-y-3">
						{visible.length === 0 ? (
							<EmptyBlock
								variant="filtered"
								title={t("adminInfra.docker.images.filtered.title")}
								description={t("adminInfra.docker.images.filtered.description")}
							/>
						) : (
							<DataTable
								data={visible}
								getRowId={(row) => row.id}
								columns={columns}
								rowActions={(row) => (
									<Button
										variant="ghost"
										size="icon-sm"
										className="text-destructive"
										aria-label={t("adminInfra.docker.images.actions.delete")}
										title={t("adminInfra.docker.images.actions.delete")}
										disabled={deleteMutation.isPending}
										onClick={() => void deleteImage(row)}
									>
										<Trash2 />
									</Button>
								)}
								mobileCard={(row) => (
									<div className="space-y-2">
										<p className="text-sm break-words">
											{row.repo_tags.length > 0 ? (
												<MonoText>{row.repo_tags.join(", ")}</MonoText>
											) : (
												<TonePill tone="muted">{NONE_TAG}</TonePill>
											)}
										</p>
										<p className="flex flex-wrap items-baseline gap-1 text-xs text-muted-foreground">
											<MonoText>{row.id.slice(0, 24)}</MonoText>
											<span>·</span>
											<span className="tnum">{formatBytes(row.size)}</span>
										</p>
										<Button
											variant="ghost"
											size="sm"
											className="text-destructive"
											onClick={() => void deleteImage(row)}
										>
											<Trash2 className="size-4" aria-hidden="true" />
											{t("adminInfra.docker.images.actions.deleteShort")}
										</Button>
									</div>
								)}
							/>
						)}
						<PaginationBar
							page={list.page}
							pageSize={list.pageSize}
							total={result.meta.total ?? rows.length}
							onPageChange={list.setPage}
							onPageSizeChange={list.setPageSize}
							pageSizeOptions={PAGE_SIZE_OPTIONS}
						/>
					</div>
				)}
			</QueryState>
		</SectionCard>
	);
}

// ── 网络 ────────────────────────────────────────────────────────────────────

function NetworksTab(): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const list = useListState(20);
	const [creating, setCreating] = useState(false);
	const empty = t("common.empty");
	const params = offsetParams(list.page, list.pageSize);

	const query = useQuery({
		queryKey: [...qk.admin.dockerNetworks(), params],
		queryFn: () => callList<NetworkInfo>(client.admin.docker.fetchNetworks(params)),
		placeholderData: keepPreviousData,
	});

	const deleteMutation = useMutation({
		mutationFn: (row: NetworkInfo) =>
			callVoid(
				client.admin.docker.deleteNetwork(row.id),
				t("adminInfra.docker.networks.actions.delete"),
			),
		onSuccess: () => {
			toast.success(t("adminInfra.docker.networks.toast.deleted"));
			void queryClient.invalidateQueries({ queryKey: qk.admin.dockerNetworks() });
		},
		onError: (error) =>
			toast.apiError(t("adminInfra.docker.networks.toast.deleteFailed"), error),
	});

	async function deleteNetwork(row: NetworkInfo) {
		const ok = await confirm({
			title: t("adminInfra.docker.networks.confirm.title", { name: row.name }),
			description: t("adminInfra.docker.networks.confirm.description", {
				driver: row.driver,
				scope: row.scope,
				subnet: row.subnet ?? empty,
			}),
			consequences: [
				t("adminInfra.docker.networks.confirm.consequenceConnectivity"),
				t("adminInfra.docker.networks.confirm.consequenceEndpoints"),
				t("adminInfra.docker.networks.confirm.consequenceIrreversible"),
			],
			tone: "danger",
			confirmText: t("adminInfra.docker.networks.confirm.confirm"),
			confirmPhrase: DELETE_PHRASE,
		});
		if (!ok) return;
		deleteMutation.mutate(row);
	}

	const rows = query.data?.items ?? [];
	const visible = filterCurrentPage(rows, list.filter, (row) => [
		row.id,
		row.name,
		row.driver,
		row.scope,
		row.subnet ?? "",
		row.gateway ?? "",
	]);

	const columns: DataTableColumn<NetworkInfo>[] = [
		{
			id: "id",
			header: t("adminInfra.docker.columns.networkId"),
			hideBelow: "xl",
			cell: (row) => (
				<CopyText value={row.id} label={t("adminInfra.docker.columns.networkId")} />
			),
		},
		{
			id: "name",
			header: t("adminInfra.docker.columns.name"),
			sortValue: (row) => row.name,
			cell: (row) => <span className="font-mono font-medium">{row.name}</span>,
		},
		{
			id: "driver",
			header: t("adminInfra.docker.columns.driver"),
			sortValue: (row) => row.driver,
			cell: (row) => <TonePill tone="neutral">{row.driver}</TonePill>,
		},
		{
			id: "scope",
			header: t("adminInfra.docker.columns.scope"),
			hideBelow: "sm",
			sortValue: (row) => row.scope,
			cell: (row) => <span>{row.scope}</span>,
		},
		{
			id: "subnet",
			header: t("adminInfra.docker.columns.subnet"),
			hideBelow: "md",
			cell: (row) => <MonoText className="text-muted-foreground">{row.subnet ?? empty}</MonoText>,
		},
		{
			id: "gateway",
			header: t("adminInfra.docker.columns.gateway"),
			hideBelow: "lg",
			cell: (row) => <MonoText className="text-muted-foreground">{row.gateway ?? empty}</MonoText>,
		},
	];

	return (
		<>
			<SectionCard
				title={t("adminInfra.docker.networks.section.title")}
				description={t("adminInfra.docker.networks.section.description")}
				actions={
					<Toolbar>
						<RefreshingBadge active={query.isFetching && !query.isPending} />
						<SearchInput
							value={list.search}
							onChange={list.setSearch}
							placeholder={t("adminInfra.docker.networks.searchPlaceholder")}
						/>
						<Button
							variant="outline"
							size="sm"
							onClick={() => void query.refetch()}
							disabled={query.isFetching}
						>
							<RefreshCw className="size-4" aria-hidden="true" />
							{t("common.refresh")}
						</Button>
						<Button size="sm" onClick={() => setCreating(true)}>
							<Plus className="size-4" aria-hidden="true" />
							{t("adminInfra.docker.networks.create")}
						</Button>
					</Toolbar>
				}
			>
				<QueryState
					query={query}
					skeleton={<TableSkeleton rows={5} columns={5} />}
					errorTitle={t("adminInfra.docker.networks.errorTitle")}
					isEmpty={(result) => result.items.length === 0}
					empty={
						<EmptyBlock
							title={t("adminInfra.docker.networks.empty.title")}
							description={t("adminInfra.docker.networks.empty.description")}
						/>
					}
				>
					{(result) => (
						<div className="space-y-3">
							{visible.length === 0 ? (
								<EmptyBlock
									variant="filtered"
									title={t("adminInfra.docker.networks.filtered.title")}
									description={t("adminInfra.docker.networks.filtered.description")}
								/>
							) : (
								<DataTable
									data={visible}
									getRowId={(row) => row.id}
									columns={columns}
									rowActions={(row) => (
										<Button
											variant="ghost"
											size="icon-sm"
											className="text-destructive"
											aria-label={t("adminInfra.docker.networks.actions.delete")}
											title={t("adminInfra.docker.networks.actions.delete")}
											disabled={deleteMutation.isPending}
											onClick={() => void deleteNetwork(row)}
										>
											<Trash2 />
										</Button>
									)}
									mobileCard={(row) => (
										<div className="space-y-2">
											<div className="flex items-start justify-between gap-2">
												<span className="min-w-0 font-mono font-medium break-words">{row.name}</span>
												<TonePill tone="neutral">{row.driver}</TonePill>
											</div>
											<p className="flex flex-wrap items-baseline gap-1 text-xs text-muted-foreground">
												<MonoText>{row.subnet ?? empty}</MonoText>
												<span>·</span>
												<MonoText>{row.gateway ?? empty}</MonoText>
											</p>
											<Button
												variant="ghost"
												size="sm"
												className="text-destructive"
												onClick={() => void deleteNetwork(row)}
											>
												<Trash2 className="size-4" aria-hidden="true" />
												{t("adminInfra.docker.networks.actions.deleteShort")}
											</Button>
										</div>
									)}
								/>
							)}
							<PaginationBar
								page={list.page}
								pageSize={list.pageSize}
								total={result.meta.total ?? rows.length}
								onPageChange={list.setPage}
								onPageSizeChange={list.setPageSize}
								pageSizeOptions={PAGE_SIZE_OPTIONS}
							/>
						</div>
					)}
				</QueryState>
			</SectionCard>

			<CreateNetworkSheet open={creating} onOpenChange={setCreating} />
		</>
	);
}

function CreateNetworkSheet({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const [form, setForm] = useState({
		name: "",
		subnet: "",
		gateway: "",
		driver: "bridge",
	});
	const [errors, setErrors] = useState<{ name?: string; subnet?: string; gateway?: string }>({});

	const createMutation = useMutation({
		mutationFn: (input: { name: string; subnet: string; gateway: string; driver?: string }) =>
			call(
				client.admin.docker.createNetwork(input),
				t("adminInfra.docker.networks.form.title"),
			),
		onSuccess: () => {
			toast.success(
				t("adminInfra.docker.networks.toast.created"),
				t("adminInfra.docker.networks.toast.createdDescription"),
			);
			void queryClient.invalidateQueries({ queryKey: qk.admin.dockerNetworks() });
			setForm({ name: "", subnet: "", gateway: "", driver: "bridge" });
			onOpenChange(false);
		},
		onError: (error) =>
			toast.apiError(t("adminInfra.docker.networks.toast.createFailed"), error),
	});

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const next: { name?: string; subnet?: string; gateway?: string } = {};
		if (form.name.trim().length === 0) {
			next.name = t("adminInfra.docker.networks.form.errors.name");
		}
		if (form.subnet.trim().length === 0) {
			next.subnet = t("adminInfra.docker.networks.form.errors.subnet");
		}
		if (form.gateway.trim().length === 0) {
			next.gateway = t("adminInfra.docker.networks.form.errors.gateway");
		}
		setErrors(next);
		if (Object.keys(next).length > 0) return;
		createMutation.mutate({
			name: form.name.trim(),
			subnet: form.subnet.trim(),
			gateway: form.gateway.trim(),
			driver: form.driver.trim() || undefined,
		});
	}

	return (
		<FormSheet
			open={open}
			onOpenChange={onOpenChange}
			title={t("adminInfra.docker.networks.form.title")}
			description={t("adminInfra.docker.networks.form.description")}
			width="lg"
			footer={
				<FormFooter
					formId="docker-network-form"
					isPending={createMutation.isPending}
					submitLabel={t("adminInfra.docker.networks.form.submit")}
					onCancel={() => onOpenChange(false)}
					hint={t("adminInfra.docker.networks.form.hint")}
				/>
			}
		>
			<form id="docker-network-form" className="space-y-4" onSubmit={submit}>
				<Field
					label={t("adminInfra.docker.networks.form.fields.name")}
					htmlFor="network-name"
					required
					error={errors.name}
				>
					<Input
						id="network-name"
						value={form.name}
						onChange={(event) => setForm({ ...form, name: event.target.value })}
						placeholder={t("adminInfra.docker.networks.form.placeholders.name")}
					/>
				</Field>
				<FormGrid columns={2}>
					<Field
						label={t("adminInfra.docker.networks.form.fields.subnet")}
						htmlFor="network-subnet"
						required
						error={errors.subnet}
					>
						<Input
							id="network-subnet"
							className="font-mono text-xs"
							value={form.subnet}
							onChange={(event) => setForm({ ...form, subnet: event.target.value })}
							placeholder={t("adminInfra.docker.networks.form.placeholders.subnet")}
						/>
					</Field>
					<Field
						label={t("adminInfra.docker.networks.form.fields.gateway")}
						htmlFor="network-gateway"
						required
						error={errors.gateway}
					>
						<Input
							id="network-gateway"
							className="font-mono text-xs"
							value={form.gateway}
							onChange={(event) => setForm({ ...form, gateway: event.target.value })}
							placeholder={t("adminInfra.docker.networks.form.placeholders.gateway")}
						/>
					</Field>
				</FormGrid>
				<Field
					label={t("adminInfra.docker.networks.form.fields.driver")}
					htmlFor="network-driver"
					hint={t("adminInfra.docker.networks.form.driverHint")}
				>
					<Input
						id="network-driver"
						className="font-mono text-xs"
						value={form.driver}
						onChange={(event) => setForm({ ...form, driver: event.target.value })}
					/>
				</Field>
				<div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
					<Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
					<span>{t("adminInfra.docker.networks.form.note")}</span>
				</div>
			</form>
		</FormSheet>
	);
}
