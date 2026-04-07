import { sendSOSAlert } from "./alertservice";
import { getCurrentLocation } from "./locarionservice";
import { getEmergencyContacts } from "./contactservice";

async function main() {
    console.log("🚨 Women Safety App Started");

    const location = await getCurrentLocation();
    const contacts = getEmergencyContacts();

    console.log("📍 Location:", location);
    console.log("📞 Contacts:", contacts);

    sendSOSAlert(location, contacts);
}

main();
