type Zone = {
    name: string;
    lat: number;
    lng: number;
    radius: number;
};

const zones: Zone[] = [
    { name: "Safe Zone", lat: 13.08, lng: 80.27, radius: 2 },
    { name: "Danger Zone", lat: 13.05, lng: 80.25, radius: 1 }
];

export function checkGeoFence(lat: number, lng: number): string {
    for (const zone of zones) {
        const distance = Math.sqrt(
            Math.pow(lat - zone.lat, 2) + Math.pow(lng - zone.lng, 2)
        );

        if (distance < zone.radius) {
            return zone.name;
        }
    }
    return "Unknown Zone";
}
