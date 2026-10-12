"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BUSINESS_SLUG } from "@/lib/types";

export default function AdminLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    if (!email || !password) {
      setStatus("Enter an email and password.");
      return;
    }
    setBusy(true);
    const supabase = createClient();

    if (mode === "register") {
      const { error } = await supabase.auth.signUp({ email, password });
      setBusy(false);
      if (error) { setStatus(error.message); return; }
      setStatus("Account created. Check your email to confirm it, then sign in above.");
      setMode("signin");
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setBusy(false); setStatus(error.message); return; }

    // Attach this user to the business — first ever registrant becomes owner,
    // everyone after lands as pending until an admin approves them.
    const { data: existing } = await supabase.from("profiles").select("id").eq("id", data.user.id).maybeSingle();
    if (!existing) {
      await supabase.rpc("register_profile", { p_slug: BUSINESS_SLUG });
    }

    setBusy(false);
    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-8 w-full max-w-sm text-center">
      <div className="w-14 h-14 rounded-xl bg-accent text-white flex items-center justify-center font-bold text-lg mx-auto mb-4">MH</div>
      <h1 className="text-lg font-bold mb-1">Admin access</h1>
      <p className="text-sm text-slate-500 mb-5">
        Sign in, or register for admin access. An existing admin has to approve new accounts before they can get in.
      </p>

      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 mb-5">
        <button
          onClick={() => setMode("signin")}
          className={`flex-1 py-2 rounded-md text-sm font-semibold ${mode === "signin" ? "bg-white shadow-sm" : "text-slate-500"}`}
        >
          Sign in
        </button>
        <button
          onClick={() => setMode("register")}
          className={`flex-1 py-2 rounded-md text-sm font-semibold ${mode === "register" ? "bg-white shadow-sm" : "text-slate-500"}`}
        >
          Register
        </button>
      </div>

      <div className="space-y-3 text-left">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
        />
        <button
          onClick={handleSubmit}
          disabled={busy}
          className="w-full py-2.5 rounded-lg bg-accent text-white font-semibold disabled:opacity-50"
        >
          {mode === "signin" ? "Sign in" : "Register"}
        </button>
        {status && <p className="text-xs text-slate-500">{status}</p>}
      </div>
    </div>
  );
}
