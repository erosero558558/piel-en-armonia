export const CALLBACK_SORT_STORAGE_KEY = 'admin-callbacks-sort';
export const CALLBACK_FILTER_STORAGE_KEY = 'admin-callbacks-filter';
export const CALLBACK_URGENT_THRESHOLD_MINUTES = 120;
export const CALLBACK_FILTER_OPTIONS = new Set([
    'all',
    'pending',
    'contacted',
    'today',
    'sla_urgent',
]);
export const CALLBACK_SORT_OPTIONS = new Set([
    'priority_desc',
    'recent_desc',
    'waiting_desc',
]);
