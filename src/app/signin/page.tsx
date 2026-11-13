import { redirect } from "next/navigation";
import { Suspense } from "react";

import { LogoMark } from "@/components/logo";
import { Skeleton } from "@/components/ui/skeleton";
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
        <p role="alert" className="rounded-lg bg-wrong-soft p-3 text-left text-sm">
          {ERRORS[error] ?? "Sign-in failed. Please try again."}
        </p>
      )}
      <GoogleSignInButton callbackUrl={callbackUrl} />
    </>
  );
}

export default function SignInPage(props: PageProps<"/signin">) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-sm animate-rise rounded-2xl border bg-card p-8 text-center shadow-float">
        <LogoMark className="mx-auto size-10" />
        <h1 className="mt-5 text-xl font-semibold tracking-tight">Sign in to MedMinutes</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Your scores and progress are saved to your account.</p>
        <div className="mt-6 flex flex-col items-stretch gap-3 [&_form]:w-full [&_button]:w-full">
          <Suspense fallback={<Skeleton className="h-11 w-full rounded-xl" />}>
            <SignIn searchParams={props.searchParams} />
          </Suspense>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">Free to use. We only read your name, email and photo.</p>
      </div>
    </div>
  );
}
