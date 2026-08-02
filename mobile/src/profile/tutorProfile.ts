import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";

const PROFILE_KEY = "tutor.profile.v1";
const PROFILE_DIR = `${FileSystem.documentDirectory ?? ""}tutor-profile/`;

export type TutorProfile = {
  name: string;
  profileUri: string | null;
  setupCompletedAt: string | null;
};

const EMPTY: TutorProfile = {
  name: "",
  profileUri: null,
  setupCompletedAt: null,
};

export async function loadTutorProfile(): Promise<TutorProfile> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<TutorProfile>;
    return {
      name: typeof parsed.name === "string" ? parsed.name : "",
      profileUri:
        typeof parsed.profileUri === "string" ? parsed.profileUri : null,
      setupCompletedAt:
        typeof parsed.setupCompletedAt === "string"
          ? parsed.setupCompletedAt
          : null,
    };
  } catch {
    return { ...EMPTY };
  }
}

export async function saveTutorProfile(
  input: Omit<TutorProfile, "setupCompletedAt"> & {
    setupCompletedAt?: string | null;
  }
): Promise<TutorProfile> {
  const current = await loadTutorProfile();
  const next: TutorProfile = {
    name: input.name.trim(),
    profileUri: input.profileUri,
    // Preserve null until markSetupComplete / explicit timestamp
    setupCompletedAt:
      input.setupCompletedAt !== undefined
        ? input.setupCompletedAt
        : current.setupCompletedAt,
  };
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  return next;
}

export async function markSetupComplete(
  input: Omit<TutorProfile, "setupCompletedAt">
): Promise<TutorProfile> {
  return saveTutorProfile({
    ...input,
    setupCompletedAt: new Date().toISOString(),
  });
}

async function ensureProfileDir(): Promise<string> {
  if (!FileSystem.documentDirectory) {
    throw new Error("لا يمكن الوصول لمجلد الملفات");
  }
  const info = await FileSystem.getInfoAsync(PROFILE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PROFILE_DIR, { intermediates: true });
  }
  return PROFILE_DIR;
}

/** Copy a picked image into app documents and return a stable file URI. */
export async function persistProfileImage(sourceUri: string): Promise<string> {
  const dir = await ensureProfileDir();
  const extMatch = /\.([a-zA-Z0-9]+)(?:\?|$)/.exec(sourceUri);
  const ext = (extMatch?.[1] ?? "jpg").toLowerCase();
  const dest = `${dir}avatar-${Date.now()}.${ext}`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}

export async function pickProfileImage(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error("permission_denied");
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
  });
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return persistProfileImage(result.assets[0].uri);
}
