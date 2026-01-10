import { visit } from "unist-util-visit";

export default function rehypeZoomMarker() {
  return (tree) => {
    visit(tree, "element", (node) => {
      if (node.tagName === "mjx-container" && node.properties?.display === "true") {
        node.properties["data-zoom"] = "true";
      }

      if (node.tagName === "div") {
        const className = node.properties?.className;
        const classNames = Array.isArray(className)
          ? className
          : typeof className === "string"
            ? className.split(" ")
            : [];

        if (classNames.includes("mermaid-ssr")) {
          node.properties = node.properties || {};
          node.properties["data-zoom"] = "true";
        }
      }
    });
  };
}
