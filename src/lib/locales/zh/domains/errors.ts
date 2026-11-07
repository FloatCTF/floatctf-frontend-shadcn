/**
 * 错误文案（稳定错误码 + 本地化原因，theme.md §7.11 / §8.2）。
 * 平台/后端返回的 `platformMessage` 优先于这里的兜底文案（不臆造原因）。
 */

export default {
	generic: "加载失败",
	network: "网络连接失败",
	forbidden: "没有访问权限",
	notFound: "资源不存在",
	technicalDetails: "技术细节",
	emptyResponse: "「{{what}}」没有返回数据",
	whatFailed: "{{what}}失败",
	requestFailed: "请求失败",
	unexpected: "发生未知错误",
	fallback: "操作失败，请稍后重试",
	networkDetail: "网络请求失败：无法连接服务器，请检查网络后重试",
	badRequest: "请求参数不被接受（400）",
	unauthorized: "登录状态已失效，请重新登录",
	forbiddenAction: "没有权限执行该操作（403）",
	notFoundDetail: "资源不存在或已被删除（404）",
	conflict: "当前状态与该操作冲突（409），请刷新后重试",
	tooManyRequests: "请求过于频繁（429），请稍后再试",
	serverError: "服务器错误（{{status}}），请稍后重试",
};
