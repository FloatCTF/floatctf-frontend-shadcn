# Default 交互记录（逐页审计）

> 目的：先以 Default 的真实交互为基准，再改 shadcn。每页记录入口、筛选、行点击、
> 弹窗/抽屉、主操作与返回路径；截图保存在本目录。
>
> 本地 Default：`http://10.66.66.2:7780/?frontend=default`（Caddy + 已构建 Default）
> 本地 shadcn：`http://10.66.66.2:13400`
>
> Default 的本地/生产管理端当前都有一个 React #185（Maximum update depth）
> 页面错误；管理端行为以 Default 源码 `GenericTable` 为准，并在本文件注明证据。

## 1. 选手端 · Challenge Sets

入口：`/service/challenge_sets`

### 列表

![](./challenge-sets-player-list.png)

- 标题：`Challenge Sets`
- 工具栏：
  - `Add Filter`：打开字段菜单（`name` / `description`），不是详情弹窗；
  - 搜索/过滤输入：placeholder 为
    `Search or filter like `key1:value1 key2:value2``；
  - `Clear`：清空过滤并刷新；
  - `Apply Filters`：应用过滤并刷新。
- 表格列：名称、描述、更新时间；三列都可排序。
- **点击名称是普通链接**，进入独立详情页
  `/service/challenge_sets/:id`，不是在当前页开详情 Dialog。
- 行本身没有操作菜单；没有“打开”按钮列。

### Add Filter

![](./challenge-sets-player-add-filter.png)

- `Add Filter` 打开一个 **ActionMenu 下拉菜单**，列出可筛选字段；
- 选择字段后向输入框插入 `key:` / ` & key:`，焦点回到输入框；
- 不是 modal 对话框。

### 过滤输入

![](./challenge-sets-player-filtered.png)

- 输入框保留用户原始过滤表达式（例如 `name:Crypto`）；
- `Clear` / `Apply Filters` 是独立按钮，不是自动即时过滤；
- 过滤由列表重新请求完成，不在前端自造数据。

### 详情页

![](./challenge-sets-player-detail.png)

- 路径：`/service/challenge_sets/:id`
- 标题：`Challenge Set #<id>`
- 内容：题集内题目的表格（名称 / 更新时间等）；
- **详情是独立页**，不是列表页上的 Dialog。

## 2. 管理端 · Challenge Sets（源码审计）

源码：`frontends/default/src/routes/admin/challenge_sets/index.tsx` +
`frontends/default/src/components/Table.tsx`

- 列表：
  - `Add` 按钮；
  - 可勾选批量删除；
  - 每行名称链接到 `/admin/challenge_sets/:id`；
  - 行尾 `...` 操作菜单：`Edit row` / `Delete row`。
- `Add` / `Edit row` 打开 **右侧 Dialog/Drawer**：
  - 字段：名称、描述；
  - `Create` / `Save`；编辑时可删除；
  - 保存失败保留表单，不关闭。
- 题集详情页仍是独立页；详情页里的 `Add Challenges` 使用 **Dialog + GenericTable** 选择题目。
- 结论：管理端“点开 modal 框”指的是 **Add/Edit 行的右侧抽屉**，不是把整行点击改成
  题集内容弹窗。

> 证据：Default 管理端在当前本地/生产构建都会触发 React #185，无法稳定截图；
> 以上来自 Default 的 `GenericTable` 与 challenge_sets 路由源码。选手端交互已实测截图。

## 3. 当前 shadcn 的错误实现（本次要修）

- 选手端：做成了“自定义搜索 + 点击行开题集内容 Dialog”，且删掉了 Default 的
  `Add Filter` / `Clear` / `Apply Filters` 工具栏；
- 管理端：把行点击改成“题集内容弹窗”，而 Default 是行内操作菜单的 Edit 抽屉 +
  名称链接到详情页；
- 结果：交互层级与 Default 不一致，题集详情也不再是独立页。

## 4. 修复口径

- 选手端恢复 Default：
  - FilterBar（Add Filter 菜单 + filter 输入 + Clear + Apply）；
  - 表格三项列；
  - 名称链接到 `/challenge-sets/:id`；
  - 删除列表页的内容 Dialog。
- 管理端恢复 Default：
  - 名称链接详情页；
  - 行操作菜单 Edit/Delete；
  - Add/Edit 使用右侧抽屉；
  - 创建后刷新列表，不自动打开内容弹窗；
  - 题集内容仍在详情页维护；详情页添加题目使用 Dialog。

## 5. 选手端 · Events

入口：`/service/events`

![](./events-list.png)

- 工具栏：每页条数（10/20/50/100）、Add Filter、过滤输入、Clear、Apply Filters；
- 表头：标题、赛制、参赛者、状态、可加入、已加入、开始时间、结束时间；
- 标题是链接，进入对应赛制的事件工作区；
- 可加入 / 已加入用勾选表示；
- 没有卡片视图、没有额外的“打开”操作列。

## 6. 选手端 · Event Workspace

### Jeopardy（未加入时）

![](./event-jeopardy-overview.png)

- 顶部：赛事标题 + 倒计时进度；
- 一级 Tab：`Overview / Challenges / Instances / Scoreboard / Trend / Announcement`；
- 未加入时 Tab 仍然显示，内容区给出「你尚未加入本赛事」提示；不是把整个工作区替换成门禁页。
- 总览是「赛事说明/规则 + 右侧操作」布局，不是跨 Tab 常驻侧栏。

### AWD

![](./event-awd-overview.png)

- 顶部：赛事标题 + `poll/live`；
- 一级 Tab：`Overview / GameBoxes / Scoreboard / WireGuard / SSH`；
- 内容区按子页切换，不是把全部内容塞进单个 arena 页。

> 当前 shadcn 事件页已按这些 Tab 和总览布局调整；未加入时的 Tab 展示仍需按上图核对。

## 7. 选手端 · Gameboxes（Default）

入口：`/service/gameboxes`

![](./gameboxes-list.png)

- 表头：名称、分类、已解出、作者、版本、更新时间；
- 名称是链接：已有 active run 时进入训练；没有 active run 时点击名称直接开始训练；
- 工具栏：每页条数、Add Filter、过滤输入、Clear、Apply Filters；
- 没有额外的“资源/状态”列。

当前 shadcn 的训练场（`/training`）内容接近，但列和操作不同；应把入口按 Default 的
Gameboxes 位置与列对齐，训练 run 仍保留独立页。

## 8. 选手端 · Instances（Default）

入口：`/service/instances`

![](./instances-list.png)

- 表头：内容、类型、状态、赛事、标识、用户、销毁时间、操作；
- Challenge 实例的操作是 Destroy；GameBox 实例的操作是 Open；
- 工具栏：每页条数、Add Filter、过滤输入、Clear、Apply Filters。

## 9. 选手端 · Solves（Default）

入口：`/service/solves`

![](./solves-list.png)

- 表头：题目、用户、更新时间；
- 用户列带头像（无头像时显示昵称首字母）；
- 题目链接进入题目；
- 工具栏：每页条数、Add Filter、过滤输入、Clear、Apply Filters。

## 10. 选手端 · Announcements（Default）

入口：`/service/announcements`

![](./announcements-list.png)

- 表头：发布者、标题、内容、创建时间、更新时间；
- 工具栏：每页条数、Add Filter、过滤输入、Clear、Apply Filters；
- 没有卡片流，也没有单独的“查看公告”弹窗。

## 11. 选手端 · Weapons（Default）

入口：`/service/weapons`

![](./weapons-list.png)

- 表头：名称、分类、描述、有附件、文件地址、更新时间；
- 有附件用勾选；
- 文件地址是 `/public/<key>` 下载链接；
- 工具栏：Add Filter、过滤输入、Clear、Apply Filters；没有下载次数列。

## 12. 选手端 · Profile（Default）

![](./profile.png)

- 标题 `Profile`；两栏：左侧表单，右侧头像；
- 默认只读，点 `Edit` 才可修改 Nickname / Email / Password；Username 永远不可改；
- 头像区域点击选择图片，再上传；
- 没有额外的账号元数据卡片。

## 13. 选手端 · Discussions（Default）

入口：`/service/discussions`

![](./discussions-list.png)

- 顶部 `All / My Discussions` 两个 Tab；
- 表头：标题、作者、浏览、点赞、评论、创建时间；
- 标题链接进入讨论详情；
- 工具栏：每页条数、Add Filter、过滤输入、Clear、Apply Filters。

## 14. 选手端 · Writeups（Default）

入口：`/service/writeups`

![](./writeups-list.png)

- 表头：内容、作者、类型、邮箱、更新时间；
- 内容链接进入 Writeup 详情；
- 工具栏：每页条数、Add Filter、过滤输入、Clear、Apply Filters；
- 没有额外的统计卡片。

## 未加入赛事（2026-11-08）

用真实目标站临时账号 `qa_notjoined_37` 验收，随后已在管理端删除该账号：

- 赛事 `test`（Jeopardy，已结束，关闭自助加入）打开后仍显示 `总览 / 公告` 两个 Tab；
- 总览显示「该赛事未开放报名」与管理员添加参赛者的说明；
- 页面不再因为未参赛而整块隐藏 Tabs；
- 已参赛账号仍显示完整 Tab（题目 / 实例 / 积分榜 / 趋势 / 公告）。

## 已参赛 Jeopardy 赛事 Tab（2026-11-08）

用真实目标站临时赛事 `QA Join Event` 验收，随后已删除该赛事：

1. 管理端创建临时 Jeopardy 个人赛，允许自助加入；
2. 选手加入后，管理端把开始时间改到过去；
3. 选手端显示 Default 的六个 Tab：`总览 / 题目 / 实例 / 积分榜 / 趋势 / 公告`；
4. 总览包含赛事说明、规则、赛后 Writeup 提交与赛事信息；
5. 验收后管理员删除临时赛事，外键级联清理参赛记录。

## 已参赛 AWD 赛事（2026-11-08）

用真实目标站临时赛事 `QA AWD Event` 验收，随后已删除该赛事：

- 未参赛/未开始时 AWD 概览显示建队/入队表单；
- 创建战队后页面显示「已参赛」、战队名称/ID/成员与赛事 Writeup 提交；
- 把开始时间改到过去后，Tab 为 Default 的 `总览 / 靶机箱 / 积分榜 / WireGuard / SSH`；
- AWD 未配置时仍能显示战队与 Writeup，状态查询错误按后端原文展示；
- 验收后管理员删除临时赛事，战队/参赛记录级联清理。

验收中发现并修复：AWD 概览最初重复渲染两个建队表单；现只保留一个，AWDP 也补上同类表单。
