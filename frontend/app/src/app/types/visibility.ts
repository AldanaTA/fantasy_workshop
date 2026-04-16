export const VISIBILITY = {
  PRIVATE: 'private',
  PUBLIC: 'public',
} as const;

export type Visibility = typeof VISIBILITY[keyof typeof VISIBILITY];