import type { TimelineData } from './types';

/** Overlay web-owned metadata without changing the read-only Sheet data. */
export function mergeSavedBuilds(data: TimelineData, saved: Record<string, string>): TimelineData {
  const has = (id: string) => Object.hasOwn(saved, id);
  const features = data.features.map(feature => has(feature.id) ? { ...feature, image: saved[feature.id] } : feature);
  const byId = new Map(features.map(feature => [feature.id, feature]));
  const releases = data.releases.map(release => {
    const members = release.features.map(feature => byId.get(feature.id) || feature);
    const images = has(release.id)
      ? saved[release.id] ? [saved[release.id]] : []
      : [...new Set(members.map(feature => feature.image).filter(Boolean))];
    return { ...release, features: members, images };
  });
  return { ...data, features, releases };
}
