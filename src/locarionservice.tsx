export async function getCurrentLocation() {
    // Fake GPS simulation
    return new Promise<{ lat: number; lng: number }>((resolve) => {
        setTimeout(() => {
            resolve({
                lat: 13.0827,   // Chennai coords
                lng: 80.2707
            });
        }, 1000);
    });
}
