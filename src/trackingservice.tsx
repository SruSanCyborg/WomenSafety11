import { getCurrentLocation } from "./locarionservice";

export async function startLiveTracking(interval: number = 3000) {
    console.log("📡 Live tracking started...");

    setInterval(async () => {
        const loc = await getCurrentLocation();
        console.log(`📍 Tracking update: ${loc.lat}, ${loc.lng}`);
    }, interval);
}
