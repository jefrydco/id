/**
 * rehype-mathjax4.mjs
 * Custom rehype plugin for MathJax 4 with @mathjax/src
 *
 * Renders elements with `math-inline` or `math-display` classes
 * (from remark-math) to SVG using MathJax 4.
 */

import { toText } from "hast-util-to-text";
import { SKIP, visitParents } from "unist-util-visit-parents";
import { h } from "hastscript";

// MathJax 4 imports
import { mathjax } from "@mathjax/src/js/mathjax.js";
import { TeX } from "@mathjax/src/js/input/tex.js";
import { SVG } from "@mathjax/src/js/output/svg.js";
import { liteAdaptor } from "@mathjax/src/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "@mathjax/src/js/handlers/html.js";

// Async loader for ESM
import "@mathjax/src/js/util/asyncLoad/esm.js";

// TeX packages - load commonly used ones
// Base is always required
import "@mathjax/src/js/input/tex/base/BaseConfiguration.js";
// AMS packages for common math environments
import "@mathjax/src/js/input/tex/ams/AmsConfiguration.js";
// Support for \newcommand, \def, etc.
import "@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js";
// Don't show undefined control sequences as errors
import "@mathjax/src/js/input/tex/noundefined/NoUndefinedConfiguration.js";
// Additional useful packages
import "@mathjax/src/js/input/tex/boldsymbol/BoldsymbolConfiguration.js";
import "@mathjax/src/js/input/tex/braket/BraketConfiguration.js";
import "@mathjax/src/js/input/tex/cancel/CancelConfiguration.js";
import "@mathjax/src/js/input/tex/color/ColorConfiguration.js";
import "@mathjax/src/js/input/tex/configmacros/ConfigMacrosConfiguration.js";
import "@mathjax/src/js/input/tex/enclose/EncloseConfiguration.js";
import "@mathjax/src/js/input/tex/extpfeil/ExtpfeilConfiguration.js";
import "@mathjax/src/js/input/tex/html/HtmlConfiguration.js";
import "@mathjax/src/js/input/tex/mhchem/MhchemConfiguration.js";
import "@mathjax/src/js/input/tex/physics/PhysicsConfiguration.js";
import "@mathjax/src/js/input/tex/textmacros/TextMacrosConfiguration.js";
import "@mathjax/src/js/input/tex/unicode/UnicodeConfiguration.js";

// Default configuration
const DEFAULT_OPTIONS = {
	svg: {
		fontCache: "local",
		scale: 1,
	},
	tex: {
		packages: [
			"base",
			"ams",
			"newcommand",
			"noundefined",
			"boldsymbol",
			"braket",
			"cancel",
			"color",
			"configmacros",
			"enclose",
			"extpfeil",
			"html",
			"mhchem",
			"physics",
			"textmacros",
			"unicode",
		],
	},
};

/**
 * Convert LiteElement to hast Element
 */
function fromLiteElement(liteElement) {
	const children = [];

	for (const node of liteElement.children) {
		children.push(
			"value" in node
				? { type: "text", value: node.value }
				: fromLiteElement(node),
		);
	}

	return h(liteElement.kind, liteElement.attributes, children);
}

/**
 * Create the MathJax renderer
 */
function createRenderer(options) {
	const mergedOptions = {
		svg: { ...DEFAULT_OPTIONS.svg, ...options.svg },
		tex: { ...DEFAULT_OPTIONS.tex, ...options.tex },
	};

	const input = new TeX(mergedOptions.tex);
	const output = new SVG(mergedOptions.svg);

	let document;
	let handler;

	return {
		register() {
			const adaptor = liteAdaptor();
			handler = RegisterHTMLHandler(adaptor);
			document = mathjax.document("", { InputJax: input, OutputJax: output });
		},

		render(value, renderOptions) {
			const liteElement = document.convert(value, renderOptions);
			return [fromLiteElement(liteElement)];
		},

		styleSheet() {
			const node = fromLiteElement(output.styleSheet(document));
			// Remove the id that MathJax adds
			node.properties.id = undefined;
			return node;
		},

		unregister() {
			mathjax.handlers.unregister(handler);
		},
	};
}

/**
 * rehype plugin for MathJax 4 SVG rendering
 */
export default function rehypeMathJax4(options = {}) {
	return function (tree, file) {
		const renderer = createRenderer(options);
		let found = false;
		let context = tree;
		const emptyClasses = [];

		renderer.register();

		visitParents(tree, "element", function (element, parents) {
			const classes = Array.isArray(element.properties.className)
				? element.properties.className
				: emptyClasses;

			// Classes set by remark-math
			const languageMath = classes.includes("language-math");
			const mathDisplay = classes.includes("math-display");
			const mathInline = classes.includes("math-inline");
			let display = mathDisplay;

			// Track <head> for stylesheet insertion
			if (element.tagName === "head") {
				context = element;
			}

			// Skip if not a math element
			if (!languageMath && !mathDisplay && !mathInline) {
				return;
			}

			let parent = parents[parents.length - 1];
			let scope = element;

			// Handle ```math code blocks
			if (
				element.tagName === "code" &&
				languageMath &&
				parent &&
				parent.type === "element" &&
				parent.tagName === "pre"
			) {
				scope = parent;
				parent = parents[parents.length - 2];
				display = true;
			}

			if (!parent) return;

			found = true;

			// Extract text content
			const text = toText(scope, { whitespace: "pre" });
			let result;

			try {
				result = renderer.render(text, { display });
			} catch (error) {
				const cause = error;

				file.message("Could not render math with MathJax", {
					ancestors: [...parents, element],
					cause,
					place: element.position,
					ruleId: "mathjax-error",
					source: "rehype-mathjax4",
				});

				// Error fallback
				result = [
					{
						type: "element",
						tagName: "span",
						properties: {
							className: ["mathjax-error"],
							style: "color:#cc0000",
							title: String(cause),
						},
						children: [{ type: "text", value: text }],
					},
				];
			}

			// Replace the original element with rendered result
			const index = parent.children.indexOf(scope);
			parent.children.splice(index, 1, ...result);
			return SKIP;
		});

		if (found) {
			if (renderer.styleSheet) {
				context.children.push(renderer.styleSheet());
			}
			if (renderer.unregister) {
				renderer.unregister();
			}
		}
	};
}
