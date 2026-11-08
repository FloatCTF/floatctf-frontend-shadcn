/**
 * 用户管理（`/admin/platform/users`）—— 列表 + Sheet 新建/编辑 + 批量删除。
 *
 * 铁律：`UsersDto` **包含 `password`（argon2 哈希）**，本页任何位置都不得渲染它；
 * 编辑表单也从不回填密码（留空 = 不修改）。
 *
 * 所有用户可见文案走 `adminCore.users.*`。
 */

import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { Pencil, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";

import { call, callList } from "~/api/call";
import { useAppQueryClient, useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { TonePill } from "~/components/app/badges";
import { useConfirm } from "~/components/app/confirm";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
import { Field, FormFooter, FormGrid, FormSheet } from "~/components/app/form";
import {
	MonoText,
	PageBody,
	PageHeader,
	PaginationBar,
	SectionCard,
	Toolbar,
} from "~/components/app/page";
import {
	EmptyBlock,
	InlineError,
	LoadingBlock,
	QueryState,
	TableSkeleton,
} from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { UserCell } from "~/components/app/user-cell";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { DropdownMenuItem, DropdownMenuSeparator } from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { formatDateTime } from "~/lib/format";
import { useDocumentTitle } from "~/lib/hooks";
import type { QueryParams, RoleDto, UserRolesDto } from "@floatctf/sdk";
import type { Users } from "@floatctf/sdk/entity";

import { RowMenu, SearchInput, useAdminListState } from "./shared";

const SEARCH_KEYS = ["username", "nickname", "email"];

interface UserFormState {
	username: string;
	nickname: string;
	email: string;
	password: string;
}

type UserFormErrors = Partial<Record<keyof UserFormState, string>>;

const EMPTY_FORM: UserFormState = { username: "", nickname: "", email: "", password: "" };

/** 与后端 `is_valid_email` 同口径：local@domain.tld（不是简单的 includes("@")）。 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(form: UserFormState, mode: "create" | "edit", t: TFunction): UserFormErrors {
	const errors: UserFormErrors = {};
	const username = form.username.trim();
	if (!username) errors.username = t("adminCore.users.validation.usernameRequired");
	else if (username.length > 64) errors.username = t("adminCore.users.validation.usernameTooLong");

	if (!form.nickname.trim()) errors.nickname = t("adminCore.users.validation.nicknameRequired");

	const email = form.email.trim();
	if (email && !EMAIL_PATTERN.test(email)) {
		errors.email = t("adminCore.users.validation.emailInvalid");
	}

	if (mode === "create") {
		if (!form.password) errors.password = t("adminCore.users.validation.passwordRequired");
		else if (form.password.length < 8) {
			errors.password = t("adminCore.users.validation.passwordTooShort");
		}
	} else if (form.password && form.password.length < 8) {
		errors.password = t("adminCore.users.validation.passwordTooShortEdit");
	}
	return errors;
}

export function AdminUsersPage(): ReactNode {
	const { t } = useTranslation();
	useDocumentTitle(t("adminCore.users.documentTitle"));
	const client = useClient();
	const queryClient = useAppQueryClient();
	const confirm = useConfirm();
	const list = useAdminListState(SEARCH_KEYS);

	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	// 筛选条件变化后，已选中但被筛掉的行不能再进入批量删除：
	// 用户看不到它们，却会在确认框里删掉。
	useEffect(() => {
		setSelectedIds([]);
	}, [list.filter]);
	const [editing, setEditing] = useState<{ mode: "create" | "edit"; user?: Users } | null>(null);
	const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
	const [errors, setErrors] = useState<UserFormErrors>({});
	const [rolesTarget, setRolesTarget] = useState<Users | null>(null);

	const params: QueryParams = {
		page: list.page,
		limit: list.pageSize,
		...(list.filter ? { filter: list.filter } : {}),
	};

	const query = useQuery({
		queryKey: qk.admin.users(params),
		queryFn: () => callList<Users>(client.admin.users.fetch(params)),
	});

	function invalidate(): void {
		void queryClient.invalidateQueries({ queryKey: qk.admin.users() });
	}

	const save = useMutation({
		mutationFn: (input: { mode: "create" | "edit"; id?: string; body: UserFormState }) => {
			const payload = {
				username: input.body.username.trim(),
				nickname: input.body.nickname.trim(),
				email: input.body.email.trim(),
				...(input.body.password ? { password: input.body.password } : {}),
			};
			if (input.mode === "create") {
				return call<Users>(
					client.admin.users.create(payload),
					t("adminCore.actions.createUser"),
				);
			}
			// patch(Partial<Users>) 的 URL 用 `.id` 拼接，**必须**带 id。
			return call<Users>(
				client.admin.users.patch({ id: input.id ?? "", ...payload }),
				t("adminCore.actions.updateUser"),
			);
		},
		onSuccess: (_data, input) => {
			toast.success(
				input.mode === "create"
					? t("adminCore.users.toasts.created")
					: t("adminCore.users.toasts.updated"),
			);
			invalidate();
			setEditing(null);
			setForm(EMPTY_FORM);
			setErrors({});
		},
		onError: (error) => toast.apiError(t("adminCore.users.toasts.saveFailed"), error),
	});

	const remove = useMutation({
		mutationFn: (ids: string[]) =>
			call<number>(client.admin.users.remove(ids), t("adminCore.actions.deleteUsers")),
		onSuccess: (count) => {
			toast.success(
				t("adminCore.users.toasts.deleted", { count }),
				t("adminCore.users.toasts.deletedDescription"),
			);
			invalidate();
			setSelectedIds([]);
		},
		onError: (error) => toast.apiError(t("adminCore.users.toasts.deleteFailed"), error),
	});

	function openCreate(): void {
		setForm(EMPTY_FORM);
		setErrors({});
		setEditing({ mode: "create" });
	}

	function openEdit(user: Users): void {
		// 密码永不回填：编辑时留空 = 不修改。
		setForm({ username: user.username, nickname: user.nickname, email: user.email, password: "" });
		setErrors({});
		setEditing({ mode: "edit", user });
	}

	function submit(): void {
		if (!editing) return;
		const nextErrors = validate(form, editing.mode, t);
		setErrors(nextErrors);
		if (Object.keys(nextErrors).length > 0) {
			toast.warning(t("adminCore.form.fixErrors"));
			return;
		}
		save.mutate({ mode: editing.mode, id: editing.user?.id, body: form });
	}

	async function confirmRemoveOne(user: Users): Promise<void> {
		const ok = await confirm({
			title: t("adminCore.users.confirm.deleteOneTitle", {
				name: user.nickname || user.username,
			}),
			description: t("adminCore.users.confirm.deleteDescription"),
			consequences: [
				t("adminCore.users.confirm.deleteConsequence1"),
				t("adminCore.users.confirm.deleteConsequence2"),
			],
			tone: "danger",
			confirmText: t("adminCore.users.confirm.delete"),
			confirmPhrase: user.username,
		});
		if (ok) remove.mutate([user.id]);
	}

	async function confirmRemoveSelected(): Promise<void> {
		if (selectedIds.length === 0) {
			toast.warning(t("adminCore.users.toasts.selectForDelete"));
			return;
		}
		const ok = await confirm({
			title: t("adminCore.users.confirm.deleteSelectedTitle", { count: selectedIds.length }),
			description: t("adminCore.users.confirm.deleteDescription"),
			consequences: [
				t("adminCore.users.confirm.deleteSelectedConsequence1", { count: selectedIds.length }),
				t("adminCore.users.confirm.deleteSelectedConsequence2"),
			],
			tone: "danger",
			confirmText: t("adminCore.users.confirm.delete"),
			confirmPhrase: "delete",
		});
		if (ok) remove.mutate(selectedIds);
	}

	const columns: DataTableColumn<Users>[] = [
		{
			id: "user",
			header: t("adminCore.users.columns.user"),
			cell: (row) => (
				// 只用 username / nickname / avatar —— 绝不渲染 password。
				<UserCell username={row.username} nickname={row.nickname} avatar={row.avatar} />
			),
			sortValue: (row) => row.username,
		},
		{
			id: "email",
			header: t("adminCore.users.columns.email"),
			cell: (row) =>
				row.email ? (
					<span className="text-sm">{row.email}</span>
				) : (
					<span className="text-xs text-muted-foreground">—</span>
				),
			sortValue: (row) => row.email,
			hideBelow: "sm",
		},
		{
			id: "created_at",
			header: t("adminCore.users.columns.createdAt"),
			cell: (row) => (
				<span className="tnum text-xs text-muted-foreground">{formatDateTime(row.created_at)}</span>
			),
			sortValue: (row) => Date.parse(row.created_at),
			hideBelow: "md",
		},
		{
			id: "updated_at",
			header: t("adminCore.users.columns.updatedAt"),
			cell: (row) => (
				<span className="tnum text-xs text-muted-foreground">{formatDateTime(row.updated_at)}</span>
			),
			sortValue: (row) => Date.parse(row.updated_at),
			hideBelow: "lg",
		},
	];

	return (
		<PageBody>
			<PageHeader
				title={t("adminCore.users.title")}
				description={t("adminCore.users.description")}
				actions={
					<Toolbar>
						<Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
							<RefreshCw
								className={query.isFetching ? "animate-spin" : undefined}
								aria-hidden="true"
							/>
							{t("common.refresh")}
						</Button>
						<Button onClick={openCreate}>
							<Plus aria-hidden="true" /> {t("adminCore.users.new")}
						</Button>
					</Toolbar>
				}
			/>

			<SectionCard
				title={t("adminCore.users.listTitle")}
				description={t("adminCore.users.listDescription")}
				actions={
					<Toolbar>
						<SearchInput
							value={list.search}
							onChange={list.setSearch}
							placeholder={t("adminCore.users.searchPlaceholder")}
						/>
						{selectedIds.length > 0 ? (
							<Button
								variant="destructive"
								size="sm"
								onClick={() => void confirmRemoveSelected()}
								disabled={remove.isPending}
							>
								<Trash2 aria-hidden="true" />{" "}
								{t("adminCore.users.deleteSelected", { count: selectedIds.length })}
							</Button>
						) : null}
					</Toolbar>
				}
				contentClassName="p-0"
				footer={
					// 数据到位前不渲染分页条，避免出现「共 0 条」这种与事实不符的文案。
					query.data ? (
						<PaginationBar
							page={list.page}
							pageSize={list.pageSize}
							total={query.data.meta?.total ?? 0}
							onPageChange={list.setPage}
							onPageSizeChange={list.setPageSize}
						/>
					) : null
				}
			>
				<QueryState
					query={query}
					skeleton={<TableSkeleton rows={6} columns={4} />}
					errorTitle={t("adminCore.users.error")}
					isEmpty={(result) => result.items.length === 0}
					empty={
						list.filter ? (
							<EmptyBlock
								variant="filtered"
								title={t("adminCore.users.filtered.title")}
								description={t("adminCore.users.filtered.description", {
									query: list.search,
								})}
							/>
						) : (
							<EmptyBlock
								title={t("adminCore.users.empty.title")}
								description={t("adminCore.users.empty.description")}
								action={
									<Button size="sm" onClick={openCreate}>
										<Plus aria-hidden="true" /> {t("adminCore.users.new")}
									</Button>
								}
							/>
						)
					}
				>
					{(result) => (
						<DataTable
							data={result.items}
							getRowId={(row) => row.id}
							columns={columns}
							selectable
							selectedIds={selectedIds}
							onSelectionChange={setSelectedIds}
							mobileCard={(row) => (
								<div className="space-y-1.5">
									<UserCell username={row.username} nickname={row.nickname} avatar={row.avatar} />
									<p className="text-xs text-muted-foreground">
										{row.email || t("common.empty")}
									</p>
									<p className="tnum text-xs text-muted-foreground">
										{t("adminCore.users.registeredAt", {
											time: formatDateTime(row.created_at),
										})}
									</p>
									<div className="flex flex-wrap gap-2 pt-1">
										<Button variant="outline" size="sm" onClick={() => openEdit(row)}>
											<Pencil aria-hidden="true" /> {t("common.edit")}
										</Button>
										<Button
											variant="outline"
											size="sm"
											onClick={() => setRolesTarget(row)}
										>
											<ShieldCheck aria-hidden="true" /> {t("adminCore.users.roles.menu")}
										</Button>
										<Button
											variant="destructive"
											size="sm"
											onClick={() => void confirmRemoveOne(row)}
										>
											<Trash2 aria-hidden="true" /> {t("common.delete")}
										</Button>
									</div>
								</div>
							)}
							rowActions={(row) => (
								<RowMenu label={t("adminCore.users.rowMenu", { name: row.username })}>
									<DropdownMenuItem onSelect={() => openEdit(row)}>
										<Pencil aria-hidden="true" /> {t("common.edit")}
									</DropdownMenuItem>
									<DropdownMenuItem onSelect={() => setRolesTarget(row)}>
										<ShieldCheck aria-hidden="true" /> {t("adminCore.users.roles.menu")}
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										variant="destructive"
										onSelect={() => void confirmRemoveOne(row)}
									>
										<Trash2 aria-hidden="true" /> {t("common.delete")}
									</DropdownMenuItem>
								</RowMenu>
							)}
						/>
					)}
				</QueryState>
			</SectionCard>

			<FormSheet
				open={editing !== null}
				onOpenChange={(open) => {
					if (!open) setEditing(null);
				}}
				title={
					editing?.mode === "edit"
						? t("adminCore.users.sheet.editTitle")
						: t("adminCore.users.sheet.createTitle")
				}
				description={
					editing?.mode === "edit"
						? t("adminCore.users.sheet.editDescription")
						: t("adminCore.users.sheet.createDescription")
				}
				width="md"
				footer={
					<FormFooter
						onCancel={() => setEditing(null)}
						submitLabel={
							editing?.mode === "edit"
								? t("adminCore.users.sheet.submitSave")
								: t("adminCore.users.sheet.submitCreate")
						}
						isPending={save.isPending}
						formId="admin-user-form"
					/>
				}
			>
				<form
					id="admin-user-form"
					className="space-y-4"
					onSubmit={(event) => {
						event.preventDefault();
						submit();
					}}
				>
					<FormGrid columns={1}>
						<Field
							label={t("adminCore.users.sheet.username")}
							htmlFor="user-username"
							required
							error={errors.username}
							hint={t("adminCore.users.sheet.usernameHint")}
						>
							<Input
								id="user-username"
								autoComplete="off"
								value={form.username}
								onChange={(event) => setForm({ ...form, username: event.target.value })}
							/>
						</Field>
						<Field
							label={t("adminCore.users.sheet.nickname")}
							htmlFor="user-nickname"
							required
							error={errors.nickname}
						>
							<Input
								id="user-nickname"
								autoComplete="off"
								value={form.nickname}
								onChange={(event) => setForm({ ...form, nickname: event.target.value })}
							/>
						</Field>
						<Field
							label={t("adminCore.users.sheet.email")}
							htmlFor="user-email"
							error={errors.email}
							hint={t("adminCore.users.sheet.emailHint")}
						>
							<Input
								id="user-email"
								type="email"
								autoComplete="off"
								value={form.email}
								onChange={(event) => setForm({ ...form, email: event.target.value })}
							/>
						</Field>
						<Field
							label={
								editing?.mode === "edit"
									? t("adminCore.users.sheet.newPassword")
									: t("adminCore.users.sheet.password")
							}
							htmlFor="user-password"
							required={editing?.mode !== "edit"}
							error={errors.password}
							hint={
								editing?.mode === "edit"
									? t("adminCore.users.sheet.passwordEditHint")
									: t("adminCore.users.sheet.passwordHint")
							}
						>
							<Input
								id="user-password"
								type="password"
								autoComplete="new-password"
								value={form.password}
								onChange={(event) => setForm({ ...form, password: event.target.value })}
							/>
						</Field>
					</FormGrid>
				</form>
			</FormSheet>

			<UserRolesSheet
				user={rolesTarget}
				onClose={() => setRolesTarget(null)}
			/>
		</PageBody>
	);
}

/**
 * 账号 ↔ 角色授予。后端 `PUT /admin/users/:id/roles` 是**整体替换**语义；
 * 反提权由后端逐请求判定，前端只如实展示 403。
 */
function UserRolesSheet({
	user,
	onClose,
}: {
	user: Users | null;
	onClose: () => void;
}): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useAppQueryClient();
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const open = user !== null;
	const userId = user?.id ?? "";

	const rolesQuery = useQuery({
		queryKey: qk.admin.roles(),
		queryFn: async () => (await callList<RoleDto>(client.admin.roles.fetch())).items,
		enabled: open,
	});
	const userRolesQuery = useQuery({
		queryKey: qk.admin.userRoles(userId),
		queryFn: () => call<UserRolesDto>(client.admin.users.getRoles(userId), t("adminCore.users.roles.request")),
		enabled: open && userId !== "",
	});

	useEffect(() => {
		if (!userRolesQuery.data) return;
		setSelected(new Set(userRolesQuery.data.roles.map((role) => role.id)));
	}, [userRolesQuery.data]);

	const save = useMutation({
		mutationFn: () =>
			call<UserRolesDto>(
				client.admin.users.setRoles(userId, [...selected]),
				t("adminCore.users.roles.request"),
			),
		onSuccess: () => {
			toast.success(t("adminCore.users.roles.saved"));
			void queryClient.invalidateQueries({ queryKey: qk.admin.userRoles(userId) });
			void queryClient.invalidateQueries({ queryKey: qk.admin.users() });
			void queryClient.invalidateQueries({ queryKey: qk.admin.roles() });
			onClose();
		},
		onError: (error) => toast.apiError(t("adminCore.users.roles.saveFailed"), error),
	});

	const roles = rolesQuery.data ?? [];

	return (
		<FormSheet
			open={open}
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
			title={t("adminCore.users.roles.title")}
			description={
				user
					? t("adminCore.users.roles.description", {
							name: user.nickname || user.username,
						})
					: undefined
			}
			width="lg"
			footer={
				<div className="flex w-full flex-wrap items-center justify-between gap-2">
					<span className="text-xs text-muted-foreground">
						{userRolesQuery.data
							? t("adminCore.users.roles.effective", {
									count: userRolesQuery.data.permissions.length,
								})
							: null}
					</span>
					<div className="flex items-center gap-2">
						<Button variant="outline" onClick={onClose} disabled={save.isPending}>
							{t("common.cancel")}
						</Button>
						<Button
							onClick={() => save.mutate()}
							disabled={save.isPending || rolesQuery.isPending || userRolesQuery.isPending}
						>
							{save.isPending ? t("common.saving") : t("adminCore.users.roles.save")}
						</Button>
					</div>
				</div>
			}
		>
			{rolesQuery.isPending || userRolesQuery.isPending ? (
				<LoadingBlock label={t("adminCore.users.roles.loading")} />
			) : rolesQuery.isError ? (
				<InlineError error={rolesQuery.error} />
			) : userRolesQuery.isError ? (
				<InlineError error={userRolesQuery.error} />
			) : roles.length === 0 ? (
				<EmptyBlock
					title={t("adminCore.users.roles.noRoles")}
					description={t("adminCore.users.roles.description", {
						name: user?.nickname || user?.username || "",
					})}
				/>
			) : (
				<div className="space-y-2">
					{selected.size === 0 ? (
						<p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
							{t("adminCore.users.roles.emptySelection")}
						</p>
					) : null}
					{roles.map((role) => (
						<label
							key={role.id}
							className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-muted/40"
						>
							<Checkbox
								className="mt-0.5"
								checked={selected.has(role.id)}
								onCheckedChange={(value) => {
									setSelected((current) => {
										const next = new Set(current);
										if (value === true) next.add(role.id);
										else next.delete(role.id);
										return next;
									});
								}}
								aria-label={role.name}
							/>
							<span className="min-w-0 flex-1">
								<span className="flex flex-wrap items-center gap-2">
									<span className="text-sm font-medium">{role.name}</span>
									<MonoText className="text-xs text-muted-foreground">{role.key}</MonoText>
									{role.grants_all ? (
										<TonePill tone="info">{t("adminCore.users.roles.grantsAll")}</TonePill>
									) : null}
									{role.protected ? (
										<TonePill tone="muted">{t("adminCore.users.roles.protected")}</TonePill>
									) : null}
								</span>
								<span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
									{role.description ? <span>{role.description}</span> : null}
									<span>{t("adminCore.users.roles.holders", { count: role.user_count })}</span>
								</span>
							</span>
						</label>
					))}
				</div>
			)}
		</FormSheet>
	);
}
