import { Platform } from "react-native";
import { Contact, requestPermissionsAsync } from "expo-contacts";

export type PickedContact = {
  name: string;
  phone: string | null;
};

/**
 * Opens the system contact picker and returns name + first phone number.
 * On Android requires READ_CONTACTS; iOS picker does not need prior grant.
 */
export async function pickContactPhone(): Promise<PickedContact | null> {
  if (Platform.OS === "android") {
    const perm = await requestPermissionsAsync();
    if (!perm.granted) {
      throw new Error("CONTACTS_PERMISSION_DENIED");
    }
  }

  const contact = await Contact.presentPicker();
  if (!contact) return null;

  const [fullName, phones] = await Promise.all([
    contact.getFullName().catch(() => null),
    contact.getPhones().catch(() => [] as Awaited<ReturnType<Contact["getPhones"]>>),
  ]);

  const phone =
    phones.find((p) => p.number?.trim())?.number?.trim() ?? null;
  const name = (fullName ?? "").trim();

  return { name, phone };
}
