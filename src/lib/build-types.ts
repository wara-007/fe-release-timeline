export type BuildRecord = {
  recordId: string;
  image: string;
  comment: string;
  updatedAt: string;
};

export type BuildData = {
  latest: Record<string, BuildRecord>;
  history: Record<string, BuildRecord[]>;
};
