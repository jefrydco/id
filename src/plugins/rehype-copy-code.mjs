import { visit } from "unist-util-visit";

export default function rehypeCopyCode() {
	return (tree) => {
		visit(tree, "element", (node, index, parent) => {
			if (node.tagName !== "pre") {
				return;
			}

			if (!node.children?.length) {
				return;
			}

			const hasCodeElement = node.children.some(
				(child) => child.tagName === "code",
			);
			if (!hasCodeElement) {
				return;
			}

			node.properties = node.properties || {};
			node.properties.className = node.properties.className || [];
			if (!node.properties.className.includes("copy-code-block")) {
				node.properties.className.push("copy-code-block");
			}

			const copyButton = {
				type: "element",
				tagName: "button",
				properties: {
					className: ["copy-button"],
					type: "button",
					title: "Copy code to clipboard",
					"aria-label": "Copy code to clipboard",
				},
				children: [],
			};

			const wrapper = {
				type: "element",
				tagName: "div",
				properties: {
					className: ["copy-code-wrapper"],
				},
				children: [copyButton, node],
			};

			if (parent && typeof index === "number") {
				parent.children[index] = wrapper;
			}
		});
	};
}
