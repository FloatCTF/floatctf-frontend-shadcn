/**
 * 我的资料 —— 查看 / 修改个人资料 + 头像上传。
 *
 * 真实语义（已在后端源码核对）：
 * - `GET /users/me` 返回 `UsersDto`，后端已把 `password` 置空；本页**绝不**渲染任何密码字段。
 * - `PATCH /users/me` 的请求体只有 `nickname` / `email` / `password` 三个可写字段，
 *   且后端返回 `UniResult<()>`（**没有**数据）。SDK 把返回类型声明成 `UniResponse<Users>`，
 *   因此这里用 `callVoid` 而不是 `call<Users>`（见报告 PUBLIC SDK GAP），
 *   保存成功后用本地已提交的值更新 store，并失效 `qk.auth.me()` 让平台数据回填。
 * - 头像：`uploads.upload_avatar` 是 **PATCH** `/uploads/avatar`（字段名 `image_file`），
 *   因此走公共 helper `uploadFile({ method: "patch", … })`，进度来自 axios 的
 *   `onUploadProgress`（不自己拼 multipart，也不另开逃生舱）。
 */

import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, RotateCcw, Save, Upload } from "lucide-react";

import type { MeDto } from "@floatctf/sdk";

import { call, callVoid, uploadFile } from "~/api/call";
import { useAppQueryClient, useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { useAuthStore, useMe } from "~/auth/store";
import { Field } from "~/components/app/form";
import {
	CopyText,
	KeyValueList,
	MonoText,
	PageBody,
	PageHeader,
	SectionCard,
	Toolbar,
} from "~/components/app/page";
import { InlineError, LoadingBlock, QueryState } from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { UserAvatar } from "~/components/app/user-cell";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Progress } from "~/components/ui/progress";
import { formatDateTime } from "~/lib/format";
import { useDocumentTitle } from "~/lib/hooks";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ProfilePage(): ReactNode {
	const { t } = useTranslation();
	useDocumentTitle(t("profile.documentTitle"));
	const client = useClient();
	const queryClient = useAppQueryClient();
	const cachedMe = useMe();

	const [nickname, setNickname] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [formError, setFormError] = useState<string | null>(null);
	const [syncedId, setSyncedId] = useState<string | null>(null);
	const [avatarFile, setAvatarFile] = useState<File | null>(null);
	const [previewUrl, setPreviewUrl] = useState("");
	const [progress, setProgress] = useState(0);

	const query = useQuery({
		queryKey: qk.auth.me(),
		queryFn: () => call<MeDto>(client.service.users.getMe(), t("profile.load.what")),
	});

	const me = query.data;

	// 只在「第一次拿到该账号的数据」时回填表单，避免刷新时覆盖用户未保存的输入。
	useEffect(() => {
		if (!me || syncedId === me.id) return;
		setNickname(me.nickname ?? "");
		setEmail(me.email ?? "");
		setSyncedId(me.id);
	}, [me, syncedId]);

	// 释放预览用的 object URL（每次切换 / 卸载都会回收上一个）。
	useEffect(
		() => () => {
			if (previewUrl) URL.revokeObjectURL(previewUrl);
		},
		[previewUrl],
	);

	const save = useMutation({
		mutationFn: (input: {
			id: string;
			nickname: string;
			email: string;
			password?: string;
		}) =>
			callVoid(
				client.service.users.patchMe({
					id: input.id,
					nickname: input.nickname,
					email: input.email,
					...(input.password ? { password: input.password } : {}),
				}),
				t("profile.save.what"),
			),
		onSuccess: (_data, input) => {
			toast.success(t("profile.save.success"));
			setPassword("");
			setConfirmPassword("");
			setFormError(null);
			// 后端 PATCH 不返回资料：用刚刚提交的值立即更新会话，再靠失效拉取权威数据。
			const current = useAuthStore.getState().me;
			if (current) {
				useAuthStore.getState().setMe({
					...current,
					nickname: input.nickname,
					email: input.email,
				});
			}
			void queryClient.invalidateQueries({ queryKey: qk.auth.me() });
		},
		onError: (error) => toast.apiError(t("profile.save.failed"), error),
	});

	const upload = useMutation({
		mutationFn: (file: File) =>
			uploadFile<string>({
				client,
				scope: "user",
				method: "patch",
				url: "/uploads/avatar",
				field: "image_file",
				file,
				onProgress: (percent) => setProgress(percent),
			}),
		onSuccess: (avatarUrl) => {
			toast.success(t("profile.avatar.updated"));
			const current = useAuthStore.getState().me;
			if (current) useAuthStore.getState().setMe({ ...current, avatar: avatarUrl });
			void queryClient.invalidateQueries({ queryKey: qk.auth.me() });
			setAvatarFile(null);
			setPreviewUrl("");
		},
		onError: (error) => toast.apiError(t("profile.avatar.uploadFailed"), error),
	});

	function resetForm(): void {
		setNickname(me?.nickname ?? "");
		setEmail(me?.email ?? "");
		setPassword("");
		setConfirmPassword("");
		setFormError(null);
	}

	function handleSubmit(): void {
		if (!me) return;
		const nextNickname = nickname.trim();
		const nextEmail = email.trim();
		if (nextNickname === "") {
			setFormError(t("profile.errors.nicknameRequired"));
			return;
		}
		if (nextEmail !== "" && !EMAIL_PATTERN.test(nextEmail)) {
			setFormError(t("profile.errors.emailInvalid"));
			return;
		}
		if (password !== "") {
			if (password.length < 8) {
				setFormError(t("profile.errors.passwordTooShort"));
				return;
			}
			if (password !== confirmPassword) {
				setFormError(t("profile.errors.passwordMismatch"));
				return;
			}
		}
		setFormError(null);
		save.mutate({
			id: me.id,
			nickname: nextNickname,
			email: nextEmail,
			...(password !== "" ? { password } : {}),
		});
	}

	const avatarSrc = previewUrl !== "" ? previewUrl : (me?.avatar ?? cachedMe?.avatar ?? null);
	const displayName = me?.nickname || me?.username || t("profile.me");

	return (
		<PageBody>
			<PageHeader title={t("profile.title")} description={t("profile.description")} />

			<QueryState
				query={query}
				skeleton={<LoadingBlock label={t("profile.load.loading")} />}
				errorTitle={t("profile.load.failed")}
			>
				{(data) => (
					<div className="space-y-5">
						<div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
							<SectionCard title={t("profile.basic.title")} description={t("profile.basic.description")}>
								<div className="space-y-4">
									<Field
										label={t("profile.fields.username")}
										htmlFor="profile-username"
										hint={t("profile.fields.usernameHint")}
									>
										<Input id="profile-username" value={data.username} disabled readOnly />
									</Field>
									<Field
										label={t("profile.fields.nickname")}
										htmlFor="profile-nickname"
										required
										hint={t("profile.fields.nicknameHint")}
										error={formError && nickname.trim() === "" ? formError : undefined}
									>
										<Input
											id="profile-nickname"
											value={nickname}
											maxLength={64}
											disabled={save.isPending}
											onChange={(event) => setNickname(event.target.value)}
										/>
									</Field>
									<Field
										label={t("profile.fields.email")}
										htmlFor="profile-email"
										hint={t("profile.fields.emailHint")}
									>
										<Input
											id="profile-email"
											type="email"
											autoComplete="email"
											value={email}
											disabled={save.isPending}
											onChange={(event) => setEmail(event.target.value)}
										/>
									</Field>
									<div className="grid gap-4 sm:grid-cols-2">
										<Field
											label={t("profile.fields.newPassword")}
											htmlFor="profile-password"
											hint={t("profile.fields.newPasswordHint")}
										>
											<Input
												id="profile-password"
												type="password"
												autoComplete="new-password"
												value={password}
												disabled={save.isPending}
												onChange={(event) => setPassword(event.target.value)}
											/>
										</Field>
										<Field
											label={t("profile.fields.confirmNewPassword")}
											htmlFor="profile-password-confirm"
											hint={t("profile.fields.confirmNewPasswordHint")}
										>
											<Input
												id="profile-password-confirm"
												type="password"
												autoComplete="new-password"
												value={confirmPassword}
												disabled={save.isPending || password === ""}
												onChange={(event) => setConfirmPassword(event.target.value)}
											/>
										</Field>
									</div>
									{formError ? <InlineError error={formError} /> : null}
									<Toolbar>
										<Button
											disabled={save.isPending}
											onClick={handleSubmit}
										>
											{save.isPending ? (
												<Loader2 className="animate-spin" />
											) : (
												<Save />
											)}
											{t("profile.save.submit")}
										</Button>
										<Button
											variant="outline"
											disabled={save.isPending}
											onClick={resetForm}
										>
											<RotateCcw /> {t("common.reset")}
										</Button>
									</Toolbar>
								</div>
							</SectionCard>

							<SectionCard title={t("profile.avatar.title")} description={t("profile.avatar.description")}>
								<div className="space-y-4">
									<div className="flex items-center gap-4">
										<UserAvatar
											name={displayName}
											avatar={avatarSrc}
											size="lg"
											className="size-24"
										/>
										<div className="min-w-0 space-y-1">
											<p className="truncate text-sm font-medium">{displayName}</p>
											<MonoText className="block">{data.username}</MonoText>
											<p className="text-xs text-muted-foreground">
												{data.avatar ? t("profile.avatar.current") : t("profile.avatar.none")}
											</p>
										</div>
									</div>

									<label className="inline-flex cursor-pointer">
										<input
											id="profile-avatar"
											type="file"
											accept="image/png,image/jpeg,image/webp,image/gif"
											className="hidden"
											disabled={upload.isPending}
											onChange={(event) => {
												const selected = event.target.files?.[0];
												event.target.value = "";
												if (!selected) return;
												setAvatarFile(selected);
												setPreviewUrl(URL.createObjectURL(selected));
											}}
										/>
										<Button variant="outline" asChild disabled={upload.isPending}>
											<span>
												<Upload /> {t("profile.avatar.choose")}
											</span>
										</Button>
									</label>

									{avatarFile ? (
										<div className="space-y-2">
											<p className="truncate text-xs text-muted-foreground">
												{t("profile.avatar.pending", { name: avatarFile.name })}
											</p>
											{upload.isPending ? (
												<div className="space-y-1">
													<Progress value={progress} aria-label={t("profile.avatar.progressLabel")} />
													<p className="tnum text-xs text-muted-foreground">
														{t("profile.avatar.uploading", { percent: progress })}
													</p>
												</div>
											) : null}
											<Toolbar>
												<Button
													disabled={upload.isPending}
													onClick={() => upload.mutate(avatarFile)}
												>
													{upload.isPending ? (
														<Loader2 className="animate-spin" />
													) : (
														<Upload />
													)}
													{t("profile.avatar.upload")}
												</Button>
												<Button
													variant="outline"
													disabled={upload.isPending}
													onClick={() => {
														setAvatarFile(null);
														setPreviewUrl("");
														setProgress(0);
													}}
												>
														{t("common.cancel")}
												</Button>
											</Toolbar>
										</div>
									) : (
										<p className="text-xs text-muted-foreground">{t("profile.avatar.hint")}</p>
									)}
								</div>
							</SectionCard>
						</div>

						<SectionCard title={t("profile.meta.title")} description={t("profile.meta.description")}>
							<KeyValueList
								columns={2}
								items={[
									{ key: t("profile.meta.username"), value: <MonoText>{data.username}</MonoText> },
									{
										key: t("profile.meta.nickname"),
										value: data.nickname ? data.nickname : "—",
									},
									{ key: t("profile.meta.email"), value: data.email ? data.email : "—" },
									{
										key: t("profile.meta.createdAt"),
										value: formatDateTime(data.created_at, { seconds: true }),
									},
									{
										key: t("profile.meta.updatedAt"),
										value: formatDateTime(data.updated_at, { seconds: true }),
									},
									{
										key: t("profile.meta.userId"),
										value: <CopyText value={data.id} label={t("profile.meta.userId")} />,
									},
								]}
							/>
						</SectionCard>
					</div>
				)}
			</QueryState>
		</PageBody>
	);
}
