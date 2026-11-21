import { sql } from "drizzle-orm";

import { getDb } from "@/db";

/**
 * True when the user has already seen this question's answer: they answered it, or
 * it was in one of their sessions that has ended (e.g. a submitted mock). Reports
 * (ADR 0008) and Ask a doubt (ADR 0010) are only allowed after that, so they can't
 * be used to get the answer early.
 */
export async function hasSeenAnswer(userId: string, questionId: number): Promise<boolean> {
  const seen = await getDb().execute(sql`
    select 1 from practice_sessions s
     where s.user_id = ${userId}
       and ${questionId} = any(s.question_ids)
       and (s.ended_at is not null
            or exists (select 1 from attempts a where a.session_id = s.id and a.question_id = ${questionId}))
     limit 1`);
  return seen.rows.length > 0;
}
