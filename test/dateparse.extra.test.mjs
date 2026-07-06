// 日期识别模块的加强测试。运行:node test/dateparse.extra.test.mjs
// 基准日 2026-07-03 是周五(与 test/dateparse.test.mjs 保持一致)。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 用间接 eval 在全局作用域加载 chrono 打包文件(定义全局变量 chrono)
(0, eval)(fs.readFileSync(path.join(__dirname, '../lib/vendor/chrono.js'), 'utf8'));
const require = createRequire(import.meta.url);
const DateParse = require('../lib/dateparse.js');

// 固定基准日:2026-07-03 是周五
const REF = new Date('2026-07-03T09:00:00');

let pass = 0;
let fail = 0;
function check(name, actual, expected) {
  if (actual === expected) {
    pass++;
  } else {
    fail++;
    console.error(`  ✗ ${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
const ex = (text) => DateParse.extract(text, REF);

// —— 英文:带时间的下周五(2026-07-10 是周五)——
let r = ex('please submit the report by next Friday 5pm');
check('en: next Friday 5pm date', r.dueDate, '2026-07-10');
check('en: next Friday 5pm time', r.dueTime, '17:00');

// —— 中文:具体日期 + 下午时间 ——
r = ex('请在7月10日下午3点之前提交');
check('zh: 7月10日下午3点 date', r.dueDate, '2026-07-10');
check('zh: 7月10日下午3点 time', r.dueTime, '15:00');

// —— 中文:明天 + 下午时间(明天是 2026-07-04 周六)——
r = ex('明天下午3点');
check('zh: 明天下午3点 date', r.dueDate, '2026-07-04');
check('zh: 明天下午3点 time', r.dueTime, '15:00');

// —— 英文:斜杠数字日期 ——
r = ex('deadline is 07/10');
check('en: 07/10 date', r.dueDate, '2026-07-10');

// —— 中文:本周五就是今天(基准日 2026-07-03 即周五),中午12点保持 12:00 ——
r = ex('本周五中午12点');
check('zh: 本周五中午12点 date', r.dueDate, '2026-07-03');
check('zh: 本周五中午12点 time', r.dueTime, '12:00');

// —— 中文:下下周三(2026-07-15 是周三)——
r = ex('下下周三');
check('zh: 下下周三 date', r.dueDate, '2026-07-15');

// —— 中文:8月1日中午12点前(2026-08-01 是周六)——
r = ex('报告请于8月1日中午12点前发给我');
check('zh: 8月1日中午12点 date', r.dueDate, '2026-08-01');
check('zh: 8月1日中午12点 time', r.dueTime, '12:00');

// —— 关键词偏好:两处日期,只有第二处靠近「截止」,应选第二处 ——
r = ex('我们7月6日开了个会,终稿的截止日期是7月22日。');
check('zh: 两处日期取靠近截止的 7/22', r.dueDate, '2026-07-22');

// —— 无日期文本:中英文都应返回全 null ——
r = ex('Please review the attached slides and let me know your thoughts.');
check('en: 无日期 -> date null', r.dueDate, null);
check('en: 无日期 -> time null', r.dueTime, null);
check('en: 无日期 -> matchedText null', r.matchedText, null);

r = ex('这篇文章的排版和配色都很好看');
check('zh: 无日期 -> date null', r.dueDate, null);
check('zh: 无日期 -> time null', r.dueTime, null);
check('zh: 无日期 -> matchedText null', r.matchedText, null);

// —— 中文:12月31日全天(2026-12-31,「全天」不产生具体时间)——
r = ex('12月31日全天');
check('zh: 12月31日全天 date', r.dueDate, '2026-12-31');
check('zh: 12月31日全天 -> time null', r.dueTime, null);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
