import { registerSW } from "virtual:pwa-register";

registerSW({
	immediate: true,
	onRegisteredSW(swScriptUrl) {
		console.log("SW registered:", swScriptUrl);
	},
	onOfflineReady() {
		console.log("PWA ready for offline use");
	},
});
