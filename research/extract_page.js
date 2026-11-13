const fs = require('fs');
const file = process.argv[2];
const html = fs.readFileSync(file, 'utf8');
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const parts = [];
for (const s of scripts) {
  const re = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    try { parts.push(JSON.parse(m[1])); } catch (e) {}
  }
}
let text = parts.join('\n');
// strip RSC metadata lines and HTML
text = text.replace(/<script[\s\S]*?<\/script>/g, ' ')
  .replace(/<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<[^>]+>/g, '\n')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'")
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\n{3,}/g, '\n\n');
// keep only readable prose lines
const lines = text.split('\n').map(s => s.trim()).filter(s => s.length > 3 && /[a-zA-Z]/.test(s) && !s.startsWith('self.__next') && !/^\d+:I\[/.test(s) && !/^\d+:\$/.test(s));
const out = [...new Set(lines)].join('\n');
console.log(out.slice(0, 12000));
