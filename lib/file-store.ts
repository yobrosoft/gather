import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { emptyData, MemoryStore, type StoreData } from "@/lib/memory-store";

export class FileStore extends MemoryStore {
  private loaded = false;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly file: string) {
    super(emptyData());
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const run = this.queue.then(work);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async load() {
    if (this.loaded) return;
    if (!existsSync(this.file)) {
      this.loaded = true;
      return;
    }
    const raw = readFileSync(this.file, "utf8");
    let parsed: StoreData;
    try {
      parsed = JSON.parse(raw) as StoreData;
    } catch {
      throw new Error("Gather's local data file could not be read.");
    }
    this.replace({
      users: parsed.users ?? [],
      churches: parsed.churches ?? [],
      cinemas: parsed.cinemas ?? [],
      screenings: parsed.screenings ?? [],
      parties: parsed.parties ?? [],
    });
    this.loaded = true;
  }

  private persist() {
    mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
    writeFileSync(this.file, JSON.stringify(this.snapshot()), { mode: 0o600 });
  }

  private async change<T>(work: () => Promise<T>): Promise<T> {
    return this.enqueue(async () => {
      await this.load();
      const result = await work();
      this.persist();
      return result;
    });
  }

  private async read<T>(work: () => Promise<T>): Promise<T> {
    return this.enqueue(async () => {
      await this.load();
      return work();
    });
  }

  override getUser(id: string) {
    return this.read(() => super.getUser(id));
  }

  override findUserBySub(sub: string) {
    return this.read(() => super.findUserBySub(sub));
  }

  override saveUser(user: Parameters<MemoryStore["saveUser"]>[0]) {
    return this.change(() => super.saveUser(user));
  }

  override getChurch(id: string) {
    return this.read(() => super.getChurch(id));
  }

  override findChurchByInvite(code: string) {
    return this.read(() => super.findChurchByInvite(code));
  }

  override findChurchByOwnerInvite(code: string) {
    return this.read(() => super.findChurchByOwnerInvite(code));
  }

  override findChurchOwnedBy(userId: string) {
    return this.read(() => super.findChurchOwnedBy(userId));
  }

  override findChurchByPlaceId(placeId: string) {
    return this.read(() => super.findChurchByPlaceId(placeId));
  }

  override saveChurch(church: Parameters<MemoryStore["saveChurch"]>[0]) {
    return this.change(() => super.saveChurch(church));
  }

  override getCinema(id: string) {
    return this.read(() => super.getCinema(id));
  }

  override findCinemaByPlaceId(placeId: string) {
    return this.read(() => super.findCinemaByPlaceId(placeId));
  }

  override saveCinema(cinema: Parameters<MemoryStore["saveCinema"]>[0]) {
    return this.change(() => super.saveCinema(cinema));
  }

  override listScreenings() {
    return this.read(() => super.listScreenings());
  }

  override getScreening(id: string) {
    return this.read(() => super.getScreening(id));
  }

  override findScreeningByToken(token: string) {
    return this.read(() => super.findScreeningByToken(token));
  }

  override saveScreening(screening: Parameters<MemoryStore["saveScreening"]>[0]) {
    return this.change(() => super.saveScreening(screening));
  }

  override listParties(eventId: string) {
    return this.read(() => super.listParties(eventId));
  }

  override getParty(id: string) {
    return this.read(() => super.getParty(id));
  }

  override saveParty(party: Parameters<MemoryStore["saveParty"]>[0]) {
    return this.change(() => super.saveParty(party));
  }

  override deleteParty(id: string) {
    return this.change(() => super.deleteParty(id));
  }
}
