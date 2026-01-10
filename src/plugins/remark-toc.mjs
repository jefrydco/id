import { visit } from "unist-util-visit";

export default function remarkTOC() {
	return (tree, file) => {
		const headings = [];
		let headingIndex = 0;
		const usedSlugs = new Set();

		visit(tree, "heading", (node) => {
			const level = node.depth;

			if (level > 6) return;

			if (level === 1 && headingIndex === 0) {
				headingIndex++;
				return;
			}

			const text = extractTextContent(node);
			if (!text) return;

			const slug = generateUniqueSlug(text, usedSlugs);
			const id = slug;

			if (!node.data) node.data = {};
			if (!node.data.hProperties) node.data.hProperties = {};
			node.data.hProperties.id = id;

			headings.push({
				level,
				text,
				id,
				index: headingIndex,
			});

			headingIndex++;
		});

		if (!file.data.astro) file.data.astro = {};
		if (!file.data.astro.frontmatter) file.data.astro.frontmatter = {};
		file.data.astro.frontmatter.toc = headings;
	};
}

function extractTextContent(node) {
	let text = "";

	visit(node, "text", (textNode) => {
		text += textNode.value;
	});

	return text.trim();
}

// Generate a slug from text
function generateSlug(text) {
	return text
		.toLowerCase()
		.replace(/[^\u4e00-\u9fa5a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

// Generate a unique slug from text
function generateUniqueSlug(text, usedSlugs) {
	const slug = generateSlug(text);
	let counter = 1;
	let uniqueSlug = slug;

	while (usedSlugs.has(uniqueSlug)) {
		uniqueSlug = `${slug}-${counter}`;
		counter++;
	}

	usedSlugs.add(uniqueSlug);
	return uniqueSlug;
}
