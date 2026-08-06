# Claude Design 出图包：Web Store 五张截图

用法：在 claude.ai/design 新建一个项目，**先上传 design-reference-popup.html**（同目录下的单文件参考页，内嵌真实产品 CSS 与两种弹窗形态），再发「第 0 条」让它对照代码学风格，之后逐条发图 1 到图 5。生成后把成品发回给 Claude Code 做尺寸规格化（精确 1280×800、无透明通道）。

---

## 第 0 条：风格学习（开场先发这条）

```
你接下来要为一个 Chrome 插件「Page2Task」生成 5 张 Chrome Web Store 宣传图。我附上了 design-reference-popup.html：这是产品的真实界面代码（CSS 原样内嵌）和两种弹窗形态的静态还原，**以这份代码为最高准绳**学习它的视觉风格；下面的文字描述是对代码的概括，两者冲突时以代码为准。

【产品是什么】
把网页、邮件、聊天截图或任何文字变成 Google Tasks 待办 / Google Calendar 日程的 Chrome 插件。气质：轻、快、可信赖，像 Google Calendar 的近亲。

【设计系统：Google Calendar 蓝系，仅浅色模式】
- 页面背景：垂直渐变，从 #FAFCFF 经 #F2F6FE、#DDE9FD 到 #C8DDFB（上浅下深的天空蓝）
- 主色（按钮、链接、标签）：#0B57D0；hover 深化为 #0842A0；按钮文字白色
- 字段标签蓝：#1967D2；正文字 #1F1F1F；次要文字 #5F6368
- 选中态浅蓝：#C2E7FF（文字 #001D35）；芯片底 #E8F0FE；输入框底 #F0F4FC
- 成功绿：文字 #137333 底 #E6F4EA；错误红：文字 #C5221F 底 #FCE8E6
- 虚线强调（粘贴区）：#669DF6 的蓝色虚线圆角框
- 边框：rgba(11,87,208,0.14) 的极浅蓝
- 卡片：纯白、圆角 12 到 14px、柔和投影（0 8px 20px -8px rgba(20,45,90,0.16)）
- 主按钮 CTA：大圆角（接近药丸）、#0B57D0 实底、下方大范围柔和蓝色投影
- 模式切换：白色药丸分段控件，选中段填 #C2E7FF
- 字体：Roboto（无衬线，标签 12 到 13px，标题加粗 15px）
- 无 emoji 装饰、无深色模式、留白充足、整体通透

【Page2Task 弹窗的标准形态（图里画它时照这个）】
宽窄竖版卡片：顶部小 logo + 「Page2Task」粗体标题；下方药丸三段切换 To-do / Calendar / Both；一个蓝色虚线圆角的粘贴区；一张白色表单卡（Title、Date、Time、Location、Notes 字段，标签为蓝色小字）；底部一颗大号蓝色 CTA（主文案 + 下行小字 Google Tasks 或 Google Calendar）。

【硬性规范，每张图都要遵守】
- 画布：1280×800，全出血，直角，不留白边，背景铺满（用产品的天空蓝渐变或纯浅色）
- 图内文案一律英文，任何文字都不使用破折号（用冒号、逗号、句号）
- 不出现任何真实品牌 logo（Gmail、WhatsApp、Twitter 都画成风格化的通用界面，不用它们的标志）
- 界面模拟图中的次要文字用浅灰圆角横条表示（placeholder bars），只有关键内容用真实文字
- 导出为不带透明通道的位图

先确认你理解了这套风格，然后等我逐张发需求。
```

---

## 图 1：总览概念图（输入 → Page2Task → 输出）

```
第 1 张：总览概念图。画布 1280×800，三段式横向构图，讲「任何内容都能变成待办或日程」。

左侧（约 30% 宽）：四张小场景卡片竖排，代表四种输入，每张是一个极简风格化界面缩略图 + 一行英文小标：
1. 网页文章（几条灰色文字横条 + 一张小图）标 Articles
2. 视频页（一个带播放键的缩略图）标 Videos
3. 打开的邮件（信封头像 + 文字横条）标 Emails
4. 聊天截图（两三个对话气泡）标 Chats and pasted text

中间（约 35% 宽）：Page2Task 弹窗的标准形态（按风格档案画），四条柔和的蓝色流线从左侧四张卡汇入弹窗。弹窗上方一行主标题，英文：Anything you see becomes a task or an event

右侧（约 35% 宽）：两张输出卡片竖排，从弹窗各引一条流线：
1. Google Calendar 风格的日程块：色条 + 标题 Dinner with Amy + 时间 Thu, Aug 13 · 7:30 PM
2. Google Tasks 风格的待办行：圆形勾选框 + 标题 Submit grant application + 日期小字 Fri, Aug 14
两张卡下方分别标小字 Google Calendar 和 Google Tasks。

整体气质：轻盈的流程图海报，流线纤细优雅，背景用产品的天空蓝渐变。
```

---

## 图 2：邮件 → 待办

```
第 2 张：邮件场景。画布 1280×800，左右两栏。

左栏（约 55%）：风格化的邮件阅读界面（不是 Gmail，不用任何品牌标志）：顶部一个圆形头像 + 发件人名 Housing Office + 加粗主题行 Action required before you move out。正文全部用浅灰圆角横条表示，只有中间一句是真实文字并带浅黄色高亮底：
The deadline to submit your housing cancellation is Friday, Aug 14 at 3:00 PM
高亮句下方再接两条灰色横条收尾。

右栏（约 45%）：Page2Task 弹窗，To-do 模式选中，表单已自动填好：
- Title 字段：Submit housing cancellation
- Date 字段：2026/08/14
- 备注区显示一行小字：Time 15:00
- 底部蓝色 CTA：主文案 Add to-do，下行小字 Google Tasks

从左侧高亮句引一条柔和的蓝色曲线箭头指向右侧 Title 字段，表达「这句话被自动识别成了待办」。顶部一行英文标题：It reads the deadline for you
```

---

## 图 3：聊天对话 → 日历日程

```
第 3 张：聊天场景。画布 1280×800，左右两栏。

左栏（约 50%）：风格化的手机聊天界面（通用绿色气泡风，不用 WhatsApp 标志）：对话内容真实可读：
对方: Dinner Thursday to celebrate? 7pm?
我方: Yes!! Can we do 7:30 though
对方: 7:30 at Madera works, see you there
三条气泡，时间戳小字可加。重点：这段对话里时间改过一次，最终是 7:30。

右栏（约 50%）：Page2Task 弹窗，Calendar 模式选中，表单自动填好：
- Title：Dinner with Amy at Madera
- Date：2026/08/13
- Start time 19:30，End time 20:00
- Location：Madera
- 底部蓝色 CTA：主文案 Add event，下行小字 Google Calendar
弹窗下方再放一个小的 Google Calendar 风格日程块预览：Thu Aug 13, 7:30 PM Dinner with Amy。

从聊天最后一条气泡引蓝色曲线箭头到弹窗。顶部英文标题：Screenshot a chat, it catches the final plan
（这句话在强调产品能识别「改过时间后的最终约定」，构图上让 7:30 在聊天和表单里都醒目。）
```

---

## 图 4：被推荐的文章 → 阅读待办

```
第 4 张：稍后阅读场景。画布 1280×800，左中右三步式构图。

左侧：一张风格化的社交帖子卡片（通用样式，不用 Twitter 或 X 标志）：圆头像 + 用户名 + 帖子文字：
Highly recommend this read on AI agents
帖子下方附一张链接预览小卡：文章标题 Building Effective Agents + 两条灰色摘要横条。

中间：Page2Task 弹窗的紧凑版，To-do 模式，表单填好：
- Title：Read: Building Effective Agents
- Date 字段留空（显示 placeholder yyyy/mm/dd，表达无日期待办）
- 底部蓝色 CTA：Add to-do / Google Tasks

右侧：一张 Google Tasks 风格清单卡，标题 Reading，里面三行待办：第一行就是 Read: Building Effective Agents（圆形勾选框），下面两行用灰色横条表示。

左到中、中到右各一条蓝色流线。顶部英文标题：Save it now, read it on your list
```

---

## 图 5：直接手写待办

```
第 5 张：手写场景。画布 1280×800，居中单主体构图，Page2Task 弹窗放大居中（这张是五张里最接近真实产品截图的一张，按风格档案里的标准形态精确还原）。

弹窗状态：
- To-do 模式选中
- 蓝色虚线粘贴区里是用户正在输入的一句话（带光标）：Pick up the poster prints before Friday
- 下方表单已自动解析出：Title 字段 Pick up the poster prints，Date 字段 2026/08/14
- 底部蓝色 CTA：Add to-do / Google Tasks

弹窗左右两侧留出呼吸感，背景天空蓝渐变铺满。顶部英文标题：Or just type it, dates are understood
右下角一行小字：Free on-device AI included. Add your own API key for stronger results.
```

---

## 生成后交回 Claude Code 的检查项

1. 尺寸精确 1280×800（不足或超出我来缩放裁剪）；
2. 无透明通道（PNG 需拍平成背景色）；
3. 图内文字无破折号、无中文（商店语言为英文）；
4. 无任何真实品牌 logo。

---

## 修订 R1（在生成初版后发这条）

```
基于你刚才生成的这版做一次修订，保持画布 1280×800、整体构图、风格和已有文案不变，只改以下三处：

【修订一：必须看得出这是一个 Chrome 插件，不是独立 App】
所有出现 Page2Task 界面的画面，一律套上简化的浏览器窗口外壳：窗口左上三个圆点，顶部一个浏览器标签页 + 圆角地址栏；地址栏右侧的工具栏里放 Page2Task 的蓝色勾选图标；Page2Task 弹窗从这个图标正下方垂坠展开（顶边与工具栏相接，带柔和投影），弹窗下方透出正在浏览的网页内容。场景内容（邮件、聊天、文章）都画在浏览器窗口内部，而不是独立卡片。图 1 总览图中间的 Page2Task 弹窗也在顶部加一条迷你工具栏 + 图标，弹窗从图标垂下，表达「它住在浏览器里」。

【修订二：替换示例文案】
所有出现 housing 的示例全部替换：
- 邮件里的高亮句改为：The deadline to submit your grant application is Friday, Aug 14 at 3:00 PM
- 对应的待办标题改为：Submit grant application
- 发件人名改为：Research Grants Office，主题行改为：Your application timeline
- 图 1 总览图右侧待办卡的标题 Submit housing form 也改为 Submit grant application

【修订三：图 2 升级为「一次识别多个，用户勾选」的展示】
邮件正文里有两句高亮（其余仍是灰色横条）：
1. The deadline to submit your grant application is Friday, Aug 14 at 3:00 PM
2. Interviews will be held the week of Aug 20
右侧 Page2Task 弹窗不再直接显示单个表单，而是显示多候选勾选列表（样式严格按参考 HTML 里的 cand 组件）：标题行 Several deadlines found. Check the ones to add; edit each one below: 下面两行候选，各带蓝色勾选框（均为勾选态）：
- Aug 14 15:00  Submit grant application
- Aug 20  Prepare for grant interview
底部蓝色 CTA 主文案改为 Add 2 to-dos，下行小字 Google Tasks。
这张图的顶部英文标题改为：One email, several deadlines, all caught
两条高亮句各引一条蓝色细线，分别指向右侧对应的候选行。
```

---

## 修订 R2（Google 联动强化；logo 用占位，后期由 Claude Code 合成官方原版）

```
基于当前版本再做一次修订，目标：让「专门联动 Google Tasks 和 Google Calendar」一目了然。保持画布、构图、风格不变，只改以下几处：

【统一的联动徽章，五张图都要】
每张图右下角加同一个小徽章：白色圆角胶囊，内容从左到右是两个 24px 的正方形空白占位（圆角 6px，极浅灰描边，内部完全留空，后期会贴官方 logo）+ 一行英文小字 Works with Google Tasks and Google Calendar。徽章低调清晰，不与主体抢戏。

【图 1 总览图】
- 主标题改为：Anything you see becomes a Google Task or a Calendar event
- 右侧两张输出卡片改为更接近真实产品：
  日历卡：头部一行 = 24px 空白 logo 占位 + 文字 Google Calendar；下方日程块（左缘蓝色竖色条 + Dinner with Amy + Thu, Aug 13 · 7:30 PM）
  待办卡：头部一行 = 24px 空白 logo 占位 + 文字 Google Tasks；下方待办行（圆形勾选框 + Submit grant application + Fri, Aug 14）
- 弹窗到两张卡的流线保留

【图 2 邮件场景】
CTA 按钮下方加一行小字：Saved to your Google Tasks，行首留 18px 空白 logo 占位

【图 3 聊天场景】
弹窗下方的日程块预览升级为迷你日历卡：头部一行 = 24px 空白 logo 占位 + 文字 Google Calendar，下方是日程块

【图 4 阅读场景】
右侧 Reading 清单卡头部加一行 = 24px 空白 logo 占位 + 文字 Google Tasks；标题拼写修正为 Building Effective Agents

【图 5 手写场景】
右下角放统一徽章，原有的 Free on-device AI 小字上移一行与其并存
```

注：官方 logo 文件存放于 store-assets/（不入 zip），终检合成时使用。

---

## 修订 R2 终版（取代上一条 R2：logo 由 Claude Design 直接绘制，不再用占位）

要点：给出两个 logo 的几何结构与官方色值让它精确复刻（Calendar：蓝 #4285F4 上/左边条、黄 #FBBC04 右边条、绿 #34A853 下边条、红 #EA4335 右下折角、白心蓝 31；Tasks：蓝 #4285F4 圆环加对勾，重叠段深蓝 #1A73E8），严禁风格化再创作；其余改动同 R2（统一徽章、五图各自的 logo 位、图 4 拼写修正）。若绘制走形，把官方 logo 原图上传到会话让它照图复刻。完整措辞见聊天记录 2026-08-06。

---

## 修订 R3（图 5 文案事实修正）

```
小修订，只改一处：图 5 右下角的小字 Free on-device AI. Nothing leaves your computer. 表述不准确（用户可添加自己的 API key，且任务本身会保存到 Google 账号），替换为：
Free on-device AI included. Add your own API key for stronger results.
其余一切不动。
```
