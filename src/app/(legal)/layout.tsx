export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <article className="mx-auto w-full max-w-2xl rounded-xl border bg-card p-6 shadow-card sm:p-10 [&_h1]:font-display [&_h1]:text-4xl [&_h1]:leading-tight [&_h2]:mt-10 [&_h2]:border-t [&_h2]:pt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_li]:mt-1.5 [&_p]:mt-3 [&_p]:leading-[1.7] [&_p]:text-muted-foreground [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-muted-foreground [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4">
      {children}
    </article>
  );
}
