// Structural TEST MODE cap for ps-event-communications.
// Pure, dependency-free selection: only the first testBatchLimit ELIGIBLE jobs
// (jobs that already passed every business-rule check and would otherwise reach
// provider.send()) are selected for processing in THIS execution. Everything
// else is deferred (stays pending) and can never reach the provider, by
// construction — not by a mutable counter inside the send loop. There is no
// cross-request memory: a later execution gets its own fresh testBatchLimit.
export type PsBatchSelection<T> = { selected: T[]; deferred: T[] };

export function selectJobsForProcessing<T>(
  eligibleJobs: T[],
  { testMode, testBatchLimit }: { testMode: boolean; testBatchLimit: number },
): PsBatchSelection<T> {
  if (!testMode) return { selected: eligibleJobs, deferred: [] };
  return { selected: eligibleJobs.slice(0, testBatchLimit), deferred: eligibleJobs.slice(testBatchLimit) };
}
