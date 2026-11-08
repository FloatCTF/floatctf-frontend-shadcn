/**
 * 管理端 · 角色与权限治理（`/admin/platform/roles`）。
 *
 * 真实接口：`client.admin.roles.fetch/create/patch/remove`（`roles.read` / `roles.manage`）。
 * Wave 10 起平台是统一身份 + RBAC：不存在独立的「超管账号表」，
 * 「谁能管理」由角色（`RoleDto`）与权限（`PermissionDto`）表达。
 *
 * 后端事实（`packages/sdk/src/api/admin/roles.ts` + `apps/api/src/modules/identity/roles/mod.rs`）：
 * - 删除内置角色（`protected`）返回 **409**，文案由错误链路如实展示；
 * - `patch` 的 `permissions` 是**整体替换**语义；
 * - 反提权规则在后端逐请求判定（不能授予自己没有的权限），前端只展示 403 文案。
 * - `grants_all` 角色的权限来自短路，`permissions` 为空 ≠ 没有权限。
 * - 账号 ↔ 角色的授予在「用户管理」页（`users.getRoles` / `users.setRoles`）。
 */

import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";

import type { PermissionDto, RoleDto } from "@floatctf/sdk";

import { call, callList, callVoid } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { TonePill } from "~/components/app/badges";
import { useConfirm } from "~/components/app/confirm";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
import { FormSheet } from "~/components/app/form";
import {
	MonoText,
	PageBody,
	PageHeader,
	SectionCard,
	Toolbar,
} from "~/components/app/page";
import {
	EmptyBlock,
	InlineError,
	QueryState,
	RefreshingBadge,
	TableSkeleton,
} from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { useDocumentTitle } from "~/lib/hooks";
import { cn } from "~/lib/utils";

import { SearchInput } from "./components";

interface RoleFormState {
	id?: string;
	key: string;
	name: string;
	description: string;
	permissions: Set<string>;
	/** 内置角色：后端只允许改 name / description，传 permissions 会 409。 */
	protected?: boolean;
}

export function AdminRolesPage(): ReactNode {
	const { t } = useTranslation();
	useDocumentTitle(t("adminPlatform.roles.documentTitle"));
	const client = useClient();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const [form, setForm] = useState<RoleFormState | null>(null);
	const [search, setSearch] = useState("");

	const roles = useQuery({
		queryKey: qk.admin.roles(),
		queryFn: async () => (await callList<RoleDto>(client.admin.roles.fetch())).items,
	});

	const permissions = useQuery({
		queryKey: qk.admin.rolePermissions(),
		queryFn: async () => (await callList<PermissionDto>(client.admin.roles.listPermissions())).items,
	});

	function invalidate() {
		void queryClient.invalidateQueries({ queryKey: qk.admin.roles() });
	}

	const create = useMutation({
		mutationFn: (input: RoleFormState) =>
			call(
				client.admin.roles.create({
					key: input.key.trim(),
					name: input.name.trim(),
					description: input.description.trim() || undefined,
					permissions: [...input.permissions],
				}),
				t("adminPlatform.roles.requests.create"),
			),
		onSuccess: () => {
			toast.success(t("adminPlatform.roles.toasts.created"));
			setForm(null);
			invalidate();
		},
		onError: (error) => toast.apiError(t("adminPlatform.roles.toasts.createFailed"), error),
	});

	const patch = useMutation({
		mutationFn: (input: RoleFormState) =>
			call(
				client.admin.roles.patch(input.id!, {
					name: input.name.trim(),
					description: input.description.trim() || undefined,
					// 内置角色的权限集是引导不变式：只提交名称 / 描述，避免必然 409。
					permissions: input.protected ? undefined : [...input.permissions],
				}),
				t("adminPlatform.roles.requests.update"),
			),
		onSuccess: () => {
			toast.success(t("adminPlatform.roles.toasts.updated"));
			setForm(null);
			invalidate();
		},
		onError: (error) => toast.apiError(t("adminPlatform.roles.toasts.updateFailed"), error),
	});

	const remove = useMutation({
		mutationFn: (roleId: string) =>
			callVoid(client.admin.roles.remove(roleId), t("adminPlatform.roles.requests.delete")),
		onSuccess: () => {
			toast.success(t("adminPlatform.roles.toasts.deleted"));
			invalidate();
		},
		onError: (error) => toast.apiError(t("adminPlatform.roles.toasts.deleteFailed"), error),
	});

	async function confirmRemove(role: RoleDto) {
		const ok = await confirm({
			title: t("adminPlatform.roles.confirm.title"),
			description: t("adminPlatform.roles.confirm.description", {
				name: role.name,
				count: role.user_count,
			}),
			consequences: [
				t("adminPlatform.roles.confirm.consequence1"),
				t("adminPlatform.roles.confirm.consequence2"),
			],
			tone: "danger",
			confirmText: t("adminPlatform.roles.confirm.confirmText"),
			confirmPhrase: role.key,
		});
		if (ok) remove.mutate(role.id);
	}

	// 权限目录按域分组（域列表顺序以后端为准，这里只做稳定分组展示）。
	const grouped = useMemo(() => {
		const map = new Map<string, PermissionDto[]>();
		for (const p of permissions.data ?? []) {
			const list = map.get(p.domain) ?? [];
			list.push(p);
			map.set(p.domain, list);
		}
		return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
	}, [permissions.data]);

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return roles.data ?? [];
		return (roles.data ?? []).filter((r) =>
			[r.name, r.key, r.description].some((v) => v.toLowerCase().includes(q)),
		);
	}, [roles.data, search]);

	function renderFlags(row: RoleDto): ReactNode {
		return (
			<div className="flex flex-wrap items-center gap-1">
				{row.protected ? (
					<TonePill tone="muted">{t("adminPlatform.roles.flags.builtin")}</TonePill>
				) : (
					<TonePill tone="neutral">{t("adminPlatform.roles.flags.custom")}</TonePill>
				)}
				{row.grants_all ? (
					<TonePill tone="warning">{t("adminPlatform.roles.flags.grantsAll")}</TonePill>
				) : null}
			</div>
		);
	}

	function renderPermissions(row: RoleDto): ReactNode {
		return (
			<span className="tnum text-xs text-muted-foreground">
				{row.grants_all
					? t("adminPlatform.roles.permissionsAll")
					: t("adminPlatform.common.countItems", { count: row.permissions.length })}
			</span>
		);
	}

	function renderRowMenu(row: RoleDto): ReactNode {
		const actionsLabel = t("adminPlatform.common.rowActions", { name: row.name });
		return (
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label={actionsLabel}
						title={actionsLabel}
					>
						<MoreHorizontal aria-hidden="true" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem
						onSelect={() =>
							setForm({
								id: row.id,
								key: row.key,
								name: row.name,
								description: row.description,
								permissions: new Set(row.grants_all ? [] : row.permissions),
								protected: row.protected,
							})
						}
					>
						<Pencil aria-hidden="true" /> {t("adminPlatform.roles.menu.edit")}
					</DropdownMenuItem>
					<DropdownMenuItem
						variant="destructive"
						disabled={row.protected}
						title={
							row.protected ? t("adminPlatform.roles.menu.protectedDeleteHint") : undefined
						}
						onSelect={() => void confirmRemove(row)}
					>
						<Trash2 aria-hidden="true" /> {t("adminPlatform.roles.menu.delete")}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		);
	}

	const columns: DataTableColumn<RoleDto>[] = [
		{
			id: "name",
			header: t("adminPlatform.roles.columns.role"),
			cell: (row) => (
				<div className="flex min-w-0 flex-col">
					<span className="truncate text-sm font-medium">{row.name}</span>
					<MonoText className="text-xs text-muted-foreground">{row.key}</MonoText>
				</div>
			),
			sortValue: (row) => row.name,
		},
		{
			id: "flags",
			header: t("adminPlatform.roles.columns.flags"),
			cell: (row) => renderFlags(row),
			hideBelow: "sm",
		},
		{
			id: "permissions",
			header: t("adminPlatform.roles.columns.permissions"),
			cell: (row) => renderPermissions(row),
			sortValue: (row) => (row.grants_all ? Number.MAX_SAFE_INTEGER : row.permissions.length),
			hideBelow: "md",
		},
		{
			id: "user_count",
			header: t("adminPlatform.roles.columns.holders"),
			cell: (row) => <span className="tnum text-sm">{row.user_count}</span>,
			sortValue: (row) => row.user_count,
			hideBelow: "lg",
		},
		{
			id: "actions",
			header: "",
			align: "right",
			cell: (row) => renderRowMenu(row),
		},
	];

	const editingRole = form?.id ? (roles.data ?? []).find((r) => r.id === form.id) : undefined;

	return (
		<PageBody>
			<PageHeader
				title={t("adminPlatform.roles.title")}
				description={t("adminPlatform.roles.description")}
				actions={
					<Toolbar>
						<Button
							variant="outline"
							onClick={() => {
								void roles.refetch();
								void permissions.refetch();
							}}
							disabled={roles.isFetching || permissions.isFetching}
						>
							<RefreshCw
								className={roles.isFetching ? "animate-spin" : undefined}
								aria-hidden="true"
							/>
							{t("adminPlatform.common.refresh")}
						</Button>
						<Button
							onClick={() =>
								setForm({ key: "", name: "", description: "", permissions: new Set() })
							}
						>
							<Plus aria-hidden="true" /> {t("adminPlatform.roles.create")}
						</Button>
					</Toolbar>
				}
			/>

			<SectionCard
				title={t("adminPlatform.roles.section.title")}
				description={t("adminPlatform.roles.section.description")}
				actions={
					<Toolbar>
						<RefreshingBadge active={roles.isFetching && !roles.isPending} />
						<SearchInput
							value={search}
							onChange={setSearch}
							placeholder={t("adminPlatform.roles.search.placeholder")}
						/>
					</Toolbar>
				}
			>
				<QueryState
					query={roles}
					skeleton={<TableSkeleton rows={5} columns={4} />}
					errorTitle={t("adminPlatform.roles.errorTitle")}
					isEmpty={(rows) => rows.length === 0}
					empty={
						<EmptyBlock
							title={t("adminPlatform.roles.empty.title")}
							description={t("adminPlatform.roles.empty.description")}
						/>
					}
				>
					{() =>
						filtered.length === 0 ? (
							<EmptyBlock
								variant="filtered"
								title={t("adminPlatform.roles.filteredEmpty.title")}
								description={t("adminPlatform.roles.filteredEmpty.description")}
							/>
						) : (
							<DataTable
								columns={columns}
								data={filtered}
								getRowId={(row) => row.id}
								mobileCard={(row) => (
									<div className="space-y-2">
										<div className="flex items-start justify-between gap-2">
											<div className="flex min-w-0 flex-col">
												<span className="truncate text-sm font-medium">{row.name}</span>
												<MonoText className="text-xs text-muted-foreground">
													{row.key}
												</MonoText>
											</div>
											{renderRowMenu(row)}
										</div>
										{renderFlags(row)}
										<div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
											<span className="inline-flex items-center gap-1">
												{t("adminPlatform.roles.columns.permissions")}
												{renderPermissions(row)}
											</span>
											<span className="inline-flex items-center gap-1">
												{t("adminPlatform.roles.columns.holders")}
												<span className="tnum">{row.user_count}</span>
											</span>
										</div>
									</div>
								)}
							/>
						)
					}
				</QueryState>
			</SectionCard>

			{form ? (
				<RoleFormSheet
					form={form}
					isProtected={Boolean(editingRole?.protected)}
					grouped={grouped}
					permLoading={permissions.isLoading}
					permError={permissions.isError ? permissions.error : null}
					submitting={create.isPending || patch.isPending}
					onChange={setForm}
					onClose={() => setForm(null)}
					onSubmit={() => (form.id ? patch.mutate(form) : create.mutate(form))}
				/>
			) : null}
		</PageBody>
	);
}

function RoleFormSheet({
	form,
	isProtected,
	grouped,
	permLoading,
	permError,
	submitting,
	onChange,
	onClose,
	onSubmit,
}: {
	form: RoleFormState;
	isProtected: boolean;
	grouped: [string, PermissionDto[]][];
	permLoading: boolean;
	permError: Error | null;
	submitting: boolean;
	onChange: (next: RoleFormState) => void;
	onClose: () => void;
	onSubmit: () => void;
}): ReactNode {
	const { t } = useTranslation();
	const isEdit = Boolean(form.id);
	const selectedCount = form.permissions.size;

	return (
		<FormSheet
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
			title={
				isEdit
					? t("adminPlatform.roles.form.editTitle", { name: form.name })
					: t("adminPlatform.roles.form.createTitle")
			}
			description={
				isProtected
					? t("adminPlatform.roles.form.protectedDescription")
					: t("adminPlatform.roles.form.replaceDescription")
			}
			footer={
				<div className="flex w-full flex-wrap items-center justify-end gap-2">
					<Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
						{t("adminPlatform.roles.form.cancel")}
					</Button>
					<Button
						type="button"
						onClick={onSubmit}
						disabled={submitting || !form.key.trim() || !form.name.trim()}
					>
						{isEdit
							? t("adminPlatform.roles.form.save")
							: t("adminPlatform.roles.form.create")}
					</Button>
				</div>
			}
		>
			<div className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="role-key">{t("adminPlatform.roles.form.keyLabel")}</Label>
					<Input
						id="role-key"
						className="font-mono text-xs"
						autoComplete="off"
						value={form.key}
						disabled={isEdit}
						placeholder={t("adminPlatform.roles.form.keyPlaceholder")}
						onChange={(e) => onChange({ ...form, key: e.target.value })}
					/>
					<p className="text-xs text-muted-foreground">
						{t("adminPlatform.roles.form.keyHint")}
					</p>
				</div>
				<div className="space-y-2">
					<Label htmlFor="role-name">{t("adminPlatform.roles.form.nameLabel")}</Label>
					<Input
						id="role-name"
						value={form.name}
						onChange={(e) => onChange({ ...form, name: e.target.value })}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="role-desc">
						{t("adminPlatform.roles.form.descriptionLabel")}
					</Label>
					<Input
						id="role-desc"
						value={form.description}
						onChange={(e) => onChange({ ...form, description: e.target.value })}
					/>
				</div>

				<div className="space-y-2">
					<div className="flex items-center justify-between gap-2">
						<Label>
							{t("adminPlatform.roles.form.permissionsLabel")}
							{isProtected ? t("adminPlatform.roles.form.permissionsLocked") : ""}
						</Label>
						<span className="tnum text-xs text-muted-foreground">
							{t("adminPlatform.roles.form.selectedCount", { count: selectedCount })}
						</span>
					</div>
					{permError ? (
						<InlineError
							error={
								new Error(
									t("adminPlatform.roles.form.loadFailed", {
										message: permError.message,
									}),
								)
							}
						/>
					) : permLoading ? (
						<p className="text-sm text-muted-foreground">
							{t("adminPlatform.roles.form.loading")}
						</p>
					) : (
						<div className="max-h-72 space-y-3 overflow-y-auto rounded-lg border p-3">
							{grouped.map(([domain, perms]) => (
								<section key={domain} className="space-y-1.5">
									<h3 className="text-xs font-semibold text-muted-foreground">
										{domain}
									</h3>
									{perms.map((p) => (
										<PermissionRow
											key={p.key}
											permission={p}
											checked={form.permissions.has(p.key)}
											disabled={isProtected || submitting}
											onToggle={(next) => {
												const nextSet = new Set(form.permissions);
												if (next) nextSet.add(p.key);
												else nextSet.delete(p.key);
												onChange({ ...form, permissions: nextSet });
											}}
										/>
									))}
								</section>
							))}
						</div>
					)}
				</div>
			</div>
		</FormSheet>
	);
}

function PermissionRow({
	permission,
	checked,
	disabled,
	onToggle,
}: {
	permission: PermissionDto;
	checked: boolean;
	disabled: boolean;
	onToggle: (next: boolean) => void;
}): ReactNode {
	const { t } = useTranslation();
	return (
		<label
			className={cn(
				"flex cursor-pointer items-start justify-between gap-3 rounded-md px-2 py-1.5",
				disabled ? "cursor-not-allowed opacity-60" : "hover:bg-muted/50",
			)}
		>
			<span className="flex min-w-0 flex-col">
				<span className="flex items-center gap-1.5 text-sm">
					<MonoText className="text-xs">{permission.key}</MonoText>
					{permission.high_risk ? (
						<TonePill tone="danger">{t("adminPlatform.roles.form.highRisk")}</TonePill>
					) : null}
				</span>
				<span className="truncate text-xs text-muted-foreground">
					{permission.description}
				</span>
			</span>
			<Switch
				checked={checked}
				disabled={disabled}
				onCheckedChange={onToggle}
				aria-label={permission.key}
			/>
		</label>
	);
}
