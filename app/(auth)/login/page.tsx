"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const configured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("YOUR-") &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);

  async function google() {
    setBusy(true);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
    if (error) {
      toast.error(`Couldn't start Google sign-in — ${error.message}`);
      setBusy(false);
    }
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await createClient().auth.signInWithOtp({ email });
    setBusy(false);
    if (error) return void toast.error(`Couldn't send code — ${error.message}`);
    setStage("code");
    toast(`Code sent to ${email}`);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await createClient().auth.verifyOtp({ email, token: code, type: "email" });
    setBusy(false);
    if (error) return void toast.error(`Code didn't match — try again or resend.`);
    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm rounded-(--radius-card) border border-hairline bg-surface p-6">
        <div className="text-center">
          <div className="text-lg font-semibold tracking-wide text-ink-2">INVEST·CHECK</div>
          <p className="mt-1 text-[13px] text-muted">Your portfolio, remembered daily.</p>
        </div>

        {!configured && (
          <p className="mt-4 rounded-(--radius-field) border border-warn/40 bg-warn/5 p-3 text-[13px] text-warn">
            Supabase isn&apos;t configured yet — fill NEXT_PUBLIC_SUPABASE_URL and
            NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, then reload.
          </p>
        )}

        <Button className="mt-6 w-full" variant="primary" onClick={google} disabled={busy || !configured}>
          Continue with Google
        </Button>

        <div className="my-5 flex items-center gap-3 text-[11px] text-muted">
          <div className="h-px flex-1 bg-hairline" />
          or
          <div className="h-px flex-1 bg-hairline" />
        </div>

        {stage === "email" ? (
          <form onSubmit={sendCode} className="space-y-3">
            <Input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <Button type="submit" className="w-full" disabled={busy || !email || !configured}>
              Send code
            </Button>
            <button
              type="button"
              className="w-full text-center text-[12px] text-muted hover:text-ink disabled:opacity-50"
              disabled={!email || !configured}
              onClick={() => setStage("code")}
            >
              Already have a code?
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-3">
            <p className="text-[13px] text-muted">Enter the code sent to {email}.</p>
            <Input
              inputMode="numeric"
              autoFocus
              required
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={10}
            />
            <Button type="submit" variant="primary" className="w-full" disabled={busy || code.length < 6}>
              Sign in
            </Button>
            <button
              type="button"
              className="w-full text-center text-[12px] text-muted hover:text-ink"
              onClick={() => setStage("email")}
            >
              Different email
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
