import type { CategoryType } from '@/lib/types';
import config from '../bifl365.config.json';

// Build the array used by CategoryStrip (including "All Products")
export const CATEGORIES: { value: CategoryType | 'all'; label: string; hook: string }[] = [
  { value: 'all', label: 'All Products', hook: 'Every BIFL category' },
  ...(config.categories as { value: CategoryType; label: string; hook: string }[])
];

export const VALID_CATEGORIES = config.categories.map(c => c.value) as unknown as readonly CategoryType[];

export const CATEGORY_LABELS: Record<string, string> = 
  config.categories.reduce((acc, cat) => ({ ...acc, [cat.value]: cat.label }), {});

export const CATEGORY_HOOKS: Record<CategoryType, string> = 
  config.categories.reduce((acc, cat) => ({ ...acc, [cat.value]: cat.hook }), {}) as Record<CategoryType, string>;

