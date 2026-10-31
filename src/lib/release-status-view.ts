import type { Status, TimelineData } from './types';

/** Overlay website-owned release statuses without changing Sheet-derived feature data. */
export function mergeSavedReleaseStatuses(data: TimelineData, saved: Record<string, Status>): TimelineData {
  const releases = data.releases.map(release => Object.hasOwn(saved, release.id) ? { ...release, status:saved[release.id] } : release);
  return { ...data, releases };
}
