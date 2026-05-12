import { visit } from "unist-util-visit";

const LINE_THRESHOLD = 20;

export default function rehypeCollapsibleCode() {
	return (tree) => {
		visit(tree, "element", (node) => {
			if (node.tagName !== "div") return;
			const className = node.properties?.className;
			if (!Array.isArray(className)) return;
			if (!className.includes("copy-code-wrapper")) return;

			const pre = node.children?.find(
				(child) => child.type === "element" && child.tagName === "pre",
			);
			if (!pre) return;

			const code = pre.children?.find(
				(child) => child.type === "element" && child.tagName === "code",
			);
			if (!code) return;

			const lineCount = countLines(code);
			if (lineCount <= LINE_THRESHOLD) return;

			node.properties["data-collapsible"] = "true";
			node.properties["data-collapsed"] = "true";
			node.properties["data-line-count"] = String(lineCount);

			const toggle = {
				type: "element",
				tagName: "button",
				properties: {
					className: ["code-toggle"],
					type: "button",
					"aria-expanded": "false",
					"aria-label": `Show full code, ${lineCount} lines`,
					title: `Show full code, ${lineCount} lines`,
					"data-line-count": String(lineCount),
				},
				children: [
					{
						type: "element",
						tagName: "span",
						properties: {
							className: ["toggle-icon-slot"],
							"aria-hidden": "true",
						},
						children: [],
					},
				],
			};

			node.children.push(toggle);
		});
	};
}

function countLines(code) {
	let count = 0;
	for (const child of code.children || []) {
		if (
			child.type === "element" &&
			child.tagName === "span" &&
			Array.isArray(child.properties?.className) &&
			child.properties.className.includes("line")
		) {
			count += 1;
		}
	}
	if (count === 0) {
		const text = extractText(code);
		count = text.split("\n").filter((line) => line.length > 0).length;
	}
	return count;
}

function extractText(node) {
	if (node.type === "text") return node.value || "";
	if (!node.children) return "";
	return node.children.map(extractText).join("");
}
