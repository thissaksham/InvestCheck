import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useAuth } from "./AuthContext";

interface UserSettings {
  casparserApiKey?: string;
}

interface SettingsContextType {
  settings: UserSettings;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  loading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSettings({});
      setLoading(false);
      return;
    }
    supabase
      .from("user_settings")
      .select("casparser_api_key")
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error("Error fetching settings:", error);
        setSettings({ casparserApiKey: data?.casparser_api_key || undefined });
        setLoading(false);
      });
  }, [user]);

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    if (!user) return;
    const { error } = await supabase.from("user_settings").upsert({
      user_id: user.uid,
      casparser_api_key: newSettings.casparserApiKey ?? settings.casparserApiKey ?? null,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.error("Error updating settings:", error);
      throw error;
    }
    setSettings((s) => ({ ...s, ...newSettings }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
