type Location = {
    lat: number;
    lng: number;
};

export function analyzeRisk(location: Location): string {
    // Fake AI-based risk detection
    const riskZones = [
        { lat: 13.0827, lng: 80.2707, risk: "HIGH" },
        { lat: 13.05, lng: 80.25, risk: "MEDIUM" }
    ];

    const match = riskZones.find(
        z => Math.abs(z.lat - location.lat) < 0.05 &&
             Math.abs(z.lng - location.lng) < 0.05
    );

    return match ? match.risk : "LOW";
}
