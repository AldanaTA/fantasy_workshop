export const STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
} as const;

export type Status = typeof STATUS[keyof typeof STATUS];