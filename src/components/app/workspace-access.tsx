/**
 * 赛事工作区（AWD 驾驶舱 / AWDP 工作台 / 赛事题目）的访问闸门。
 *
 * 后端对这些端点有明确的参赛 / 时间 / 赛制判定：
 * - 选手端 AWD 状态：未参赛 → 403；
 * - AWDP 概览：未参赛 / 练习赛 → 403；
 * - 赛事题目：未开始或未参赛 → 400。
 *
 * 深链接无法绕过这里。与其先发请求再显示一个没有出路的「没有权限」，
 * 不如在事件详情已知时直接给出原因和下一步动作（去加入 / 去训练场 / 返回）。
 */

import type { ReactNode } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Ban, CalendarClock, LogIn, ShieldAlert } from "lucide-react";

import { Button } from "~/components/ui/button";
import { EmptyBlock } from "~/components/app/states";

export type WorkspaceAccessReason =
	| "wrong-family"
	| "practice"
	| "not-joined"
	| "not-started";

export interface WorkspaceAccessBlockProps {
	reason: WorkspaceAccessReason;
	eventId: string;
	/**
	 * 练习赛的下一步入口：AWDP → 训练场；Jeopardy → 题库；AWD → 赛事列表。
	 * 只对 `reason === "practice"` 生效。
	 */
	practiceEntry?: "training" | "challenges" | "events";
}

const REASON_META: Record<
	WorkspaceAccessReason,
	{ titleKey: string; descriptionKey: string; icon: ReactNode }
> = {
	"wrong-family": {
		titleKey: "common.workspaceAccess.wrongFamilyTitle",
		descriptionKey: "common.workspaceAccess.wrongFamilyDescription",
		icon: <Ban className="size-5" aria-hidden="true" />,
	},
	practice: {
		titleKey: "common.workspaceAccess.practiceTitle",
		descriptionKey: "common.workspaceAccess.practiceDescription",
		icon: <ShieldAlert className="size-5" aria-hidden="true" />,
	},
	"not-joined": {
		titleKey: "common.workspaceAccess.notJoinedTitle",
		descriptionKey: "common.workspaceAccess.notJoinedDescription",
		icon: <LogIn className="size-5" aria-hidden="true" />,
	},
	"not-started": {
		titleKey: "common.workspaceAccess.notStartedTitle",
		descriptionKey: "common.workspaceAccess.notStartedDescription",
		icon: <CalendarClock className="size-5" aria-hidden="true" />,
	},
};

export function WorkspaceAccessBlock({
	reason,
	eventId,
	practiceEntry = "events",
}: WorkspaceAccessBlockProps): ReactNode {
	const { t } = useTranslation();
	const meta = REASON_META[reason];

	const action =
		reason === "practice" ? (
			<Button asChild>
				<Link
					to={
						practiceEntry === "training"
							? "/training"
							: practiceEntry === "challenges"
								? "/challenges"
								: "/events"
					}
				>
					{practiceEntry === "training"
						? t("common.workspaceAccess.goTraining")
						: practiceEntry === "challenges"
							? t("common.workspaceAccess.goChallenges")
							: t("common.workspaceAccess.backToEvent")}
				</Link>
			</Button>
		) : (
			<Button asChild>
				<Link to={`/events/${eventId}`}>{t("common.workspaceAccess.backToEvent")}</Link>
			</Button>
		);

	return (
		<EmptyBlock
			icon={meta.icon}
			title={t(meta.titleKey)}
			description={t(meta.descriptionKey)}
			action={action}
		/>
	);
}
