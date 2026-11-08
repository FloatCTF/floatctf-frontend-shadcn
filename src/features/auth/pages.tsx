/**
 * 认证页面 —— 选手登录 / 注册 / 忘记密码 / 凭 token 重置 + 管理端登录。
 * 两个 token 作用域互相独立：管理端登录不会影响选手会话，反之亦然。
 * 所有文案走 i18n（`auth.*`），布局走 public-shell 的认证分屏。
 */

import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { KeyRound, Loader2, LogIn, ShieldCheck, UserPlus } from "lucide-react";

import { call } from "~/api/call";
import { useAppQueryClient, useClient } from "~/api/client";
import { errorText } from "~/api/errors";
import { qk } from "~/api/keys";
import { useAuthStore } from "~/auth/store";
import { AuthCard } from "~/app/public-shell";
import { Field } from "~/components/app/form";
import { InlineError } from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useDocumentTitle } from "~/lib/hooks";
import { safeNextPath } from "~/lib/safe-next";

function nextTarget(raw: string | null, fallback: string): string {
	return safeNextPath(raw, fallback);
}

export function LoginPage() {
	const { t } = useTranslation();
	useDocumentTitle(t("auth.login.documentTitle"));
	const client = useClient();
	const navigate = useNavigate();
	const queryClient = useAppQueryClient();
	const setUserToken = useAuthStore((state) => state.setUserToken);
	const [params] = useSearchParams();
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [attempted, setAttempted] = useState(false);
	const usernameRef = useRef<HTMLInputElement>(null);
	const passwordRef = useRef<HTMLInputElement>(null);
	const usernameMissing = username.trim() === "";
	const passwordMissing = password === "";
	const next = nextTarget(params.get("next"), "/");

	const mutation = useMutation({
		mutationFn: (input: { username: string; password: string }) =>
			call<string>(client.service.users.login(input), t("auth.login.submit")),
		onSuccess: (token) => {
			if (!token) {
				toast.error(t("auth.login.failed"), t("auth.login.noToken"));
				return;
			}
			setUserToken(token);
			void queryClient.invalidateQueries({ queryKey: qk.auth.me() });
			toast.success(t("auth.login.success"));
			void navigate(next, { replace: true });
		},
		onError: (error) => toast.apiError(t("auth.login.failed"), error),
	});

	return (
		<AuthCard
			title={t("auth.login.title")}
			description={t("auth.login.description")}
			footer={
				<div className="space-y-1.5 text-muted-foreground">
					<p>
						{t("auth.login.noAccount")}{" "}
						<Link to="/register" className="text-foreground underline underline-offset-4">
							{t("auth.register.title")}
						</Link>
					</p>
					<p>
						{t("auth.login.forgot")}{" "}
						<Link to="/forgot" className="text-foreground underline underline-offset-4">
							{t("auth.forgot.title")}
						</Link>
					</p>
				</div>
			}
		>
			<form
				className="space-y-5"
				noValidate
				onSubmit={(event) => {
					event.preventDefault();
					setAttempted(true);
					if (usernameMissing || passwordMissing) {
						// 就近报错 + 把焦点送到第一个出错的字段（不依赖 toast 才能发现）。
						(usernameMissing ? usernameRef : passwordRef).current?.focus();
						return;
					}
					mutation.mutate({ username: username.trim(), password });
				}}
			>
				<Field
					label={t("auth.fields.username")}
					htmlFor="login-username"
					required
					error={attempted && usernameMissing ? t("auth.fields.required") : undefined}
				>
					<Input
						ref={usernameRef}
						id="login-username"
						name="username"
						autoComplete="username"
						aria-invalid={attempted && usernameMissing}
						value={username}
						onChange={(event) => setUsername(event.target.value)}
						placeholder={t("auth.login.usernamePlaceholder")}
					/>
				</Field>
				<Field
					label={t("auth.fields.password")}
					htmlFor="login-password"
					required
					error={attempted && passwordMissing ? t("auth.fields.required") : undefined}
				>
					<Input
						ref={passwordRef}
						id="login-password"
						name="password"
						type="password"
						autoComplete="current-password"
						aria-invalid={attempted && passwordMissing}
						value={password}
						onChange={(event) => setPassword(event.target.value)}
					/>
				</Field>
				{mutation.isError ? <InlineError error={mutation.error} /> : null}
				<Button type="submit" size="lg" className="w-full" disabled={mutation.isPending}>
					{mutation.isPending ? <Loader2 className="animate-spin" /> : <LogIn />}
					{t("auth.login.submit")}
				</Button>
			</form>
		</AuthCard>
	);
}

export function RegisterPage() {
	const { t } = useTranslation();
	useDocumentTitle(t("auth.register.documentTitle"));
	const client = useClient();
	const navigate = useNavigate();
	const [form, setForm] = useState({
		username: "",
		nickname: "",
		email: "",
		password: "",
		confirm: "",
	});
	const [attempted, setAttempted] = useState(false);
	const firstInvalidRef = useRef<HTMLInputElement>(null);
	const missingUsername = form.username.trim() === "";
	const missingNickname = form.nickname.trim() === "";
	const missingPassword = form.password === "";
	const passwordMismatch = form.confirm !== form.password;

	const mutation = useMutation({
		mutationFn: (input: {
			username: string;
			password: string;
			nickname: string;
			email: string;
		}) => call<string>(client.service.users.register(input), t("auth.register.submit")),
		onSuccess: () => {
			toast.success(t("auth.register.success"), t("auth.register.successHint"));
			void navigate("/login", { replace: true });
		},
		onError: (error) => toast.apiError(t("auth.register.failed"), error),
	});

	return (
		<AuthCard
			title={t("auth.register.title")}
			description={t("auth.register.description")}
			footer={
				<p className="text-muted-foreground">
					{t("auth.register.haveAccount")}{" "}
					<Link to="/login" className="text-foreground underline underline-offset-4">
						{t("auth.login.submit")}
					</Link>
				</p>
			}
		>
			<form
				className="space-y-5"
				noValidate
				onSubmit={(event) => {
					event.preventDefault();
					setAttempted(true);
					if (missingUsername || missingPassword || missingNickname) {
						firstInvalidRef.current?.focus();
						return;
					}
					if (passwordMismatch) {
						return;
					}
					mutation.mutate({
						username: form.username.trim(),
						nickname: form.nickname.trim(),
						email: form.email.trim(),
						password: form.password,
					});
				}}
			>
				<Field
					label={t("auth.fields.username")}
					htmlFor="register-username"
					required
					hint={t("auth.register.usernameHint")}
					error={attempted && missingUsername ? t("auth.fields.required") : undefined}
				>
					<Input
						ref={firstInvalidRef}
						id="register-username"
						autoComplete="username"
						aria-invalid={attempted && missingUsername}
						value={form.username}
						onChange={(event) => setForm({ ...form, username: event.target.value })}
					/>
				</Field>
				<Field
					label={t("auth.fields.nickname")}
					htmlFor="register-nickname"
					required
					error={attempted && missingNickname ? t("auth.fields.required") : undefined}
				>
					<Input
						id="register-nickname"
						aria-invalid={attempted && missingNickname}
						value={form.nickname}
						onChange={(event) => setForm({ ...form, nickname: event.target.value })}
					/>
				</Field>
				<Field label={t("auth.fields.email")} htmlFor="register-email" hint={t("auth.register.emailHint")}>
					<Input
						id="register-email"
						type="email"
						autoComplete="email"
						value={form.email}
						onChange={(event) => setForm({ ...form, email: event.target.value })}
					/>
				</Field>
				<Field
					label={t("auth.fields.password")}
					htmlFor="register-password"
					required
					error={attempted && missingPassword ? t("auth.fields.required") : undefined}
				>
					<Input
						id="register-password"
						type="password"
						autoComplete="new-password"
						aria-invalid={attempted && missingPassword}
						value={form.password}
						onChange={(event) => setForm({ ...form, password: event.target.value })}
					/>
				</Field>
				<Field
					label={t("auth.fields.confirmPassword")}
					htmlFor="register-confirm"
					required
					error={attempted && passwordMismatch ? t("auth.passwordMismatch") : undefined}
				>
					<Input
						id="register-confirm"
						type="password"
						autoComplete="new-password"
						aria-invalid={attempted && passwordMismatch}
						value={form.confirm}
						onChange={(event) => setForm({ ...form, confirm: event.target.value })}
					/>
				</Field>
				{mutation.isError ? <InlineError error={mutation.error} /> : null}
				<Button type="submit" size="lg" className="w-full" disabled={mutation.isPending}>
					{mutation.isPending ? <Loader2 className="animate-spin" /> : <UserPlus />}
					{t("auth.register.submit")}
				</Button>
			</form>
		</AuthCard>
	);
}

export function ForgotPasswordPage() {
	const { t } = useTranslation();
	useDocumentTitle(t("auth.forgot.documentTitle"));
	const client = useClient();
	const [username, setUsername] = useState("");
	const [email, setEmail] = useState("");
	const [sent, setSent] = useState(false);

	const mutation = useMutation({
		mutationFn: (input: { username?: string; email?: string }) =>
			call<string>(client.service.users.resetPassword(input), t("auth.forgot.submit")),
		onSuccess: () => {
			setSent(true);
			toast.success(t("auth.forgot.success"), t("auth.forgot.successHint"));
		},
		onError: (error) => toast.apiError(t("auth.forgot.failed"), error),
	});

	return (
		<AuthCard
			title={t("auth.forgot.title")}
			description={t("auth.forgot.description")}
			footer={
				<Link to="/login" className="text-muted-foreground underline underline-offset-4">
					{t("auth.backToLogin")}
				</Link>
			}
		>
			<form
				className="space-y-5"
				onSubmit={(event) => {
					event.preventDefault();
					if (username.trim() === "" && email.trim() === "") {
						toast.warning(t("auth.forgot.missingFields"));
						return;
					}
					mutation.mutate({
						...(username.trim() ? { username: username.trim() } : {}),
						...(email.trim() ? { email: email.trim() } : {}),
					});
				}}
			>
				<Field label={t("auth.fields.username")} htmlFor="forgot-username">
					<Input
						id="forgot-username"
						autoComplete="username"
						value={username}
						onChange={(event) => setUsername(event.target.value)}
					/>
				</Field>
				<Field label={t("auth.fields.email")} htmlFor="forgot-email">
					<Input
						id="forgot-email"
						type="email"
						autoComplete="email"
						value={email}
						onChange={(event) => setEmail(event.target.value)}
					/>
				</Field>
				{mutation.isError ? <InlineError error={mutation.error} /> : null}
				<Button type="submit" size="lg" className="w-full" disabled={mutation.isPending}>
					{mutation.isPending ? <Loader2 className="animate-spin" /> : <KeyRound />}
					{t("auth.forgot.submit")}
				</Button>
				{sent ? (
					<p className="text-xs text-muted-foreground">
						{t("auth.forgot.hintBefore")}{" "}
						<span className="font-mono">/reset?token=…</span> {t("auth.forgot.hintAfter")}
					</p>
				) : null}
			</form>
		</AuthCard>
	);
}

export function ResetPasswordPage() {
	const { t } = useTranslation();
	useDocumentTitle(t("auth.reset.documentTitle"));
	const client = useClient();
	const navigate = useNavigate();
	const [params] = useSearchParams();
	const [token, setToken] = useState(params.get("token") ?? "");
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");

	const mutation = useMutation({
		mutationFn: (input: { token: string; password: string; confirmed_password: string }) =>
			call<string>(client.service.users.reset(input), t("auth.reset.submit")),
		onSuccess: () => {
			toast.success(t("auth.reset.success"), t("auth.reset.successHint"));
			void navigate("/login", { replace: true });
		},
		onError: (error) => toast.apiError(t("auth.reset.failed"), error),
	});

	return (
		<AuthCard
			title={t("auth.reset.title")}
			description={t("auth.reset.description")}
			footer={
				<Link to="/login" className="text-muted-foreground underline underline-offset-4">
					{t("auth.backToLogin")}
				</Link>
			}
		>
			<form
				className="space-y-5"
				onSubmit={(event) => {
					event.preventDefault();
					if (token.trim() === "") {
						toast.warning(t("auth.reset.missingToken"));
						return;
					}
					if (password === "" || password !== confirm) {
						toast.warning(t("auth.passwordMismatch"));
						return;
					}
					mutation.mutate({
						token: token.trim(),
						password,
						confirmed_password: confirm,
					});
				}}
			>
				<Field label={t("auth.fields.resetToken")} htmlFor="reset-token" required>
					<Input
						id="reset-token"
						className="font-mono text-xs"
						value={token}
						onChange={(event) => setToken(event.target.value)}
					/>
				</Field>
				<Field label={t("auth.fields.newPassword")} htmlFor="reset-password" required>
					<Input
						id="reset-password"
						type="password"
						autoComplete="new-password"
						value={password}
						onChange={(event) => setPassword(event.target.value)}
					/>
				</Field>
				<Field label={t("auth.fields.confirmNewPassword")} htmlFor="reset-confirm" required>
					<Input
						id="reset-confirm"
						type="password"
						autoComplete="new-password"
						value={confirm}
						onChange={(event) => setConfirm(event.target.value)}
					/>
				</Field>
				{mutation.isError ? <InlineError error={mutation.error} /> : null}
				<Button type="submit" size="lg" className="w-full" disabled={mutation.isPending}>
					{mutation.isPending ? <Loader2 className="animate-spin" /> : <KeyRound />}
					{t("auth.reset.submit")}
				</Button>
			</form>
		</AuthCard>
	);
}

export function AdminLoginPage() {
	const { t } = useTranslation();
	useDocumentTitle(t("auth.adminLogin.documentTitle"));
	const client = useClient();
	const navigate = useNavigate();
	const queryClient = useAppQueryClient();
	const setAdminToken = useAuthStore((state) => state.setAdminToken);
	const [params] = useSearchParams();
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [attempted, setAttempted] = useState(false);
	const usernameRef = useRef<HTMLInputElement>(null);
	const passwordRef = useRef<HTMLInputElement>(null);
	const usernameMissing = username.trim() === "";
	const passwordMissing = password === "";
	const next = nextTarget(params.get("next"), "/admin");

	const mutation = useMutation({
		mutationFn: (input: { username: string; password: string }) =>
			call<string>(client.admin.login(input), t("auth.adminLogin.submit")),
		onSuccess: (token) => {
			if (!token) {
				toast.error(t("auth.login.failed"), t("auth.login.noToken"));
				return;
			}
			setAdminToken(token);
			void queryClient.invalidateQueries({ queryKey: qk.admin.dashboard() });
			toast.success(t("auth.adminLogin.success"));
			void navigate(next, { replace: true });
		},
		onError: (error) => toast.apiError(t("auth.login.failed"), error),
	});

	return (
		<AuthCard
			title={t("auth.adminLogin.title")}
			description={t("auth.adminLogin.description")}
			footer={
				<Link to="/login" className="text-muted-foreground underline underline-offset-4">
					{t("auth.adminLogin.goPlayer")}
				</Link>
			}
		>
			<form
				className="space-y-5"
				noValidate
				onSubmit={(event) => {
					event.preventDefault();
					setAttempted(true);
					if (usernameMissing || passwordMissing) {
						(usernameMissing ? usernameRef : passwordRef).current?.focus();
						return;
					}
					mutation.mutate({ username: username.trim(), password });
				}}
			>
				<Field
					label={t("auth.adminLogin.usernameLabel")}
					htmlFor="admin-username"
					required
					error={attempted && usernameMissing ? t("auth.fields.required") : undefined}
				>
					<Input
						ref={usernameRef}
						id="admin-username"
						autoComplete="username"
						aria-invalid={attempted && usernameMissing}
						value={username}
						onChange={(event) => setUsername(event.target.value)}
					/>
				</Field>
				<Field
					label={t("auth.fields.password")}
					htmlFor="admin-password"
					required
					error={attempted && passwordMissing ? t("auth.fields.required") : undefined}
				>
					<Input
						ref={passwordRef}
						id="admin-password"
						type="password"
						autoComplete="current-password"
						aria-invalid={attempted && passwordMissing}
						value={password}
						onChange={(event) => setPassword(event.target.value)}
					/>
				</Field>
				{mutation.isError ? <InlineError error={mutation.error} /> : null}
				<Button type="submit" size="lg" className="w-full" disabled={mutation.isPending}>
					{mutation.isPending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
					{t("auth.adminLogin.submit")}
				</Button>
			</form>
		</AuthCard>
	);
}

export { errorText };
