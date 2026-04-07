import { sendSOSAlert } from "./alertService";
import { getCurrentLocation } from "./locationService";
import { getEmergencyContacts } from "./contactService";

async function main() {
    console.log("🚨 Women Safety App Started");

    const location = await getCurrentLocation();
    const contacts = getEmergencyContacts();

    console.log("📍 Location:", location);
    console.log("📞 Contacts:", contacts);

    sendSOSAlert(location, contacts);
}

main();
