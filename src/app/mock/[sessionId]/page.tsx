import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { requireUserId } from "@/lib/current-user";
import { formatOf, loadMockForExam } from "@/lib/mock-data";

import { ExamRunner } from "./exam-runner";

async function Exam({ params }: { params: PageProps<"/mock/[sessionId]">["params"] }) {
  await connection();
  const { sessionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) redirect("/mock");

  const data = await loadMockForExam(sessionId, await requireUserId(`/mock/${sessionId}`));
  if (!data) redirect("/mock");
  if (data.ended) redirect(`/mock/${sessionId}/result`);

  return (
    <ExamRunner
      sessionId={sessionId}
      format={{ ...data.mock, label: formatOf(data.mock.format).label }}
      startedAt={data.session.startedAt.getTime()}
      serverNow={data.serverNow.getTime()}
      questions={data.questions}
      initialResponses={data.responses}
    />
  );
}

export default function MockExamPage(props: PageProps<"/mock/[sessionId]">) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4" aria-label="Loading exam">
          <Skeleton className="h-11 w-full" />
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
            <Skeleton className="h-[440px] rounded-xl" />
            <Skeleton className="hidden h-[360px] rounded-xl lg:block" />
          </div>
        </div>
      }
    >
      <Exam params={props.params} />
    </Suspense>
  );
}
