// Fetches the Climb Safe page from the Notion API and writes src/data/content.json.
// Requires NOTION_TOKEN (Notion integration secret) and NOTION_PAGE_ID.
// Images hosted by Notion are downloaded into public/notion/.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';
const PAGE_ID = process.env.NOTION_PAGE_ID || '3e157aa7f94f8076a8fce2abbc43b9a1';
const TOKEN = process.env.NOTION_TOKEN;

if (!TOKEN) {
  console.warn('NOTION_TOKEN not set; keeping the committed content snapshot.');
  process.exit(0);
}

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  'Notion-Version': NOTION_VERSION,
};

async function api(endpoint) {
  const res = await fetch(`${API}${endpoint}`, { headers });
  if (!res.ok) {
    throw new Error(`Notion API ${endpoint} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

function ytId(url) {
  const m = String(url).match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{6,})/
  );
  return m ? m[1] : null;
}

function richTextToHtml(richText) {
  return (richText || [])
    .map((rt) => {
      let text = (rt.plain_text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
      if (rt.annotations?.code) text = `<code>${text}</code>`;
      if (rt.annotations?.italic) text = `<em>${text}</em>`;
      if (rt.annotations?.bold) text = `<strong>${text}</strong>`;
      if (rt.href || rt.text?.link?.url) {
        const href = rt.href || rt.text.link.url;
        text = `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
      }
      return text;
    })
    .join('');
}

async function downloadNotionFile(url, blockId) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') || '';
  const nameParam = new URL(url).searchParams.get('name') || '';
  const extFromName = path.extname(nameParam).replace(/[^.\w]/g, '');
  const ext =
    extFromName ||
    ({ 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' }[
      contentType
    ] || '.png');
  const filename = `${blockId}${ext}`;
  await writeFile(path.join('public', 'notion', filename), buffer);
  return `notion/${filename}`;
}

async function convertImage(block) {
  const image = block.image;
  const alt = richTextToHtml(image.caption).replace(/<[^>]+>/g, '') || 'Notion image';
  if (image.type === 'external') {
    return { type: 'image', src: image.external.url, alt };
  }
  const src = await downloadNotionFile(image.file.url, block.id);
  return { type: 'image', src, alt };
}

function convertBlock(block) {
  const t = block.type;
  if (t === 'paragraph' || t === 'quote') {
    return { type: t === 'quote' ? 'quote' : 'paragraph', html: richTextToHtml(block[t].rich_text) };
  }
  if (t === 'callout') {
    return {
      type: 'callout',
      icon: block[t].icon?.emoji || '💡',
      html: richTextToHtml(block[t].rich_text),
    };
  }
  if (t === 'heading_1' || t === 'heading_2' || t === 'heading_3') {
    return { type: 'heading', level: Number(t.slice(-1)), html: richTextToHtml(block[t].rich_text) };
  }
  if (t === 'bulleted_list_item' || t === 'numbered_list_item') {
    return {
      type: 'listItem',
      ordered: t === 'numbered_list_item',
      html: richTextToHtml(block[t].rich_text),
    };
  }
  if (t === 'divider') {
    return { type: 'divider' };
  }
  if (t === 'image') {
    return convertImage(block);
  }
  if (t === 'embed' || t === 'bookmark' || t === 'video' || t === 'link_preview') {
    const data = block[t];
    const url = data?.url || data?.external?.url || data?.file?.url;
    if (!url) {
      console.warn(
        `Skipping ${t} block with no resolvable URL: ${JSON.stringify(block)}`
      );
      return null;
    }
    return { type: 'video', url, embedId: ytId(url) };
  }
  return null;
}

async function fetchBlocks(blockId, out) {
  let cursor;
  do {
    const data = await api(`/blocks/${blockId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`);
    for (const block of data.results) {
      const converted = await convertBlock(block);
      if (converted) out.push(converted);
      if (block.has_children) {
        await fetchBlocks(block.id, out);
      }
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
}

async function main() {
  await mkdir(path.join('public', 'notion'), { recursive: true });
  const page = await api(`/pages/${PAGE_ID}`);
  const title =
    Object.values(page.properties).find((p) => p.type === 'title')?.title?.map((t) => t.plain_text).join('') ||
    'Climb Safe';
  const blocks = [];
  await fetchBlocks(PAGE_ID, blocks);
  const content = {
    title,
    icon: page.icon?.emoji || '',
    source: page.url,
    blocks,
  };
  await writeFile('src/data/content.json', JSON.stringify(content, null, 2) + '\n');
  console.log(`Fetched ${blocks.length} blocks from Notion page "${title}".`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
