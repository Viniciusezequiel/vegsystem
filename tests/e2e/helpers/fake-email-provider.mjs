export class FakeEmailProvider {
  constructor({ failOnce = false } = {}) { this.failOnce = failOnce; this.messages = []; }
  async send(message) {
    if (this.failOnce) { this.failOnce = false; throw new Error('fake_provider_failure'); }
    this.messages.push(message); return { id: `fake-${this.messages.length}` };
  }
}

export async function simulateEmailJob(provider, job, message) {
  if (!['pending', 'failed'].includes(job.status)) return job;
  job.status = 'processing'; job.attempt_count += 1;
  try { const result = await provider.send(message); job.status = 'sent'; job.provider_message_id = result.id; }
  catch (error) { job.status = 'failed'; job.last_error = error.message; }
  return job;
}
