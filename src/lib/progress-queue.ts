export interface PendingAnswer { id: string; ok: boolean }

// Sends answers one at a time, in the order given. An answer that fails stays queued
// and goes out again with the next one, so the quiz never waits for the network.
export class AnswerQueue {
  private waiting: PendingAnswer[] = [];
  // A rejected typed answer is held back until the learner moves on: « J’avais bon » may still correct it.
  private held: PendingAnswer | null = null;
  private chain: Promise<boolean> = Promise.resolve(true);
  constructor(private send: (answer: PendingAnswer) => Promise<void>) {}
  add(answer: PendingAnswer, hold = false) {
    this.release();
    if (hold) this.held = answer; else this.waiting.push(answer);
  }
  correctHeld(id: string) {
    if (this.held?.id !== id) return false;
    this.held = { id, ok: true };
    return true;
  }
  forget(ids: string[]) {
    this.waiting = this.waiting.filter(answer => !ids.includes(answer.id));
    if (this.held && ids.includes(this.held.id)) this.held = null;
  }
  get pending() { return this.waiting.length > 0 || this.held !== null; }
  // Sends everything that is ready; `flush` also sends the held answer.
  drain(): Promise<boolean> {
    this.chain = this.chain.then(async () => {
      while (this.waiting.length) {
        const answer = this.waiting[0];
        try { await this.send(answer); }
        catch { return false; }
        if (this.waiting[0] === answer) this.waiting.shift();
      }
      return true;
    });
    return this.chain;
  }
  flush(): Promise<boolean> { this.release(); return this.drain(); }
  private release() {
    if (this.held) { this.waiting.push(this.held); this.held = null; }
  }
}
