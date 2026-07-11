import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Key, Shield, ExternalLink, Save, CheckCircle2, AlertCircle, Upload } from "lucide-react";
import { useSettings } from "../SettingsContext";
import { useAuth } from "../AuthContext";
import { importLegacyData } from "../importLegacy";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { user } = useAuth();
  const { settings, updateSettings } = useSettings();
  const [apiKey, setApiKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportStatus("Importing…");
    try {
      const json = JSON.parse(await file.text());
      const summary = await importLegacyData(json);
      setImportStatus(`${summary} Reload the page to see your portfolio.`);
    } catch (err: any) {
      console.error("Import failed:", err);
      setImportStatus(`Import failed: ${err.message}`);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setApiKey(settings.casparserApiKey || "");
      setShowSuccess(false);
      setError(null);
    }
  }, [isOpen, settings.casparserApiKey]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    
    try {
      await updateSettings({ casparserApiKey: apiKey.trim() });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err: any) {
      setError("Failed to save settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Shield className="w-6 h-6 text-blue-500" />
                </div>
                <h3 className="text-xl font-semibold text-zinc-100">Settings</h3>
              </div>
              <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-8">
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-zinc-100 font-medium flex items-center gap-2">
                    <Key className="w-4 h-4 text-zinc-400" />
                    CASParser API Key
                  </h4>
                  <a 
                    href="https://app.casparser.in/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-400 text-xs hover:underline flex items-center gap-1"
                  >
                    Get your key <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="bg-zinc-800/50 border border-zinc-800 rounded-xl p-4 space-y-3">
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    By providing your own API key, you bypass the shared platform limits and use your own credits. 
                    Your key is stored securely in your private database and is only used to verify your statements.
                  </p>
                  
                  <div className="relative">
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Enter your CASParser API Key"
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono text-sm"
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h4 className="text-zinc-100 font-medium flex items-center gap-2">
                  <Upload className="w-4 h-4 text-zinc-400" />
                  Import legacy data
                </h4>
                <div className="bg-zinc-800/50 border border-zinc-800 rounded-xl p-4 space-y-3">
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    Migrating from the old Firebase version? Export your data at{" "}
                    <a href="/export-firebase.html" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">/export-firebase.html</a>,
                    then import the JSON here. Import once, into an empty account — importing twice duplicates assets.
                  </p>
                  <input type="file" accept=".json" ref={importInputRef} onChange={handleImportFile} className="hidden" />
                  <button
                    onClick={() => importInputRef.current?.click()}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-sm font-medium rounded-xl transition-all"
                  >
                    Choose export file…
                  </button>
                  {importStatus && <p className="text-zinc-300 text-sm">{importStatus}</p>}
                </div>
              </section>

              {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                  <p className="text-rose-500 text-sm">{error}</p>
                </div>
              )}

              {showSuccess && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <p className="text-emerald-500 text-sm">Settings saved successfully!</p>
                </div>
              )}
            </div>

            <div className="p-6 bg-zinc-800/30 border-t border-zinc-800 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-50"
              >
                {isSaving ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                  />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Settings
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
