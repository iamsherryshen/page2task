# Google 设置指南(中文版)

一次性设置,大约 10 分钟。这一步会把 Page2Task 连接到**你自己的** Google 账号——通过**你自己的**(免费)Google Cloud 项目,不经过任何第三方。

## 第一步:把插件装进 Chrome

1. 把 `manifest.template.json` 复制一份,改名为 `manifest.json`(已做过可跳过);
2. 打开 `chrome://extensions`,右上角打开 **「开发者模式」**;
3. 点 **「加载已解压的扩展程序」**,选择本项目文件夹;
4. 记下 Page2Task 卡片上显示的 **ID**(32 个字母),第二步要用。

> ⚠️ 这个 ID 由文件夹路径推算而来。以后**移动或改名文件夹,ID 会变**,Google 授权就失效了。要么别动文件夹,要么按文末《固定插件 ID》一劳永逸。

## 第二步:在 Google 登记这个插件

1. 打开 [console.cloud.google.com](https://console.cloud.google.com),用**你要写入日历的那个 Google 账号**登录;
2. 顶部项目选择器 → **「新建项目」**,名字随便填(如 `Page2Task`),创建后切换过去;
3. 启用两个接口(顶部搜索框搜索):
   - **Google Tasks API** → 打开 → **「启用」**;
   - **Google Calendar API** → 打开 → **「启用」**;
4. 设置同意屏幕(新版叫「Google Auth Platform」):
   - 菜单 → **「API 和服务」→「OAuth 同意屏幕」**,会自动跳到新版页面;
   - 首次进入点 **「开始使用 / Get started」**,按向导填:应用名随便,支持邮箱选自己的,**「受众 / Audience」选「外部 / External」**,同意并创建;
   - 然后点左侧 **「受众 / Audience」**,找到 **「测试用户 / Test users」**,点 **「+ Add users」**,填**你自己的 Google 邮箱**(漏了这步授权会被拒绝);
5. 创建凭据:
   - **「API 和服务」→「凭据」→「创建凭据」→「OAuth 客户端 ID」**(或在 Google Auth Platform 页面点左侧 **「客户端」→「创建客户端」**,是同一个东西);
   - 应用类型选 **「Chrome 扩展程序」**;
   - 商品 ID(Item ID)填第一步记下的插件 ID;
   - 创建后复制生成的 **客户端 ID**(以 `.apps.googleusercontent.com` 结尾)。

## 第三步:把客户端 ID 填进插件

用任意文本编辑器打开 `manifest.json`,把

```
"client_id": "PASTE_YOUR_CLIENT_ID_HERE.apps.googleusercontent.com",
```

整体替换成你的客户端 ID(保留引号),保存。

## 第四步:重新加载,完成授权

1. 回到 `chrome://extensions`,在 Page2Task 卡片点 **刷新 ⟳**;
2. 随便打开一个网页,点插件图标(可在拼图菜单里点图钉固定);
3. 点 **「✓ Set Todo」**——弹出一次 Google 授权窗口:
   - **这里选中的账号,就是以后所有待办/日历的去向**(必须在测试用户名单里);
   - 看到「Google 尚未验证此应用」是正常的(私人应用),点 **「继续」**(有时藏在「高级」里);
   - 所有权限都要允许;
4. 首次授权后那条待办通常已在后台保存成功——去 [tasks.google.com](https://tasks.google.com) 确认,没有就再点一次。

完成!弹窗底部会一直显示 `Saving to Google account: …`,任务去向一目了然。

---

## 固定插件 ID(可选,推荐)

生成一个 `key.pem` 可以把插件 ID 永久固定(移动文件夹也不变),Google 授权就永远不会失效。在项目文件夹里执行:

```bash
openssl genrsa -out key.pem 2048
# manifest.json 里 "key" 字段的值:
openssl rsa -in key.pem -pubout -outform DER 2>/dev/null | base64 | tr -d '\n'
# 固定后的插件 ID(第二步用它):
openssl rsa -in key.pem -pubout -outform DER 2>/dev/null | shasum -a 256 | cut -c1-32 | tr '0-9a-f' 'a-p'
```

把 `"key": "<那串 base64>"` 加进 `manifest.json`,重新加载插件,然后在第二步使用打印出的 ID。`key.pem` 请保管好,不要提交到 git(已在 .gitignore 里)。

## 常见问题

**提示「Google 授权失败」?** 检查:① Chrome 已登录 Google 账号;② 你的邮箱已加入「测试用户」;③ 客户端 ID 粘贴完整。

**「应用未经验证」安全吗?** 安全——这是你自己的私人应用、自己的 Cloud 项目。Google 的验证流程是给公开发布的应用准备的。

**任务进了错误的账号?** 任务写入授权时选中的账号。设置页 → **Disconnect Google account**,重新保存时选对的账号(如需先把它加进测试用户)。

**换电脑?** 把整个文件夹(含你的 `manifest.json`,固定过 ID 的话还有 `key.pem`)拷过去,重做第一步和第四步。
