#!/usr/bin/env node
// Simple in-repo maintenance agent for Music-Era
// Usage:
//   node agents/agent.js scan        # run checks and show issues
//   node agents/agent.js fix         # create missing folders/files (safe fixes)
//   node agents/agent.js fix --apply # apply some non-destructive fixes (truncate HTML after </html> and save removed tail to agents/fixes/)

const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const publicDir = path.join(repoRoot, 'public');
const dataDir = path.join(repoRoot, 'data');
const songsDir = path.join(publicDir, 'songs');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('Created', dir);
    return true;
  }
  return false;
}

function checkServerDomUsage() {
  const serverPath = path.join(repoRoot, 'server.js');
  if (!fs.existsSync(serverPath)) return [];
  const src = fs.readFileSync(serverPath, 'utf8');
  const lines = src.split(/\r?\n/);
  const issues = [];
  lines.forEach((l, i) => {
    if (/document\.|window\.|getElementById\(/.test(l)) {
      issues.push({ file: 'server.js', line: i+1, text: l.trim() });
    }
  });
  return issues;
}

function findHtmlTails(folder) {
  const htmlFiles = [];
  const files = fs.readdirSync(folder);
  files.forEach(f => {
    const p = path.join(folder, f);
    const stat = fs.statSync(p);
    if (stat.isFile() && f.endsWith('.html')) htmlFiles.push(p);
    if (stat.isDirectory()) {
      // shallow: do one level
      const nested = fs.readdirSync(p).filter(x => x.endsWith('.html')).map(x => path.join(p, x));
      htmlFiles.push(...nested);
    }
  });
  const results = [];
  htmlFiles.forEach(file => {
    const src = fs.readFileSync(file, 'utf8');
    const last = src.lastIndexOf('</html>');
    if (last !== -1 && last + 7 < src.length) {
      const tail = src.slice(last + 7).trim();
      if (tail.length > 0) {
        results.push({ file, tailPreview: tail.slice(0,200) });
      }
    }
    if (last === -1) {
      results.push({ file, error: 'No </html> tag found' });
    }
  });
  return results;
}

function scan() {
  console.log('Running Music-Era agent scan...');
  ensureDir(dataDir); // non-destructive
  ensureDir(publicDir);

  const serverIssues = checkServerDomUsage();
  if (serverIssues.length) {
    console.log('\nFound DOM usage in server.js (remove client DOM code from server):');
    serverIssues.forEach(i => console.log(` - ${i.file}:${i.line} -> ${i.text}`));
  } else {
    console.log('\nNo server DOM usage detected.');
  }

  const htmlTails = findHtmlTails(repoRoot).concat(findHtmlTails(publicDir));
  if (htmlTails.length) {
    console.log('\nHTML trailing-content issues:');
    htmlTails.forEach(h => {
      if (h.error) console.log(` - ${h.file}: ${h.error}`);
      else console.log(` - ${h.file}: trailing content detected (preview: ${JSON.stringify(h.tailPreview)})`);
    });
  } else {
    console.log('\nNo trailing HTML content found.');
  }

  if (!fs.existsSync(songsDir)) console.log('\npublic/songs directory is missing (uploads may fail).');
  else console.log('\npublic/songs exists.');

  console.log('\nScan complete. Use `node agents/agent.js fix --apply` to apply safe fixes.');
}

function applySafeFixes() {
  console.log('Applying safe fixes...');
  ensureDir(dataDir);
  ensureDir(publicDir);
  ensureDir(songsDir);
  // Fix HTML tails by truncating after last </html> and saving tail to agents/fixes
  const fixesDir = path.join(__dirname, 'fixes');
  ensureDir(fixesDir);
  const htmlFiles = fs.readdirSync(repoRoot).filter(f => f.endsWith('.html')).map(f => path.join(repoRoot, f));
  htmlFiles.push(...(fs.existsSync(publicDir) ? fs.readdirSync(publicDir).filter(f => f.endsWith('.html')).map(f => path.join(publicDir, f)) : []));
  htmlFiles.forEach(file => {
    const src = fs.readFileSync(file, 'utf8');
    const last = src.lastIndexOf('</html>');
    if (last !== -1 && last + 7 < src.length) {
      const tail = src.slice(last + 7);
      const fixFile = path.join(fixesDir, path.basename(file) + '.tail.txt');
      fs.writeFileSync(fixFile, tail, 'utf8');
      const newContent = src.slice(0, last + 7);
      fs.writeFileSync(file, newContent, 'utf8');
      console.log(`Fixed trailing content in ${file} -> saved tail to ${fixFile}`);
    }
  });
  console.log('Safe fixes applied.');
}

function fix(argv) {
  const apply = argv.includes('--apply');
  if (apply) applySafeFixes();
  else {
    ensureDir(dataDir);
    ensureDir(publicDir);
    ensureDir(songsDir);
    console.log('Created missing folders (data, public, public/songs). Use --apply to also truncate HTML tails and save backups under agents/fixes.');
  }
}

function help() {
  console.log('Music-Era in-repo agent');
  console.log('Commands:');
  console.log('  scan          Show issues found in the repo (DOM in server, trailing HTML, missing folders)');
  console.log('  fix [--apply] Create missing folders/files; with --apply also truncate trailing HTML tails and save backups under agents/fixes');
}

function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (!cmd || cmd === 'help') return help();
  if (cmd === 'scan') return scan();
  if (cmd === 'fix') return fix(argv.slice(1));
  return help();
}

main();
