import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ImageSourcePropType } from "react-native";
import {
  loadTutorProfile,
  markSetupComplete,
  pickProfileImage,
  saveTutorProfile,
  type TutorProfile,
} from "./tutorProfile";

const DEFAULT_PROFILE = require("../../assets/images/profile.webp");

type TutorProfileContextValue = {
  ready: boolean;
  setupComplete: boolean;
  name: string;
  profileUri: string | null;
  profileSource: ImageSourcePropType;
  saveProfile: (input: {
    name: string;
    profileUri: string | null;
    completeSetup?: boolean;
  }) => Promise<void>;
  pickImage: () => Promise<string | null>;
  refresh: () => Promise<void>;
};

const TutorProfileContext = createContext<TutorProfileContextValue | null>(
  null
);

export function TutorProfileProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<TutorProfile>({
    name: "",
    profileUri: null,
    setupCompletedAt: null,
  });

  const refresh = useCallback(async () => {
    const next = await loadTutorProfile();
    setProfile(next);
    setReady(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveProfile = useCallback(
    async (input: {
      name: string;
      profileUri: string | null;
      completeSetup?: boolean;
    }) => {
      const next = input.completeSetup
        ? await markSetupComplete({
            name: input.name,
            profileUri: input.profileUri,
          })
        : await saveTutorProfile({
            name: input.name,
            profileUri: input.profileUri,
          });
      setProfile(next);
    },
    []
  );

  const pickImage = useCallback(async () => {
    return pickProfileImage();
  }, []);

  const value = useMemo<TutorProfileContextValue>(
    () => ({
      ready,
      setupComplete: Boolean(profile.setupCompletedAt && profile.name.trim()),
      name: profile.name,
      profileUri: profile.profileUri,
      profileSource: profile.profileUri
        ? { uri: profile.profileUri }
        : DEFAULT_PROFILE,
      saveProfile,
      pickImage,
      refresh,
    }),
    [ready, profile, saveProfile, pickImage, refresh]
  );

  return (
    <TutorProfileContext.Provider value={value}>
      {children}
    </TutorProfileContext.Provider>
  );
}

export function useTutorProfile(): TutorProfileContextValue {
  const ctx = useContext(TutorProfileContext);
  if (!ctx) {
    throw new Error("useTutorProfile must be used within TutorProfileProvider");
  }
  return ctx;
}
