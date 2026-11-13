import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getCurrentUser } from "@/lib/current-user";

import { GoogleSignInButton } from "../google-button";

const ERRORS: Record<string, string> = {
  AccessDenied:
    "Google didn't allow this sign-in. While MedMinutes is in testing, your Google account must be on the test-user list.",
  Configuration: "Sign-in is misconfigured on the server. Please try again later.",
};

async function SignIn({ searchParams }: { searchParams: PageProps<"/signin">["searchParams"] }) {
  const params = await searchParams;
  const raw = typeof params.callbackUrl === "string" ? params.callbackUrl : "/practice";
  const callbackUrl = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/practice";
  if (await getCurrentUser()) redirect(callbackUrl);

  const error = typeof params.error === "string" ? params.error : null;
  return (
    <>
      {error && (
        <p role="alert" className="max-w-md rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {ERRORS[error] ?? "Sign-in failed. Please try again."}
        </p>
      )}
      <GoogleSignInButton callbackUrl={callbackUrl} />
    </>
  );
}

export default function SignInPage(props: PageProps<"/signin">) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in to MedMinutes</h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        Your scores and progress are saved to your account.
      </p>
      <Suspense fallback={<div className="h-12" />}>
        <SignIn searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
