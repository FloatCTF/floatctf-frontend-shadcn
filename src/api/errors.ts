/**
 * 错误展示 —— 平台级要求：错误必须**可见、可读、可恢复**，绝不白屏、绝不静默失败。
 * 文案来源优先级：后端 `UniResponse.message`（`platformMessage`）> HTTP 状态语义 > 通用兜底。
 * 不发明业务文案，不猜测后端原因。
 */

import { FloatCTFError } from "@floatctf/sdk";

import i18n from "~/lib/i18n";

export function isFloatCTFError(error: unknown): error is FloatCTFError {
	return error instanceof FloatCTFError;
}

export function isUnauthorized(error: unknown): boolean {
	return isFloatCTFError(error) && (error.unauthorized || error.httpStatus === 401);
}

export function isForbidden(error: unknown): boolean {
	return isFloatCTFError(error) && error.httpStatus === 403;
}

export function isNotFound(error: unknown): boolean {
	if (!isFloatCTFError(error)) return false;
	if (error.httpStatus === 404) return true;
	// 路由里的 UUID 格式非法时后端返回 400「路径参数格式错误」；对用户来说
	// 这等价于“这个资源不存在”，不应展示技术错误 + 重试。
	return (
		error.httpStatus === 400 &&
		/路径参数|path parameter/i.test(error.platformMessage ?? "")
	);
}

export function isNetworkError(error: unknown): boolean {
	return isFloatCTFError(error) && error.kind === "network";
}

/** 面向用户的错误文案。永远返回一句可以直接显示的话（本地化原因 + 稳定错误码）。 */
export function errorText(error: unknown, fallback?: string): string {
	const t = i18n.t.bind(i18n);
	const generic = fallback ?? t("errors.fallback");
	if (isFloatCTFError(error)) {
		if (error.platformMessage && error.platformMessage.trim().length > 0) {
			return error.platformMessage;
		}
		if (error.kind === "network") {
			return t("errors.networkDetail");
		}
		switch (error.httpStatus) {
			case 400:
				return t("errors.badRequest");
			case 401:
				return t("errors.unauthorized");
			case 403:
				return t("errors.forbiddenAction");
			case 404:
				return t("errors.notFoundDetail");
			case 409:
				return t("errors.conflict");
			case 429:
				return t("errors.tooManyRequests");
			case 500:
			case 502:
			case 503:
			case 504:
				return t("errors.serverError", { status: error.httpStatus });
			default:
				return error.displayMessage || generic;
		}
	}
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === "string" && error.length > 0) return error;
	return generic;
}

/** 诊断用细节（错误页「详情」折叠区）：不含 token，只含状态码与平台码。 */
export function errorDetail(error: unknown): string | null {
	if (!isFloatCTFError(error)) {
		if (error instanceof Error) return `${error.name}: ${error.message}`;
		return null;
	}
	const parts: string[] = [`kind=${error.kind}`];
	if (error.httpStatus !== undefined) parts.push(`http=${error.httpStatus}`);
	if (error.code !== undefined) parts.push(`code=${error.code}`);
	if (error.platformMessage) parts.push(`message=${error.platformMessage}`);
	if (error.message && error.message !== error.platformMessage) parts.push(`raw=${error.message}`);
	return parts.join(" · ");
}
