/**
 * 公告发布者的展示名。
 *
 * 后端 `publisher` 是**发布当时的展示名快照**（NOT NULL，永不随账号变化）；
 * `publisher_id` 为空表示该账号已被注销（`announcements.publisher_id`
 * 是 `ON DELETE SET NULL`）。
 *
 * 设计取舍：账号注销后**仍然展示当时的名字快照**（比「已注销账号」信息量更大），
 * 只额外标注「已注销」，让读者知道这个名字不再是当前有效账号。
 */
export function publisherLabel(row: {
	publisher?: string | null;
	publisher_id?: string | null;
}): string {
	const snapshot = (row.publisher ?? "").trim();
	if (!row.publisher_id) {
		return snapshot ? `${snapshot}（已注销）` : "已注销账号";
	}
	return snapshot || "—";
}
