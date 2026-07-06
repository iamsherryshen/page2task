// 日期识别模块的测试。运行:node test/dateparse.test.mjs
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

// —— 英文 ——
let r = ex('Please submit the report by next Friday 5pm.');
check('en: next Friday date', r.dueDate, '2026-07-10');
check('en: next Friday time', r.dueTime, '17:00');

r = ex('The assignment is due July 10.');
check('en: due July 10', r.dueDate, '2026-07-10');

r = ex('deadline: 7/10');
check('en: 7/10', r.dueDate, '2026-07-10');

r = ex('Please submit by tomorrow EOD.');
check('en: tomorrow', r.dueDate, '2026-07-04');

r = ex('Meeting next Monday.');
check('en: next Monday', r.dueDate, '2026-07-06');

r = ex('Please review the attached slides and share feedback.');
check('en: no date -> date null', r.dueDate, null);
check('en: no date -> time null', r.dueTime, null);

// —— 中文 ——
r = ex('请在7月10日下午3点之前提交');
check('zh: 7月10日 date', r.dueDate, '2026-07-10');
check('zh: 7月10日 time', r.dueTime, '15:00');

r = ex('下周五交作业');
check('zh: 下周五', r.dueDate, '2026-07-10');

r = ex('明天上午10点开会');
check('zh: 明天 date', r.dueDate, '2026-07-04');
check('zh: 明天 time', r.dueTime, '10:00');

r = ex('这个项目后天截止');
check('zh: 后天', r.dueDate, '2026-07-05');

r = ex('本周日晚上8点聚餐');
check('zh: 本周日 date', r.dueDate, '2026-07-05');
check('zh: 本周日 time', r.dueTime, '20:00');

r = ex('请于7月20号前提交报销单');
check('zh: 7月20号', r.dueDate, '2026-07-20');

r = ex('这篇文章讲了很多有趣的东西');
check('zh: no date -> date null', r.dueDate, null);
check('zh: no date -> time null', r.dueTime, null);

// —— 关键词偏好:两处日期,选靠近「截止/提交/due」的那个 ——
r = ex('我们7月8日开完会之后,大家要在7月15日之前提交材料。');
check('zh: keyword pref picks 7/15', r.dueDate, '2026-07-15');

r = ex('The kickoff happened already. The final report is due July 21.');
check('en: keyword pref picks 7/21', r.dueDate, '2026-07-21');

// —— 向前解析:比基准日更早的星期几,解析到下一次,绝不回到过去 ——
r = ex('周三之前给我答复');
check('zh: bare 周三 forward', r.dueDate, '2026-07-08');

r = ex('see you on Monday');
check('en: Monday forward', r.dueDate, '2026-07-06');

r = ex('下下周三交终稿');
check('zh: 下下周三', r.dueDate, '2026-07-15');

r = ex('大后天出发');
check('zh: 大后天', r.dueDate, '2026-07-06');

// —— matchedText ——
r = ex('请在7月10日下午3点之前提交');
check('matchedText 非空', r.matchedText !== null, true);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
