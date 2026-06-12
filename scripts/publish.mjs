import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { parsePost, setFields } from './lib/frontmatter.mjs';
import { buildDevtoPayload, publishToDevto } from './lib/devto.mjs';
import { buildHashnodePayload, publishToHashnode } from './lib/hashnode.mjs';
import { SITE_URL } from './lib/config.mjs';

try { process.loadEnvFile(); } catch { /* no .env — keys may come from the shell */ }

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
const skipPush = args.includes('--skip-push');

if (!slug) {
  console.error('usage: npm run publish-post -- <slug> [--dry-run] [--skip-push]');
  process.exit(1);
}

if (!/^[a-z0-9-]+$/.test(slug)) {
  console.error(`invalid slug "${slug}" — must be lowercase letters, digits, hyphens only`);
  process.exit(1);
}

const file = path.join('src', 'content', 'blog', `${slug}.md`);
const report = [];
const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

let raw = readFileSync(file, 'utf8');

// 1. Flip draft -> published
if (parsePost(raw).data.draft) {
  raw = setFields(raw, { draft: false });
  if (!dryRun) writeFileSync(file, raw);
  report.push(['draft flag', 'flipped to false']);
} else {
  report.push(['draft flag', 'already published (update mode)']);
}

// 2. Build gate + push (canonical home goes live before cross-posts)
if (dryRun) {
  report.push(['site', 'dry-run: skipped build/push']);
} else {
  run('npm run build');
  if (skipPush) {
    report.push(['site', 'build OK, push skipped']);
  } else {
    run(`git add "${file}"`);
    run(`git commit -m "publish: ${slug}"`);
    run('git push');
    report.push(['site', `pushed — deploying to ${SITE_URL}/blog/${slug}/`]);
  }
}

// 3. Cross-posts (each platform isolated; one failure doesn't block others)
const post = parsePost(raw); // pre-cross-post snapshot: drives create-vs-update; raw accumulates ids separately
let wroteIds = false;

if (process.env.DEV_API_KEY) {
  try {
    const payload = buildDevtoPayload(post, slug, SITE_URL);
    if (dryRun) {
      console.log('\n--- dev.to payload ---\n', JSON.stringify(payload, null, 2));
      report.push(['dev.to', 'dry-run: payload printed']);
    } else {
      const { id, url } = await publishToDevto(payload, process.env.DEV_API_KEY, post.data.devtoId);
      raw = setFields(raw, { devtoId: id });
      wroteIds = true;
      report.push(['dev.to', `${post.data.devtoId ? 'updated' : 'created'} ${url}`]);
    }
  } catch (err) {
    report.push(['dev.to', `FAILED — ${err.message}`]);
  }
} else {
  report.push(['dev.to', 'skipped (no DEV_API_KEY)']);
}

if (process.env.HASHNODE_TOKEN && process.env.HASHNODE_PUBLICATION_ID) {
  try {
    const payload = buildHashnodePayload(
      post, slug, SITE_URL, process.env.HASHNODE_PUBLICATION_ID, post.data.hashnodeId
    );
    if (dryRun) {
      console.log('\n--- hashnode payload ---\n', JSON.stringify(payload, null, 2));
      report.push(['hashnode', 'dry-run: payload printed']);
    } else {
      const { id, url } = await publishToHashnode(payload, process.env.HASHNODE_TOKEN, !!post.data.hashnodeId);
      raw = setFields(raw, { hashnodeId: id });
      wroteIds = true;
      report.push(['hashnode', `${post.data.hashnodeId ? 'updated' : 'created'} ${url}`]);
    }
  } catch (err) {
    report.push(['hashnode', `FAILED — ${err.message}`]);
  }
} else {
  report.push(['hashnode', 'skipped (no HASHNODE_TOKEN / HASHNODE_PUBLICATION_ID)']);
}

// 4. Write platform ids back + follow-up commit
if (wroteIds && !dryRun) {
  writeFileSync(file, raw);
  if (!skipPush) {
    run(`git add "${file}"`);
    run(`git commit -m "chore: record platform ids for ${slug}"`);
    run('git push');
  }
  report.push(['platform ids', 'written back to frontmatter']);
}

// 5. Report
console.log('\n=== publish report:', slug, dryRun ? '(dry run) ===' : '===');
for (const [k, v] of report) console.log(`  ${k.padEnd(14)} ${v}`);
console.log('\nMedium + Substack are Chrome-assisted — see the blog-writer skill.');
