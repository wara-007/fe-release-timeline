import type { TimelineData } from './types';
import type { ReleaseStatusRecord } from './release-status-store';

/** Overlay website-owned release statuses without changing Sheet-derived feature data. */
export function mergeSavedReleaseStatuses(data: TimelineData, saved: Record<string, ReleaseStatusRecord>): TimelineData {
  const releases = data.releases.map(release => Object.hasOwn(saved, release.id) ? { ...release, status:saved[release.id].releaseStatus } : release);
  return { ...data, releases };
}
