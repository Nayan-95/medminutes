import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of service — MedMinutes" };

const ISSUES = "https://github.com/Nayan-95/medminutes/issues";

export default function TermsPage() {
  return (
    <>
      <h1>Terms of service</h1>
      <p>Last updated: 13 November 2026</p>

      <h2>The service</h2>
      <p>
        MedMinutes is a free practice tool for NEET PG multiple-choice questions, provided as-is while it is
        being built. Features may change, and the service may be unavailable at times.
      </p>

      <h2>Not medical advice</h2>
      <p>
        Questions and explanations come from the public MedMCQA dataset and are for exam practice only. They
        may contain errors and are not medical advice or a substitute for standard textbooks or clinical
        judgement.
      </p>

      <h2>Your account</h2>
      <p>
        You sign in with Google and are responsible for activity on your account. Please don&apos;t misuse
        the service, try to access other people&apos;s data, or overload it with automated requests.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent permitted by law, MedMinutes is provided without warranties, and we aren&apos;t liable
        for losses arising from its use, including exam outcomes.
      </p>

      <h2>Contact</h2>
      <p>
        Questions or problem reports: <a href={ISSUES}>GitHub issues</a>. See also our{" "}
        <a href="/privacy">privacy policy</a>.
      </p>
    </>
  );
}
