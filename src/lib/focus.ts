/**
 * 弹层关闭后的焦点还原。
 *
 * Radix 会尝试把焦点还给触发元素，但：
 * - 触发按钮常随列表刷新被替换 → 还原失败落到 body；
 * - 有的页面用 `{open ? <Sheet/> : null}` 条件挂载，关闭即卸载，状态型还原拿不到 false。
 *
 * 这里用全局 focusin / pointerdown 记录「最后一个在弹层之外获得焦点的控件」，
 * 在弹层卸载后还原；若仍有其它弹层打开（如 Sheet 上叠确认框），交给 Radix 处理。
 */
let lastOutsideFocus: HTMLElement | null = null;

if (typeof document !== "undefined") {
	document.addEventListener(
		"focusin",
		(event) => {
			const target = event.target;
			if (
				target instanceof HTMLElement &&
				!target.closest(
					'[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [role="tooltip"]',
				)
			) {
				lastOutsideFocus = target;
			}
		},
		true,
	);
	document.addEventListener(
		"pointerdown",
		(event) => {
			const target = event.target;
			const control =
				target instanceof Element
					? target.closest(
							'button, a, [role="button"], input, select, textarea, tr, [tabindex]:not([tabindex="-1"])',
						)
					: null;
			if (
				control instanceof HTMLElement &&
				!control.closest('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]')
			) {
				lastOutsideFocus = control;
			}
		},
		true,
	);
}

/**
 * 弹层卸载后调用：把焦点还给打开它的控件。
 * 退场动画期间 `[role="dialog"]` 仍在 DOM（`data-state="closed"`），需要等它真正移除。
 */
export function restoreFocusAfterLayer(): void {
	const target = lastOutsideFocus;
	const hasOpenLayer = () =>
		[
			...document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]'),
		].some((layer) => layer.isConnected && layer.dataset.state !== "closed");

	const attempt = (allowRetry: boolean) => {
		if (hasOpenLayer()) {
			if (allowRetry) window.setTimeout(() => attempt(false), 280);
			return;
		}
		if (target && document.contains(target)) {
			target.focus();
			return;
		}
		// 触发元素已被列表刷新替换：退回到主内容起点，至少不要落在 body。
		document.getElementById("main-content")?.focus();
	};
	window.setTimeout(() => attempt(true), 0);
}
