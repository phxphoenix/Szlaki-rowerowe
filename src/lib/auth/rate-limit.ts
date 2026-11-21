export const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 10;
export const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const MAX_TRACKED_IPS = 5_000;

export interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

interface TierStore {
  entries: Map<string, number[]>;
  lastRecordedTimestamp: number | null;
  needsFullExpiredSweep: boolean;
}

function createTierStore(): TierStore {
  return {
    entries: new Map<string, number[]>(),
    lastRecordedTimestamp: null,
    needsFullExpiredSweep: false,
  };
}

// Dwupoziomowy magazyn: aktywnie zablokowane IP nie mogą być wypierane przez rotację pojedynczych prób.
const unlockedTier = createTierStore();
const lockedTier = createTierStore();

function normalizeIpKey(ip: string): string {
  const trimmed = ip.trim().toLowerCase();
  if (!trimmed) return "unknown";
  return trimmed.slice(0, 128);
}

/**
 * Wyciąga adres IP klienta z nagłówków żądania (`x-forwarded-for`, `x-real-ip`).
 */
export function extractClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) {
      return normalizeIpKey(firstIp);
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return normalizeIpKey(realIp);
  }

  return "unknown";
}

function pruneWindow(timestamps: number[], now: number): number[] {
  const cutoff = now - LOGIN_RATE_LIMIT_WINDOW_MS;
  return timestamps.filter((ts) => ts > cutoff);
}

function appendTimestampSorted(timestamps: number[], now: number): number[] {
  if (
    timestamps.length === 0 ||
    now >= timestamps[timestamps.length - 1]!
  ) {
    timestamps.push(now);
    return timestamps;
  }

  timestamps.push(now);
  timestamps.sort((a, b) => a - b);
  return timestamps;
}

function computeStatus(attempts: number[], now: number): RateLimitStatus {
  if (attempts.length >= LOGIN_RATE_LIMIT_MAX_ATTEMPTS) {
    const oldest = attempts[0] ?? now;
    const retryAfterMs = Math.max(
      1_000,
      oldest + LOGIN_RATE_LIMIT_WINDOW_MS - now,
    );
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1_000),
    };
  }

  return {
    allowed: true,
    remaining: LOGIN_RATE_LIMIT_MAX_ATTEMPTS - attempts.length,
    retryAfterSeconds: 0,
  };
}

function resetTierStore(tier: TierStore): void {
  tier.entries.clear();
  tier.lastRecordedTimestamp = null;
  tier.needsFullExpiredSweep = false;
}

function deleteEntryFromTier(tier: TierStore, key: string): void {
  tier.entries.delete(key);
  if (tier.entries.size === 0) {
    tier.lastRecordedTimestamp = null;
    tier.needsFullExpiredSweep = false;
  }
}

function insertEntryIntoTier(
  tier: TierStore,
  key: string,
  active: number[],
): void {
  const entryLastTs = active[active.length - 1];
  if (entryLastTs !== undefined) {
    if (
      tier.lastRecordedTimestamp !== null &&
      entryLastTs < tier.lastRecordedTimestamp
    ) {
      tier.needsFullExpiredSweep = true;
    }
    tier.lastRecordedTimestamp =
      tier.lastRecordedTimestamp === null
        ? entryLastTs
        : Math.max(tier.lastRecordedTimestamp, entryLastTs);
  }
  tier.entries.set(key, active);
}

function sweepExpiredFromTier(
  tier: TierStore,
  now: number,
  demoteToUnlocked: boolean,
): void {
  if (tier.entries.size === 0) return;

  if (tier.needsFullExpiredSweep) {
    let prevLastTs: number | null = null;
    let maxRemainingTs: number | null = null;
    let isMonotonic = true;

    for (const [entryKey, timestamps] of tier.entries.entries()) {
      const active = pruneWindow(timestamps, now);
      if (active.length === 0) {
        tier.entries.delete(entryKey);
        continue;
      }

      if (demoteToUnlocked && active.length < LOGIN_RATE_LIMIT_MAX_ATTEMPTS) {
        tier.entries.delete(entryKey);
        insertEntryIntoTier(unlockedTier, entryKey, active);
        continue;
      }

      if (active.length < timestamps.length) {
        tier.entries.set(entryKey, active);
      }

      const entryLastTs = active[active.length - 1]!;
      if (prevLastTs !== null && entryLastTs < prevLastTs) {
        isMonotonic = false;
      }
      prevLastTs = entryLastTs;
      maxRemainingTs =
        maxRemainingTs === null
          ? entryLastTs
          : Math.max(maxRemainingTs, entryLastTs);
    }

    if (tier.entries.size === 0) {
      tier.lastRecordedTimestamp = null;
      tier.needsFullExpiredSweep = false;
    } else {
      tier.lastRecordedTimestamp = maxRemainingTs;
      tier.needsFullExpiredSweep = !isMonotonic;
    }
    return;
  }

  // Wpisy w Map są uporządkowane monotonicznie według ostatniej próby (od najstarszego),
  // więc wygasłe klucze tworzą prefiks na początku i nie wymagają pełnego skanu aktywnych IP.
  for (const [entryKey, timestamps] of tier.entries.entries()) {
    const active = pruneWindow(timestamps, now);
    if (active.length === 0) {
      tier.entries.delete(entryKey);
      continue;
    }

    if (demoteToUnlocked && active.length < LOGIN_RATE_LIMIT_MAX_ATTEMPTS) {
      tier.entries.delete(entryKey);
      insertEntryIntoTier(unlockedTier, entryKey, active);
    }
    break;
  }

  if (tier.entries.size === 0) {
    tier.lastRecordedTimestamp = null;
    tier.needsFullExpiredSweep = false;
  }
}

function pruneStaleStoreEntries(
  now: number,
  maxEntries: number = MAX_TRACKED_IPS,
): void {
  if (getTrackedLoginIpCount() <= maxEntries) return;

  sweepExpiredFromTier(unlockedTier, now, false);

  if (getTrackedLoginIpCount() > maxEntries) {
    sweepExpiredFromTier(lockedTier, now, true);
  }

  while (getTrackedLoginIpCount() > maxEntries && unlockedTier.entries.size > 0) {
    const oldestKey = unlockedTier.entries.keys().next().value;
    if (oldestKey === undefined) break;
    deleteEntryFromTier(unlockedTier, oldestKey);
  }

  while (getTrackedLoginIpCount() > maxEntries && lockedTier.entries.size > 0) {
    const oldestKey = lockedTier.entries.keys().next().value;
    if (oldestKey === undefined) break;
    deleteEntryFromTier(lockedTier, oldestKey);
  }
}

export function checkLoginRateLimit(
  ip: string,
  now: number = Date.now(),
): RateLimitStatus {
  const key = normalizeIpKey(ip);
  const lockedExisting = lockedTier.entries.get(key);
  if (lockedExisting && lockedExisting.length > 0) {
    const active = pruneWindow(lockedExisting, now);
    if (active.length === 0) {
      deleteEntryFromTier(lockedTier, key);
      return {
        allowed: true,
        remaining: LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
        retryAfterSeconds: 0,
      };
    }

    if (active.length < LOGIN_RATE_LIMIT_MAX_ATTEMPTS) {
      deleteEntryFromTier(lockedTier, key);
      insertEntryIntoTier(unlockedTier, key, active);
      return computeStatus(active, now);
    }

    lockedTier.entries.set(key, active);
    return computeStatus(active, now);
  }

  const unlockedExisting = unlockedTier.entries.get(key);
  if (!unlockedExisting || unlockedExisting.length === 0) {
    return {
      allowed: true,
      remaining: LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
      retryAfterSeconds: 0,
    };
  }

  const active = pruneWindow(unlockedExisting, now);
  if (active.length === 0) {
    deleteEntryFromTier(unlockedTier, key);
    return {
      allowed: true,
      remaining: LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
      retryAfterSeconds: 0,
    };
  }

  unlockedTier.entries.set(key, active);
  return computeStatus(active, now);
}

export function recordFailedLoginAttempt(
  ip: string,
  now: number = Date.now(),
): RateLimitStatus {
  const key = normalizeIpKey(ip);
  const lockedExisting = lockedTier.entries.get(key);
  if (lockedExisting !== undefined) {
    const active = appendTimestampSorted(pruneWindow(lockedExisting, now), now);
    deleteEntryFromTier(lockedTier, key);
    if (active.length >= LOGIN_RATE_LIMIT_MAX_ATTEMPTS) {
      insertEntryIntoTier(lockedTier, key, active);
    } else {
      insertEntryIntoTier(unlockedTier, key, active);
    }
    return computeStatus(active, now);
  }

  const unlockedExisting = unlockedTier.entries.get(key);
  if (unlockedExisting !== undefined) {
    const active = appendTimestampSorted(pruneWindow(unlockedExisting, now), now);
    deleteEntryFromTier(unlockedTier, key);
    if (active.length >= LOGIN_RATE_LIMIT_MAX_ATTEMPTS) {
      insertEntryIntoTier(lockedTier, key, active);
    } else {
      insertEntryIntoTier(unlockedTier, key, active);
    }
    return computeStatus(active, now);
  }

  if (getTrackedLoginIpCount() >= MAX_TRACKED_IPS) {
    pruneStaleStoreEntries(now, MAX_TRACKED_IPS - 1);
  }

  const active = [now];
  if (active.length >= LOGIN_RATE_LIMIT_MAX_ATTEMPTS) {
    insertEntryIntoTier(lockedTier, key, active);
  } else {
    insertEntryIntoTier(unlockedTier, key, active);
  }
  return computeStatus(active, now);
}

export function clearLoginRateLimitForIp(ip: string): void {
  const key = normalizeIpKey(ip);
  if (unlockedTier.entries.has(key)) {
    deleteEntryFromTier(unlockedTier, key);
  }
  if (lockedTier.entries.has(key)) {
    deleteEntryFromTier(lockedTier, key);
  }
}

export function getTrackedLoginIpCount(): number {
  return unlockedTier.entries.size + lockedTier.entries.size;
}

export function resetLoginRateLimit(): void {
  resetTierStore(unlockedTier);
  resetTierStore(lockedTier);
}
