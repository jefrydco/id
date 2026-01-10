// toggle-proxy.ts
// linkCard is always enabled, this script just ensures proxy.ts is active

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const proxyPath = path.resolve(__dirname, "../src/pages/api/proxy.ts");
const backupPath = path.resolve(__dirname, "../src/pages/api/proxy.ts.bak");

// Restore proxy.ts if it was backed up
if (fs.existsSync(backupPath)) {
	fs.renameSync(backupPath, proxyPath);
	console.log("🟢 proxy.ts restored");
}
