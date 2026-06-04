const fs = require('fs');

const files = [
  'src/app/api/packing/outward/session/seal/route.ts',
  'src/app/api/packing/outward/session/cancel/route.ts',
  'src/app/api/packing/outward/scan/route.ts',
  'src/app/packing/scan-outward/page.tsx',
  'src/app/api/packing/outward/session/start/route.ts',
  'src/app/api/packing/outward/session/[sessionId]/route.ts'
];

files.forEach(f => {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    // Replace \` with `
    content = content.replace(/\\`/g, '`');
    // Replace \${ with ${
    content = content.replace(/\\\$\{/g, '${');
    
    fs.writeFileSync(f, content);
    console.log(`Fixed ${f}`);
  }
});
