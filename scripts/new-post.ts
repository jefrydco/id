/**
 * Create a new post with frontmatter
 * Usage: pnpm new <title>
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";

const titleArgs: string[] = process.argv.slice(2);
const rawTitle: string =
	titleArgs.length > 0 ? titleArgs.join(" ") : "new-post";

const isDraft: boolean = rawTitle.startsWith("_");
const displayTitle: string = isDraft ? rawTitle.slice(1) : rawTitle;

const fileName: string = rawTitle
	.toLowerCase()
	.replace(/[^a-z0-9\s-_]/g, "")
	.replace(/\s+/g, "-")
	.replace(/-+/g, "-")
	.replace(/^-|-$/g, "");
const targetFile: string = `${fileName}.md`;
const fullPath: string = join("src/content/posts", targetFile);

if (existsSync(fullPath)) {
	console.error(`😇 File already exists: ${fullPath}`);
	process.exit(1);
}

mkdirSync(dirname(fullPath), { recursive: true });

const content: string = `---
title: '${displayTitle}'
publishedAt: '${new Date().toISOString()}'
---

`;

try {
	writeFileSync(fullPath, content);
	if (isDraft) {
		console.log(`📝 Draft created: ${fullPath}`);
	} else {
		console.log(`✅ Post created: ${fullPath}`);
	}
} catch (error) {
	console.error("⚠️ Failed to create post:", error);
	process.exit(1);
}
