const fs = require('fs');
const html = fs.readFileSync('challenge.html', 'utf8');
const re = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g;
let m, parts = [];
while ((m = re.exec(html)) !== null) {
  try { parts.push(JSON.parse(m[1])); } catch (e) {}
}
const joined = parts.join('\n');
fs.writeFileSync('next_payload.txt', joined);
// Find the challenge body: search for "For decades" and take surrounding HTML
const idx = joined.indexOf('For decades');
const start = joined.lastIndexOf('<p', idx - 200);
let seg = joined.slice(Math.max(0, start), idx + 20000);
// strip tags
let text = seg.replace(/<script[\s\S]*?<\/script>/g, ' ')
  .replace(/<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<[^>]+>/g, '\n')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'")
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\n{3,}/g, '\n\n');
fs.writeFileSync('challenge_body.txt', text);
console.log('payload bytes', joined.length, 'body bytes', text.length);
console.log(text.slice(0, 6000));
