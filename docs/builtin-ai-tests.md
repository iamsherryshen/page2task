# 本地 AI 模型测试清单(15 条)

**用法**:设置页把 AI 来源切到「本地 AI 模型」→ 打开插件弹窗 → 逐条复制下面的「粘贴原文」贴进输入框 → 和「标准答案」对照。

**重要**:所有日期按**今天 = 2026-08-04(周二)**计算。如果你在其他日期测试,「明天」「周四」这类相对日期的标准答案要相应顺延;写死的日期(如 8 月 20 号)不变。

建议每条记录:通过 / 失败(失败时记下它实际输出了什么)。

---

## 1. 两次改时间的约咖啡(核心回归用例)

**考察**:是否抓了链条中间被替换掉的时间(3pm 或 4pm)而不是最终的 4:30;是否把三次提议拆成 3 条。

```
iMessage — Jess Park

Today 09:02
Jess: coffee tomorrow to prep for the Bain interview? Coupa at GSB?
Me: yes!! 3pm?
Jess: ahh I have office hours till 3:30 😅 can we do 4 instead?
Me: 4 works for me

Today 13:47
Jess: soo sorry, my office hours just got moved AGAIN. push to 4:30??
Me: haha np, 4:30 at Coupa then
Jess: perfect, see u there tmrw 🙌
```

**标准答案**:恰好 1 条。和 Jess 在 Coupa Café 喝咖啡准备 Bain 面试;日期 2026-08-05(明天,周三);时间 16:30;地点 Coupa Café。

## 2. 彻底取消的晚饭

**考察**:是否无视取消消息,照样输出「周五 19:30 Madera 晚餐」;或把「等你回来再约」编造成一条日程。

```
微信 · 与 Yuki 的聊天

昨天 22:05
Yuki: 周五晚上去 Madera 吃饭庆祝你拿 offer 呀🎉
我: 好呀好呀!七点?
Yuki: 订七点半吧,我下班开车过去
我: 没问题,我来订位

今天 11:32
Yuki: 宝,周五得取消了😭 我临时要飞纽约见客户,周日才回来
我: 啊没事没事!你忙你的,等你回来再约
Yuki: 回来我请你!抱抱
```

**标准答案**:0 条(应提示没有发现可添加的内容)。晚饭已明确取消,「等你回来再约」不构成新计划。

## 3. 纯闲聊无任务

**考察**:无中生有。硬凑「和小雨视频」「补看综艺」等条目并幻觉日期;把「改天」当成明天。

```
昨天 22:31
小雨: 姐妹 我刚看完新一季花儿与少年 笑死我了😂
Sherry: 哪期哪期 我还没看
小雨: 第三期 你快去补
Sherry: 最近忙疯了 全是due 根本没时间
小雨: 你们商学院不是天天开party吗哈哈
Sherry: 别提了 party是别人的 due是我的🥲
小雨: 心疼你 加州天气还好吗
Sherry: 天天大太阳 就是晚上有点凉
小雨: 羡慕 北京快热化了
Sherry: 等你忙完暑假来找我玩呀
小雨: 好呀好呀 改天视频细聊☺️
Sherry: 嗯嗯 晚安~
小雨: 晚安!
```

**标准答案**:0 条。

## 4. 群聊双计划(必须输出 2 条)

**考察**:「通常只出 1 条」是否让它漏掉一个计划;或把每个人的附和拆成 3 条以上;周六是否误算成 08-09。

```
GSB Section 3 群聊 (iMessage)

Today 12:40
Marcus: reminder — GEM case group meets tomorrow 7pm, Bass Library room 2B. everyone good?
Priya: 👍
Me: yes!
Diego: in

Today 12:55
Priya: separately — potluck at my place this Saturday, 6:30pm! Oak Creek apts. who's in?
Marcus: count me in
Me: me too!! I'll bring dumplings 🥟
Diego: 🙌🙌
```

**标准答案**:恰好 2 条。① GEM case group 讨论:2026-08-05(明天)19:00,Bass Library;② Priya 家 potluck:2026-08-08(本周六)18:30,Oak Creek。

## 5. 三项交付的课程邮件(必须输出 3 条)

**考察**:少抽——只输出 1 条或合并成「完成作业」;tomorrow (Wednesday) 是否算成 08-05;E103 是否错挂到前两条。

```
From: Prof. David Hoffman <dhoffman@stanford.edu>
Subject: STRAMGT 355 — Week 1 Deliverables

Hi everyone,

Welcome back! Three quick action items as we kick off the quarter:

1. Team charters: Please submit your study team charter on Canvas by this Friday, Aug 7, 11:59 PM.

2. Case prep: Your written analysis of the Sequoia "RIP Good Times" case (2 pages max) is due before class on Monday, Aug 10 — upload to Canvas by 8:00 AM.

3. Office hours: Sign up for a 15-minute intro slot with me by tomorrow (Wednesday) end of day. Meetings will be in GSB North Building, room E103. The signup sheet is on Canvas.

Looking forward to a great quarter.

— Prof. Hoffman
```

**标准答案**:恰好 3 条。① 提交 team charter:2026-08-07,23:59;② 提交 Sequoia 案例分析:2026-08-10,08:00;③ 预约 office hours:2026-08-05(时间可空,地点可空或 E103)。

## 6. 中文周四下午茶约

**考察**:中文相对日期。周四是否算成 08-06(容易差一天或落到下周四 08-13);「下午2点」是否转成 14:00 而不是 02:00。

```
昨天 21:47
王雨晴: 学姐~这周想找你请教一下选课的事 你什么时候方便呀
我: 周四下午2点吧 我在Coupa Café等你 ☕
王雨晴: 好嘞好嘞 是GSB旁边那个Coupa对吧
我: 对 到时见~
```

**标准答案**:1 条。和王雨晴在 Coupa Café 聊选课(中文标题);2026-08-06;14:00;Coupa Café。

## 7. 英文 next Friday + 时间段

**考察**:「next Friday」是否被解析成本周五 08-07 而非下周五 08-14;时间段是否丢掉 endTime;PM 是否换算错。全组唯一考 endTime 的用例。

```
From: GSB Technology Club <techclub-officers@gsb.stanford.edu>
Subject: Fall Kickoff Happy Hour @ Madera

Hi everyone,

Welcome (back)! To kick off the year, the Tech Club is hosting our annual happy hour next Friday from 5:30-8:00 PM at Madera (Rosewood Sand Hill). First round is on us — come meet the new co-presidents and hear about this year's treks.

No RSVP needed. See you there!

— GSB Tech Club
```

**标准答案**:1 条。参加 Tech Club happy hour;2026-08-14;开始 17:30、结束 20:00;地点 Madera (Rosewood Sand Hill)。(若输出 08-07 属于常见歧义,算半对,记录下来。)

## 8. 已过期的截止邮件

**考察**:过期处理。仍生成 07-31 的条目;或自作聪明把日期顺延到本周五/今天,都是错的。

```
From: GSB Career Management Center <cmc@gsb.stanford.edu>
Subject: Reminder: Consulting resume drop closes soon

Hi Sherry,

A reminder that the resume drop for on-campus consulting interviews (McKinsey, Bain, BCG) closes this Friday, July 31 at 11:59 PM PT. Submit your resume and cover letter via 12twenty. Late submissions will not be accepted.

Best,
CMC Team
```

**标准答案**:0 条(2026-07-31 已过)。

## 9. 无日期的待办

**考察**:日期时间都没有时,dueDate 必须是 null;最常见错误是擅自填今天。

```
Yesterday 23:12
Priya: hey! can you grab us a study room at Bass Library for the GSB 285 group project? any day works, we're flexible 🙏
Me: on it!
```

**标准答案**:1 条。帮 GSB 285 小组订 Bass Library 自习室;无日期、无时间;地点 Bass Library(空也可接受)。

## 10. 长新闻信里唯一的截止

**考察**:多抽——把 BBQ 回顾、营业时间、讲座预告、播客也抽成条目;或被噪音淹没漏掉唯一真实截止。

```
GSB Student Association — Weekly Digest

Happy Tuesday, GSB!

RECAP: Huge thanks to everyone who came out to the Welcome Back BBQ last Saturday on the Town Square lawn — over 300 of you showed up! Photos are up on the shared drive.

CONGRATS: Our intramural soccer team took second place in the summer league. Well played, Axe & Palm FC!

HEADS UP: Coupa Café at the GSB is now opening at 7:30 AM on weekdays. Cold brew people, rejoice.

APPLICATIONS OPEN: The Global Study Trip to Japan (December break) is accepting applications now. Applications close this Friday, Aug 7 at 5:00 PM PT — apply via the link on the GSB portal. Late submissions will not be accepted.

SAVE THE DATE: The View From The Top speaker series returns in September — lineup announcement coming soon.

PODCAST CORNER: This week we're loving "Grit & Growth" episode 47. Give it a listen on your walk to Bass.

Have a great week!
— Your GSB SA Team
```

**标准答案**:恰好 1 条。提交 Global Study Trip(日本)申请;2026-08-07;17:00;地点空。

## 11. 双人双地配对

**考察**:错配成 Jake + Bass Library;把 Amy 和 Jake 的约多抽成第二条;日期取成被拒的周五。

```
微信 和 Amy 的聊天

我 16:20
周五下午一起过 mock case 吗?
Amy 16:24
周五不行诶 我约了 Jake 在 Bass Library 赶 OB 作业
我 16:25
那周四呢
Amy 16:26
周四可以!Old Union 下午2点?
我 16:26
成 周四见
```

**标准答案**:1 条。和 Amy 在 Old Union 过 mock case;2026-08-06;14:00;Old Union。Jake 和 Bass Library 不应出现。

## 12. 中文绝对日期晚宴通知

**考察**:「8月20号」补全年份;「晚上7点半」转 19:30 而不是 07:30;地点应是 Tai Pan 而不是 University Ave。

```
【GSB中国学生学者联谊会】各位同学好!新学年迎新晚宴定在8月20号晚上7点半,地点是 Palo Alto 的 Tai Pan(University Ave 旁边那家港式茶餐厅),人均 $45 含茶位。想来的同学请扫码接龙报名,位置有限先到先得~
```

**标准答案**:1 条。参加迎新晚宴(中文标题);2026-08-20;19:30;Tai Pan。

## 13. 拒绝原时段后反提议(回归用例)

**考察**:是否又选中被拒绝的周四 14:00;或把「我有 Managerial Finance 课」错当成日程。

```
From: Amanda Liu <amanda.liu@sequoiacap.com>
Subject: Re: Coffee chat — Sequoia summer associate role

Hi Sherry, great to connect at the GSB career fair. Would Thursday at 2:00 PM work for a 30-minute Zoom chat?

Best,
Amanda

---
From: Sherry Shen <cfshen@stanford.edu>

Hi Amanda, unfortunately Thursday 2pm I have Managerial Finance — could we do Friday at 11:00 AM instead?

---
From: Amanda Liu

Friday 11:00 AM works great. I'll send over a Zoom link shortly. Talk then!
```

**标准答案**:恰好 1 条。和 Amanda Liu 的 Zoom coffee chat;2026-08-07(本周五);11:00;地点 Zoom 或空,绝不能是教室。

## 14. 餐厅名像人名(回归用例)

**考察**:把 Oren 误当人名、标题写成「和 Oren 吃饭」而丢掉真正的人 Jenny。

```
iMessage with Jenny Park

Today 11:47 AM
Jenny: dinner this week??
Jenny: craving Oren's Hummus so bad lol
Me: omg yes
Jenny: tomorrow 6:30? the University Ave one
Me: perfect, see u there 🫶
```

**标准答案**:1 条。和 Jenny 在 Oren's Hummus 吃晚饭;2026-08-05(明天);18:30;地点 Oren's Hummus。

## 15. 只说今晚没说日期(默认今天规则)

**考察**:「约了时间但没说日期就用今天」的正向验证。日期是否为空或错填明天。

```
Today 14:22
Mia: facetime tonight 8pm? need to vent about my internship 😩
Me: ofc!! call me at 8
```

**标准答案**:1 条。和 Mia 视频通话;2026-08-04(今天);20:00;地点空。

---

## 尚未覆盖的盲区(本清单测不到,记录备查)

1. **截图输入路径**:以上全是粘贴文字。建议把第 1、2、6 条做成 iMessage/微信截图再测一遍,同一套标准答案,顺便验证读图;海报/传单类图片另补;
2. **跨时区**:招聘邮件写 "3pm ET" 之类;
3. **跨天时间**(凌晨 12 点半结束);
4. **周期性事件**(每周三例会,产品本身无重复字段,观察它如何降级);
5. **任务清单归类**(list 字段):本清单不判分,单独抽查;
6. **重度中英夹杂**的聊天。
