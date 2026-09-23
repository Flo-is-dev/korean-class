import type { Progress } from '../types';

// Serializes writes so that an older response never overwrites a later answer.
export class ProgressQueue {
  private dirty = new Map<string, Progress>();
  private chain: Promise<boolean> = Promise.resolve(true);
  constructor(private save: (entries: [string, Progress][]) => Promise<void>) {}
  set(id: string, value: Progress) { this.dirty.set(id, value); }
  forget(ids: string[]) { ids.forEach(id => this.dirty.delete(id)); }
  get pending() { return this.dirty.size > 0; }
  flush(): Promise<boolean> {
    this.chain = this.chain.then(async () => {
      const entries = [...this.dirty.entries()];
      if (!entries.length) return true;
      try {
        await this.save(entries);
        for (const [id, value] of entries) {
          if (this.dirty.get(id) === value) this.dirty.delete(id);
        }
        return true;
      } catch { return false; }
    });
    return this.chain;
  }
}
