import { Redis } from '@upstash/redis';
import type { RoomRecord, RoomStore } from './rooms.js';

const TTL_SECONDS = 60 * 60 * 24 * 7; // rooms expire a week after their last move

const dataKey = (code: string) => `duelo:room:${code}`;
const versionKey = (code: string) => `duelo:room:${code}:v`;

// Atomic compare-and-set on the version key, then write both keys with a fresh TTL.
const SAVE_SCRIPT = `
local current = redis.call('GET', KEYS[2])
if (not current) or tonumber(current) ~= tonumber(ARGV[1]) then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[4])
redis.call('SET', KEYS[2], ARGV[3], 'EX', ARGV[4])
return 1
`;

export class RedisStore implements RoomStore {
  constructor(
    private redis: Redis = new Redis({
      url: process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN!,
    }),
  ) {}

  async create(record: RoomRecord): Promise<boolean> {
    const ok = await this.redis.set(versionKey(record.code), record.version, { nx: true, ex: TTL_SECONDS });
    if (ok !== 'OK') return false;
    await this.redis.set(dataKey(record.code), JSON.stringify(record), { ex: TTL_SECONDS });
    return true;
  }

  async get(code: string): Promise<RoomRecord | null> {
    const raw = await this.redis.get<RoomRecord | string>(dataKey(code));
    if (raw === null || raw === undefined) return null;
    return typeof raw === 'string' ? (JSON.parse(raw) as RoomRecord) : raw;
  }

  async version(code: string): Promise<number | null> {
    const v = await this.redis.get<number | string>(versionKey(code));
    return v === null || v === undefined ? null : Number(v);
  }

  async save(record: RoomRecord, expectedVersion: number): Promise<boolean> {
    const result = await this.redis.eval(
      SAVE_SCRIPT,
      [dataKey(record.code), versionKey(record.code)],
      [String(expectedVersion), JSON.stringify(record), String(record.version), String(TTL_SECONDS)],
    );
    return Number(result) === 1;
  }
}
