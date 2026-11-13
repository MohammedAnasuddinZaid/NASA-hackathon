const fs = require('fs');
const t = fs.readFileSync('next_payload.txt', 'utf8');
const i = t.indexOf('For decades');
const s = Math.max(0, t.lastIndexOf('<p', i - 300));
const seg = t.slice(s, s + 24000);
fs.writeFileSync('challenge_seg.html', seg);
const txt = seg.replace(/<[^>]+>/g, '\n')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'")
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\n{3,}/g, '\n\n');
fs.writeFileSync('challenge_body.txt', txt);
console.log(txt.slice(0, 9000));
