import React from "react";
import { motion } from "motion/react";
import { TrendingUp, Shield, Zap, Globe, AlertCircle } from "lucide-react";
import { useAuth } from "../AuthContext";
import { isFirebaseConfigured } from "../firebase";

export function AuthScreen() {
  const { login } = useAuth();

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 blur-[120px] rounded-full" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="flex flex-col items-center text-center mb-12">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mb-6 shadow-2xl shadow-blue-600/20">
            <TrendingUp className="text-white w-8 h-8" />
          </div>
          <h1 className="text-4xl font-bold text-zinc-100 tracking-tight mb-3">Portfolio Pro</h1>
          <p className="text-zinc-400 text-lg">Ultra-minimalist investment tracking for the modern investor.</p>
        </div>

        {!isFirebaseConfigured ? (
          <div className="p-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-rose-500" />
              <h3 className="text-rose-100 font-semibold text-lg">Firebase Setup Required</h3>
            </div>
            <p className="text-rose-200/80 text-sm mb-4 leading-relaxed">
              The automated Firebase provisioning failed due to a platform permission issue. To use this app, please provide your own Firebase configuration.
            </p>
            <p className="text-rose-200/80 text-sm leading-relaxed">
              Please paste your <code className="bg-black/30 px-1.5 py-0.5 rounded text-rose-300">firebaseConfig</code> object in the chat, and I will configure the app for you.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 mb-10">
              {[
                { icon: Shield, text: "Secure Firebase Auth" },
                { icon: Zap, text: "Real-time Portfolio Sync" },
                { icon: Globe, text: "Multi-asset Management" },
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                  className="flex items-center gap-4 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50 backdrop-blur-sm"
                >
                  <feature.icon className="w-5 h-5 text-blue-500" />
                  <span className="text-zinc-300 font-medium">{feature.text}</span>
                </motion.div>
              ))}
            </div>

            <button
              onClick={login}
              className="w-full py-4 bg-zinc-100 hover:bg-white text-zinc-950 font-bold rounded-xl transition-all flex items-center justify-center gap-3 shadow-xl shadow-white/5 group"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
              Continue with Google
              <motion.div
                animate={{ x: [0, 5, 0] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                <TrendingUp className="w-4 h-4" />
              </motion.div>
            </button>
          </>
        )}

        <p className="mt-8 text-center text-zinc-500 text-sm">
          By continuing, you agree to our <span className="text-zinc-400 underline cursor-pointer">Terms of Service</span>.
        </p>
      </motion.div>
    </div>
  );
}
