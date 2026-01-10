import { visit } from "unist-util-visit";

function createDownloadWrapper(contentNode) {
	const downloadButton = {
		type: "element",
		tagName: "button",
		properties: {
			className: ["download-button", "image-download"],
			type: "button",
			title: "Download image",
			"aria-label": "Download image",
		},
		children: [],
	};

	return {
		type: "element",
		tagName: "div",
		properties: {
			className: ["download-image-wrapper"],
		},
		children: [downloadButton, contentNode],
	};
}

export default function rehypeImageProcessor() {
	return (tree) => {
		visit(tree, "element", (node, index, parent) => {
			if (node.tagName !== "p") {
				return;
			}
			if (!parent || typeof index !== "number") {
				return;
			}

			const imgNodes = [];
			let hasNonImageContent = false;

			for (const child of node.children) {
				if (child.type === "element" && child.tagName === "img") {
					imgNodes.push(child);
				} else if (child.type !== "text" || child.value.trim() !== "") {
					hasNonImageContent = true;
				}
			}

			if (hasNonImageContent || imgNodes.length === 0) {
				return;
			}

			const newNodes = [];

			for (const imgNode of imgNodes) {
				const alt = imgNode.properties?.alt?.trim();

				imgNode.properties = {
					...imgNode.properties,
					"data-preview": "true",
					loading: "lazy",
					decoding: "async",
					fetchpriority: newNodes.length === 0 ? "high" : "auto",
					class: [...(imgNode.properties.class || []), "img-placeholder"],
				};

				if (!alt || alt.includes("_")) {
					newNodes.push(createDownloadWrapper(imgNode));
					continue;
				}

				const figure = {
					type: "element",
					tagName: "figure",
					properties: {
						className: ["image-caption-wrapper"],
					},
					children: [
						imgNode,
						{
							type: "element",
							tagName: "figcaption",
							properties: {
								className: ["img-caption"],
							},
							children: [
								{
									type: "text",
									value: alt,
								},
							],
						},
					],
				};

				newNodes.push(createDownloadWrapper(figure));
			}

			if (newNodes.length > 0) {
				parent.children.splice(index, 1, ...newNodes);
				return index + newNodes.length - 1;
			}
		});
	};
}
