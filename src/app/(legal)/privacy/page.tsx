import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy policy — MedMinutes" };

const ISSUES = "https://github.com/Nayan-95/medminutes/issues";

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy policy</h1>
      <p>Last updated: 14 November 2026</p>
      <p>
        MedMinutes is a free NEET PG practice app. This page explains what we collect, why, and what you can
        ask us to do with it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>From Google sign-in:</strong> your name, email address and profile photo, plus Google&apos;s
          account identifier for you. We ask Google for nothing else.
        </li>
        <li>
          <strong>Your practice:</strong> the sessions you start, the answer you choose for each question (or
          that you skipped), whether it was correct, the marks, and how long you took. In mock tests we also keep the
          first answer you picked for each question and which questions you marked for review.
        </li>
        <li>
          <strong>Question reports:</strong> if you report a problem with a question, we keep the reason, any note
          you write, and that it came from your account. Only the app owner sees reports, and without your name.
        </li>
        <li>
          <strong>AI explanations:</strong> when you tap &ldquo;Why was I wrong?&rdquo;, we send the question, its
          options, the answer key, the option you picked and the question&apos;s explanation to Google&apos;s Gemini
          API. Nothing about you (no name, email or account) is sent. We use Gemini&apos;s free tier, under which
          Google may use this question content to improve its products. The answer is saved and shown to other
          students who make the same mistake. We keep a count of how many explanations you request, to apply daily
          limits.
        </li>
        <li>
          <strong>Ask a doubt:</strong> the doubt you type (or the quick doubt you tap) is sent to Gemini together
          with the question, under the same free-tier terms. Don&apos;t type personal details. We don&apos;t save
          typed doubts or the chat; we only count how many doubts you ask. Answers to the quick doubts (like
          &ldquo;Explain simply&rdquo;) are saved and shown to other students.
        </li>
      </ul>

      <h2>Why we collect it</h2>
      <p>
        Only to run the app: to sign you in, to save your sessions and scores, to show you your results and
        progress, and to show the leaderboard described below.
      </p>

      <h2>Leaderboard: what other users see</h2>
      <p>
        MedMinutes has a leaderboard that every signed-in user can see. By default it shows you with your{" "}
        <strong>first name and last initial</strong> (for example &ldquo;Priya S.&rdquo;) and your{" "}
        <strong>full email address</strong>, together with your score, accuracy, number of answers and practice
        streak. Your profile photo is not shown. You can hide yourself at any time with the &ldquo;Hide me from the
        leaderboard&rdquo; button on the leaderboard page; you will still see your own rank, and nobody else will
        see you.
      </p>

      <h2>What we don&apos;t do</h2>
      <ul>
        <li>No ads and no advertising trackers.</li>
        <li>We don&apos;t sell or rent your data, or share it with anyone for marketing.</li>
        <li>We don&apos;t read your Gmail, contacts, Drive or anything else in your Google account.</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        We use one essential cookie to keep you signed in, plus short-lived cookies used during sign-in for
        security. No analytics or advertising cookies.
      </p>

      <h2>Where your data is stored</h2>
      <p>
        The app is hosted on Vercel, and your data is stored in a PostgreSQL database run by Neon. Both act as
        service providers for MedMinutes. Data is sent over encrypted (HTTPS/TLS) connections.
      </p>

      <h2>Your choices</h2>
      <p>
        You can ask us to delete your account and all of your practice data at any time, or ask what data we
        hold about you. Open a request on our <a href={ISSUES}>GitHub issues page</a> with the subject
        &ldquo;Data request&rdquo; (don&apos;t post your email publicly; we&apos;ll reply there to arrange
        verification). You can also remove MedMinutes&apos; access from your Google account settings.
      </p>

      <h2>Children</h2>
      <p>MedMinutes is meant for medical graduates preparing for NEET PG and is not directed at children.</p>

      <h2>Changes</h2>
      <p>If this policy changes, we&apos;ll update this page and the date above.</p>
    </>
  );
}
