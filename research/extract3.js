const fs = require('fs');
const html = fs.readFileSync('challenge.html', 'utf8');
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let bodies = [];
for (const s of scripts) {
  const re = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    try {
      const str = JSON.parse(m[1]);
      if (str.includes('For decades') || str.includes('Background')) bodies.push(str);
    } catch (e) { /* ignore */ }
  }
}
console.error('matched bodies:', bodies.length);
let body = bodies.join('\n');
if (!body) {
  // fallback: raw slice between markers
  const i = html.indexOf('For decades');
  const start = html.lastIndexOf('self.__next_f.push([1,', i);
  const end = html.indexOf('</script>', i);
  const raw = html.slice(start + 'self.__next_f.push([1,'.length, end).replace(/\)\s*$/, '');
  try {
    body = JSON.parse(JSON.parse(raw));
  } catch (e) {
    body = raw.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\n/g, '\n').replace(/\\"/g, '"');
  }
}
fs.writeFileSync('challenge_seg.html', body);
const text = body.replace(/<script[\s\S]*?<\/script>/g, ' ')
  .replace(/<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<[^>]+>/g, '\n')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'")
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\n{3,}/g, '\n\n');
fs.writeFileSync('challenge_body.txt', text);
console.log(text.slice(0, 10000));
