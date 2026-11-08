import type { FeatureModule } from "~/features/types";

import { TrainingCatalogPage, TrainingRunPage } from "./pages";

/**
 * AWDP Training Ground：
 * - `/training` 练习目录 + 开始训练；
 * - `/training/runs/:runId` 练习 run 工作台（生命周期 / 实例 / Break·Fix / 轮次评测 / 积分 / Writeup）。
 */
export const feature: FeatureModule = {
	shell: "player",
	routes: [
		{ path: "/gameboxes", element: <TrainingCatalogPage /> },
		// 兼容旧入口；新导航使用 Default 的 Gameboxes 位置。
		{ path: "/training", element: <TrainingCatalogPage /> },
		{ path: "/training/runs/:runId", element: <TrainingRunPage /> },
	],
};
