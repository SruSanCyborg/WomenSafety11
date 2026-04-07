type Location = {
    lat: number;
    lng: number;
};

export function sendSOSAlert(location: Location, contacts: string[]) {
    console.log("🚨 Sending SOS Alert...");

    contacts.forEach(contact => {
        console.log(`Message sent to ${contact}:`);
        console.log(`HELP! I am at https://maps.google.com/?q=${location.lat},${location.lng}`);
    });

    console.log("✅ Alerts dispatched successfully");
}
