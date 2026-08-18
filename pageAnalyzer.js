// 注入到当前页面执行的分析函数。
// 注意:此函数会被 chrome.scripting.executeScript({func}) 序列化后注入,
// 因此必须完全自包含 —— 所有辅助函数都声明在函数体内部,不引用外部标识符。
function analyzePage() {
  const cap = (s, n) => (s && s.length > n ? s.slice(0, n) : s);

  const cleanTitle = (t) =>
    (t || '')
      .replace(/^\(\d+\)\s*/, '') // "(7) Some Video" — unread-count prefix some sites add
      .replace(/\s*[-|–—·]\s*(YouTube|Bilibili|哔哩哔哩[^-|]*|Medium|Google Docs|Google 文档|知乎[^-|]*|Notion)\s*$/i, '')
      .trim();

  const selRaw = window.getSelection ? String(window.getSelection()).trim() : '';
  const selectionText = selRaw ? cap(selRaw, 2000) : null;

  const base = {
    kind: 'page',
    title: cleanTitle(document.title),
    url: location.href,
    siteName: location.hostname.replace(/^www\./, ''),
    videoMinutes: null,
    emailSubject: null,
    emailSender: null,
    bodyText: null,
    selectionText,
  };

  // 0) PDF:Chrome 内置查看器不向扩展暴露正文,只能尽力用文件名当标题
  if (
    (document.contentType || '').toLowerCase() === 'application/pdf' ||
    location.pathname.toLowerCase().endsWith('.pdf')
  ) {
    let name = '';
    try {
      name = decodeURIComponent(location.pathname.split('/').pop() || '');
    } catch (e) {
      name = location.pathname.split('/').pop() || '';
    }
    name = name.replace(/\.pdf$/i, '').replace(/[_\-+]+/g, ' ').replace(/\s+/g, ' ').trim();
    return Object.assign(base, { kind: 'pdf', title: base.title || name });
  }

  // 1) Gmail:打开的邮件
  if (location.hostname === 'mail.google.com') {
    const subjEl = document.querySelector('h2.hP');
    if (subjEl) {
      const subject = subjEl.textContent.trim();
      // Read EVERY visible message in the thread — the date is often in an
      // earlier message ("July 7th at 5pm works!") while the last one is just
      // "See you then".
      const visibleBodies = Array.from(document.querySelectorAll('div.a3s')).filter(
        (el) => el.offsetParent !== null
      );
      const sources = visibleBodies.length
        ? visibleBodies
        : Array.from(document.querySelectorAll('div.a3s'));
      const senderEl = document.querySelector('span.gD');
      const sender = senderEl
        ? senderEl.getAttribute('email') || senderEl.textContent.trim() || null
        : null;
      const body = sources
        .map((el) => (el.innerText || el.textContent || '').trim())
        .filter(Boolean)
        .join('\n— — —\n');
      return Object.assign(base, {
        kind: 'email',
        title: subject || base.title,
        emailSubject: subject || null,
        emailSender: sender,
        bodyText: cap(subject + '\n' + body, 6000),
      });
    }
  }

  // 2) 视频:优先读 <video> 元素时长,其次 YouTube 的 meta/播放器时长
  let seconds = 0;
  for (const v of document.querySelectorAll('video')) {
    if (Number.isFinite(v.duration) && v.duration > seconds) seconds = v.duration;
  }
  if (!(seconds > 60)) {
    const meta = document.querySelector('meta[itemprop="duration"]');
    if (meta) {
      const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/.exec(meta.getAttribute('content') || '');
      if (m) seconds = (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
    }
  }
  if (!(seconds > 60)) {
    const el = document.querySelector('.ytp-time-duration');
    if (el) {
      const parts = el.textContent.trim().split(':').map(Number);
      if (parts.length >= 2 && parts.every((n) => Number.isFinite(n))) {
        seconds = parts.reduce((acc, n) => acc * 60 + n, 0);
      }
    }
  }
  if (seconds > 60) {
    return Object.assign(base, { kind: 'video', videoMinutes: Math.ceil(seconds / 60) });
  }

  // 3) 正文:喂给 AI 和本地规则
  const root = document.querySelector('article') || document.querySelector('main');
  let text = '';
  if (root) {
    text = root.innerText || root.textContent || '';
  } else if (document.body) {
    const clone = document.body.cloneNode(true);
    clone
      .querySelectorAll('script,style,nav,header,footer,aside,iframe,noscript')
      .forEach((el) => el.remove());
    text = clone.textContent || '';
  }
  // 页面正文喂给 AI/本地规则(此前只有 Gmail 会填 bodyText,
  // 导致普通页面上 AI 永远没有输入,只能靠用户先选中文字)
  const pageText = text
    .replace(/[ \t ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  base.bodyText = pageText ? cap(pageText, 6000) : null;

  // 3) 普通网页。早期按字数把长页面标成「文章」,可活动页、表单、后台
  // 也都很长,标签反而误导;现在一律叫 Page。
  return base;
}
