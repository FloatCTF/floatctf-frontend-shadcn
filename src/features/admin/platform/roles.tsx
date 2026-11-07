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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";

import type { PermissionDto, RoleDto } from "@floatctf/sdk";

import { call, callList, callVoid } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
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
import { EmptyBlock, QueryState, RefreshingBadge, TableSkeleton } from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { Badge } from "~/components/ui/badge";
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
import { cn } from "~/lib/utils";

interface RoleFormState {
	id?: string;
	key: string;
	name: string;
	description: string;
	permissions: Set<string>;
}

export function AdminRolesPage(): ReactNode {
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
				"创建角色",
			),
		onSuccess: () => {
			toast.success("角色已创建");
			setForm(null);
			invalidate();
		},
		onError: (error) => toast.apiError("创建失败", error),
	});

	const patch = useMutation({
		mutationFn: (input: RoleFormState) =>
			call(
				client.admin.roles.patch(input.id!, {
					name: input.name.trim(),
					description: input.description.trim() || undefined,
					permissions: [...input.permissions],
				}),
				"更新角色",
			),
		onSuccess: () => {
			toast.success("角色已更新");
			setForm(null);
			invalidate();
		},
		onError: (error) => toast.apiError("更新失败", error),
	});

	const remove = useMutation({
		mutationFn: (roleId: string) => callVoid(client.admin.roles.remove(roleId), "删除角色"),
		onSuccess: () => {
			toast.success("角色已删除");
			invalidate();
		},
		onError: (error) => toast.apiError("删除失败", error),
	});

	async function confirmRemove(role: RoleDto) {
		const ok = await confirm({
			title: "删除角色",
			description: `将删除角色「${role.name}」，当前有 ${role.user_count} 个账号持有它。`,
			consequences: [
				"持有该角色的账号立即失去对应权限（后端每请求重新判定）。",
				"删除不可恢复；账号本身不会被删除。",
			],
			tone: "danger",
			confirmText: "删除",
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

	const columns: DataTableColumn<RoleDto>[] = [
		{
			id: "name",
			header: "角色",
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
			header: "属性",
			cell: (row) => (
				<div className="flex flex-wrap gap-1">
					{row.protected ? (
						<Badge variant="outline">内置</Badge>
					) : (
						<Badge variant="secondary">自定义</Badge>
					)}
					{row.grants_all ? <Badge variant="default">全权</Badge> : null}
				</div>
			),
			hideBelow: "sm",
		},
		{
			id: "permissions",
			header: "权限",
			cell: (row) => (
				<span className="text-xs text-muted-foreground">
					{row.grants_all ? "全部权限（短路）" : `${row.permissions.length} 项`}
				</span>
			),
			sortValue: (row) => (row.grants_all ? Number.MAX_SAFE_INTEGER : row.permissions.length),
			hideBelow: "md",
		},
		{
			id: "user_count",
			header: "持有账号",
			cell: (row) => <span className="tnum text-sm">{row.user_count}</span>,
			sortValue: (row) => row.user_count,
			hideBelow: "lg",
		},
		{
			id: "actions",
			header: "",
			align: "right",
			cell: (row) => (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon-sm" aria-label={`操作：${row.name}`}>
							<MoreHorizontal />
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
								})
							}
						>
							<Pencil /> 编辑
						</DropdownMenuItem>
						<DropdownMenuItem
							variant="destructive"
							disabled={row.protected}
							title={row.protected ? "内置角色不可删除（后端返回 409）" : undefined}
							onSelect={() => void confirmRemove(row)}
						>
							<Trash2 /> 删除
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			),
		},
	];

	const editingRole = form?.id ? (roles.data ?? []).find((r) => r.id === form.id) : undefined;

	return (
		<PageBody>
			<PageHeader
				title="角色与权限"
				description="平台 RBAC：角色是权限的集合，账号通过持有角色获得管理能力。"
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
							<RefreshCw className={roles.isFetching ? "animate-spin" : undefined} />
							刷新
						</Button>
						<Button onClick={() => setForm({ key: "", name: "", description: "", permissions: new Set() })}>
							<Plus /> 新建角色
						</Button>
					</Toolbar>
				}
			/>

			<SectionCard
				title="角色列表"
				description="内置角色不可删除、权限集不可修改；删除自定义角色前展示持有账号数。"
				actions={
					<Toolbar>
						<RefreshingBadge active={roles.isFetching} />
						<Input
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="搜索角色名 / key"
							aria-label="搜索角色"
							className="max-w-xs"
						/>
					</Toolbar>
				}
			>
				<QueryState
					query={roles}
					skeleton={<TableSkeleton rows={5} columns={4} />}
					empty={
						<EmptyBlock
							title="暂无角色"
							description="平台启动时会补种内置角色；若为空请检查后端初始化。"
						/>
					}
				>
					{() => (
						<DataTable
							columns={columns}
							data={filtered}
							getRowId={(row) => row.id}
						/>
					)}
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
	const isEdit = Boolean(form.id);
	const selectedCount = form.permissions.size;

	return (
		<FormSheet
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
			title={isEdit ? `编辑角色：${form.name}` : "新建角色"}
			description={
				isProtected
					? "内置角色的权限集由平台定义，此处只能修改名称与描述。"
					: "权限为整体替换语义：保存后角色的权限集就是下方勾选的集合。"
			}
			footer={
				<div className="flex w-full flex-wrap items-center justify-end gap-2">
					<Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
						取消
					</Button>
					<Button
						type="button"
						onClick={onSubmit}
						disabled={submitting || !form.key.trim() || !form.name.trim()}
					>
						{isEdit ? "保存更改" : "创建角色"}
					</Button>
				</div>
			}
		>
			<div className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="role-key">角色 key</Label>
					<Input
						id="role-key"
						value={form.key}
						disabled={isEdit}
						placeholder="如 ops-lead"
						onChange={(e) => onChange({ ...form, key: e.target.value })}
					/>
					<p className="text-xs text-muted-foreground">稳定标识，创建后不可修改。</p>
				</div>
				<div className="space-y-2">
					<Label htmlFor="role-name">名称</Label>
					<Input
						id="role-name"
						value={form.name}
						onChange={(e) => onChange({ ...form, name: e.target.value })}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="role-desc">描述</Label>
					<Input
						id="role-desc"
						value={form.description}
						onChange={(e) => onChange({ ...form, description: e.target.value })}
					/>
				</div>

				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<Label>权限集{isProtected ? "（不可修改）" : ""}</Label>
						<span className="tnum text-xs text-muted-foreground">已选 {selectedCount} 项</span>
					</div>
					{permError ? (
						<p className="text-sm text-destructive">权限目录加载失败：{permError.message}</p>
					) : permLoading ? (
						<p className="text-sm text-muted-foreground">正在加载权限目录…</p>
					) : (
						<div className="max-h-72 space-y-3 overflow-y-auto rounded-lg border p-3">
							{grouped.map(([domain, perms]) => (
								<section key={domain} className="space-y-1.5">
									<h3 className="text-xs font-semibold text-muted-foreground">{domain}</h3>
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
					{permission.high_risk ? <Badge variant="destructive">高危</Badge> : null}
				</span>
				<span className="truncate text-xs text-muted-foreground">{permission.description}</span>
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
