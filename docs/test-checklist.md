# Page2Task 发布前人工测试清单

前置:`chrome://extensions` → Page2Task 点刷新 🔄。
看报错的方法:弹窗上**右键 → 检查(Inspect)→ Console**,红字就是 bug;
后台报错看 `chrome://extensions` → Page2Task 卡片上的 **service worker** 链接。

## A. 外观与模式切换(2 分钟)
- [ ] 蓝色新主题正常:渐变背景、药丸形切换、白色表单卡片、界面无 emoji
- [ ] To-do 模式:无时间行、无 Location、有 Task list(多列表时)、日期标 optional
- [ ] Calendar 模式:有时间行 + Location,无 Task list
- [ ] Both:全部显示;按钮文案随模式变(Add to-do / Add event / Add both)
- [ ] 关掉弹窗重开:记住上次选的模式

## B. 网页 → 待办
- [ ] 打开一篇文章 → chip 显示 "Article"(没有 ~x min read)→ Title 自动填、Notes 有 URL
- [ ] Add to-do → 绿色成功横幅 + 链接 → 去 tasks.google.com 确认任务存在、在正确的 list
- [ ] 不填日期也能保存(无日期待办)

## C. Gmail
- [ ] 打开一封含截止日期的邮件 → 日期自动识别
- [ ] 多个候选日期时出现选择列表,点不同候选字段跟着变

## D. Calendar + Location(新功能)
- [ ] 粘贴 "Coffee chat with Sarah next Tuesday 3pm at GSB Coupa" → Location 自动填 "GSB Coupa"
- [ ] Add event → Google 日历里确认:时间对、时长对、**地点在正式 Location 栏**(不在描述里)
- [ ] Calendar 模式不填日期就提交 → 日期框红框 + 提示,不崩
- [ ] 手动改/清空 Location 再保存,以改后的为准

## E. Both 模式(新功能)
- [ ] 一次提交,Tasks 和 Calendar **都**出现;成功横幅有两个链接

## F. 导入区(这轮全部重写,重点)
- [ ] 打开弹窗直接 ⌘V 粘贴一段文字 → **立即**自动识别(没有按钮)
- [ ] 手动打字(≥8 个字符)停顿后 → 自动识别;继续编辑再停 → 用新文字重新识别
- [ ] ⌘V 粘贴截图 → 识别
- [ ] 点 "upload a file" 链接 → 打开文件选择器 → 选图识别
- [ ] 拖一张图片进弹窗 → 识别
- [ ] 占位句:框里有内容时消失、清空后回来

## G. 内置免费 AI(全新代码,最需要验证)
前置:Settings(齿轮)里**暂时清空** Gemini/Claude key;Chrome 版本 ≥138(`chrome://version` 查)。
- [ ] 无 key 打开弹窗,应是三种之一:
  - 直接 AI 识别成功(模型已就绪);或
  - 出现蓝色 "Enable free AI — one-time download" → 点击 → 百分比进度 → 完成后自动刷新、AI 可用;或
  - 旧 Chrome/硬件不支持 → 无报错,回退本地日期规则(英文日期仍能抓)
- [ ] 内置 AI 下粘贴截图:若不支持,提示应清晰友好,不是崩溃
- [ ] 测完把你的 Gemini key 填回去,确认云端 AI 仍正常

## H. 错误与边界
- [ ] 在 chrome:// 页面开弹窗 → "can't be read automatically",手填仍能保存
- [ ] Title 留空提交 → "Please enter a title"
- [ ] 断网提交 → 明确报错,不是永久转圈

## I. 账号
- [ ] 底部 "Saving to Google account: …" 是预期账号;options 页 Disconnect 换号正常

---
发现问题:截图 + 一句"做了什么、期望什么、实际什么",发给 Claude 修。
