import { visit } from "unist-util-visit";

export default function rehypeMathDownload() {
	return (tree) => {
		visit(tree, "element", (node, index, parent) => {
			if (node.tagName !== "mjx-container") return;
			if (node.properties?.display !== "true") return;

			node.properties = node.properties || {};
			node.properties.className = node.properties.className || [];
			if (!node.properties.className.includes("download-math-block")) {
				node.properties.className.push("download-math-block");
			}

			const downloadButton = {
				type: "element",
				tagName: "button",
				properties: {
					className: ["download-button"],
					type: "button",
					title: "Download equation as image",
					"aria-label": "Download equation as image",
				},
				children: [],
			};

			const wrapper = {
				type: "element",
				tagName: "div",
				properties: {
					className: ["download-math-wrapper"],
				},
				children: [downloadButton, node],
			};

			if (parent && typeof index === "number") {
				parent.children[index] = wrapper;
			}
		});
	};
}
