/**
 * AWDP 运维页的数据读取 hooks。key 一律取自 `qk.awdp.admin*` / `qk.awd.library` / `qk.admin.event*`。
 *
 * 说明（已核实）：管理端**没有** AWDP SSE 通道（只有选手端 `/api/events/{id}/awdp/stream`），
 * 所以本页用显式刷新 + 按需轮询的组合，而不是挂管理端实时流。
 *
 * `call*` 的第二个参数是「失败上下文文案」，会进入错误展示（errors fallback），因此同样走 i18n。
 */

import type {
	AwdpAdminEventGameBoxDto,
	AwdpAdminInstanceDto,
	AwdpDataPresent,
	AwdpEventConfigDto,
	AwdpScoreRow,
	GameBoxLibraryDto,
} from "@floatctf/sdk";
import type { Events } from "@floatctf/sdk/entity";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { call, callList } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";

/** 列表单次拉取上限（服务端默认分页会截断，这里显式放大）。 */
export const AWDP_LIST_LIMIT = 100;

/** 赛事本体（标题 / 赛制 / 时间窗）。 */
export function useAwdpEvent(eventId: string) {
	const client = useClient();
	const { t } = useTranslation();
	return useQuery({
		queryKey: qk.admin.event(eventId),
		queryFn: () => call<Events>(client.admin.events.get(eventId), t("adminAwdpOps.calls.event")),
		enabled: eventId !== "",
	});
}

/** AWDP 配置 + 阶段（阶段来自 active / 最近一次 run）。 */
export function useAwdpConfig(eventId: string) {
	const client = useClient();
	const { t } = useTranslation();
	return useQuery({
		queryKey: qk.awdp.adminConfig(eventId),
		queryFn: () =>
			call<AwdpEventConfigDto>(client.awdp.admin.getConfig(eventId), t("adminAwdpOps.calls.config")),
		enabled: eventId !== "",
		// 阶段推进主要由后端 tick 驱动（Break 到期 / 回合 cutoff），30s 轮询保证阶段与
		// 倒计时不会长时间停留在旧值；页面另有显式刷新按钮。
		refetchInterval: 30_000,
		refetchIntervalInBackground: false,
	});
}

/** 赛事已挂载的 AWDP GameBox。 */
export function useAwdpEventGameboxes(eventId: string) {
	const client = useClient();
	const { t } = useTranslation();
	return useQuery({
		queryKey: qk.awdp.adminGameboxes(eventId),
		queryFn: () =>
			call<AwdpAdminEventGameBoxDto[]>(
				client.awdp.admin.listEventGameboxes(eventId, { limit: AWDP_LIST_LIMIT }),
				t("adminAwdpOps.calls.eventGameboxes"),
			),
		enabled: eventId !== "",
	});
}

/** 赛事实例（经 run 聚合的管理端视图）。 */
export function useAwdpInstances(eventId: string) {
	const client = useClient();
	const { t } = useTranslation();
	return useQuery({
		queryKey: qk.awdp.adminInstances(eventId),
		queryFn: () =>
			call<AwdpAdminInstanceDto[]>(
				client.awdp.admin.listInstances(eventId),
				t("adminAwdpOps.calls.instances"),
			),
		enabled: eventId !== "",
	});
}

/** 管理端积分榜。 */
export function useAwdpScores(eventId: string) {
	const client = useClient();
	const { t } = useTranslation();
	return useQuery({
		queryKey: qk.awdp.adminScores(eventId),
		queryFn: () =>
			call<AwdpScoreRow[]>(client.awdp.admin.scores(eventId), t("adminAwdpOps.calls.scores")),
		enabled: eventId !== "",
		refetchInterval: 30_000,
		refetchIntervalInBackground: false,
	});
}

/** 赛事大屏聚合数据。 */
export function useAwdpDataPresent(eventId: string, enabled: boolean) {
	const client = useClient();
	const { t } = useTranslation();
	return useQuery({
		queryKey: qk.awdp.adminData(eventId),
		queryFn: () =>
			call<AwdpDataPresent>(client.awdp.admin.dataPresent(eventId), t("adminAwdpOps.calls.data")),
		enabled: enabled && eventId !== "",
	});
}

/** GameBox 库（选择要挂到赛事的靶机）—— 库是平台级共享资源，key 与 AWD 运维页一致。 */
export function useAwdpGameboxLibrary(enabled: boolean) {
	const client = useClient();
	const params = { limit: AWDP_LIST_LIMIT };
	return useQuery({
		queryKey: qk.awd.library(params),
		queryFn: async () => {
			const { items, meta } = await callList<GameBoxLibraryDto>(
				client.awd.admin.listGameboxes(params),
			);
			return { items, total: meta.total ?? items.length };
		},
		enabled,
	});
}
