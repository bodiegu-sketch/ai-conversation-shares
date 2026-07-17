const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const contentDir = path.join(root, "content");
const publicDir = path.join(root, "public");
const postsDir = path.join(publicDir, "posts");
const assetsDir = path.join(root, "assets");
const publicAssetsDir = path.join(publicDir, "assets");

fs.mkdirSync(postsDir, { recursive: true });

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

copyDir(assetsDir, publicAssetsDir);

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function slugFromFile(file) {
  return path.basename(file, ".md");
}

function parseFrontMatter(raw) {
  if (!raw.startsWith("---\n")) return [{}, raw];
  const end = raw.indexOf("\n---\n", 4);
  if (end === -1) return [{}, raw];
  const fm = raw.slice(4, end).trim();
  const body = raw.slice(end + 5).trim();
  const data = {};
  for (const line of fm.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    data[key] = value;
  }
  return [data, body];
}

function inlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function renderMarkdown(md) {
  const lines = md.split(/\r?\n/);
  let html = "";
  let inCode = false;
  let code = [];
  let inTable = false;
  let tableRows = [];
  let inList = false;
  let paragraph = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    html += `<p>${inlineMarkdown(paragraph.join(" "))}</p>\n`;
    paragraph = [];
  }

  function flushList() {
    if (!inList) return;
    html += "</ul>\n";
    inList = false;
  }

  function flushTable() {
    if (!inTable) return;
    const rows = tableRows.filter((row) => !/^\s*\|?\s*:?-{3,}:?\s*\|/.test(row));
    if (rows.length) {
      html += "<table>\n";
      rows.forEach((row, index) => {
        const cells = row
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((cell) => inlineMarkdown(cell.trim()));
        html += index === 0 ? "<thead><tr>" : "<tbody><tr>";
        html += cells.map((cell) => index === 0 ? `<th>${cell}</th>` : `<td>${cell}</td>`).join("");
        html += index === 0 ? "</tr></thead>\n" : "</tr></tbody>\n";
      });
      html += "</table>\n";
    }
    tableRows = [];
    inTable = false;
  }

  for (const line of lines) {
    if (line.startsWith("```")) {
      flushParagraph();
      flushList();
      flushTable();
      if (inCode) {
        html += `<pre><code>${escapeHtml(code.join("\n"))}</code></pre>\n`;
        code = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      code.push(line);
      continue;
    }

    if (/^\|.+\|$/.test(line.trim())) {
      flushParagraph();
      flushList();
      inTable = true;
      tableRows.push(line);
      continue;
    } else {
      flushTable();
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      html += `<h2>${inlineMarkdown(line.slice(3).trim())}</h2>\n`;
      continue;
    }

    if (line.startsWith("# ")) {
      flushParagraph();
      flushList();
      html += `<h1>${inlineMarkdown(line.slice(2).trim())}</h1>\n`;
      continue;
    }

    if (line.startsWith("> ")) {
      flushParagraph();
      flushList();
      html += `<blockquote>${inlineMarkdown(line.slice(2).trim())}</blockquote>\n`;
      continue;
    }

    if (line.startsWith("- ")) {
      flushParagraph();
      if (!inList) {
        html += "<ul>\n";
        inList = true;
      }
      html += `<li>${inlineMarkdown(line.slice(2).trim())}</li>\n`;
      continue;
    }

    const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) {
      flushParagraph();
      flushList();
      html += `<figure><img src="${escapeHtml(image[2])}" alt="${escapeHtml(image[1])}"></figure>\n`;
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  flushTable();
  return html;
}

function layout({ title, body, meta = "", description = "" }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="stylesheet" href="/ai-conversation-shares/styles.css">
</head>
<body>
  <header class="site-header">
    <div class="site-header-inner">
      <h1 class="site-title">AI Conversation Shares</h1>
      <p class="site-subtitle">可公开分享的 AI 对话、研究框架和 Prompt 模板。</p>
    </div>
  </header>
  <main class="container">
    ${body}
    <p class="footer">Generated from Markdown. Research notes only, not investment advice.</p>
  </main>
</body>
</html>`;
}

const posts = fs
  .readdirSync(contentDir)
  .filter((file) => file.endsWith(".md"))
  .sort()
  .reverse()
  .map((file) => {
    const raw = fs.readFileSync(path.join(contentDir, file), "utf8");
    const [frontMatter, body] = parseFrontMatter(raw);
    const slug = slugFromFile(file);
    const post = {
      slug,
      title: frontMatter.title || slug,
      date: frontMatter.date || "",
      tags: frontMatter.tags || "",
      summary: frontMatter.summary || "",
      html: renderMarkdown(body),
    };
    const page = layout({
      title: post.title,
      description: post.summary,
      body: `<article class="post">
  <h1>${escapeHtml(post.title)}</h1>
  <div class="meta">${escapeHtml(post.date)} · ${escapeHtml(post.tags)}</div>
  ${post.html}
</article>`,
    });
    fs.writeFileSync(path.join(postsDir, `${slug}.html`), page);
    return post;
  });

const list = posts
  .map((post) => `<article class="post-card">
  <h2><a href="/ai-conversation-shares/posts/${post.slug}.html">${escapeHtml(post.title)}</a></h2>
  <div class="meta">${escapeHtml(post.date)} · ${escapeHtml(post.tags)}</div>
  <p class="summary">${escapeHtml(post.summary)}</p>
</article>`)
  .join("\n");

fs.writeFileSync(
  path.join(publicDir, "index.html"),
  layout({
    title: "AI Conversation Shares",
    description: "可公开分享的 AI 对话、研究框架和 Prompt 模板。",
    body: `<section class="post-list">${list}</section>`,
  })
);

console.log(`Built ${posts.length} post(s).`);
