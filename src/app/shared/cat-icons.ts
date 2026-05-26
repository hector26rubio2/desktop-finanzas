export interface CatIcon {
  id: string;
  label: string;
  path: string;
  filled?: boolean;
}

export const CAT_ICONS: CatIcon[] = [
  {
    id: 'shopping-bag',
    label: 'Shopping bag',
    path: '<path d="M3.5 4.5h9l-.7 8.2a1.4 1.4 0 0 1-1.4 1.3H5.6a1.4 1.4 0 0 1-1.4-1.3L3.5 4.5z"/><path d="M5.5 4.5V3a2.5 2.5 0 0 1 5 0v1.5"/>',
  },
  {
    id: 'cart',
    label: 'Cart',
    path: '<circle cx="5.5" cy="13.5" r="1"/><circle cx="11.5" cy="13.5" r="1"/><path d="M1.5 1.5h2l1.4 8h7.6l1-5h-8"/>',
  },
  {
    id: 'utensils',
    label: 'Food',
    path: '<path d="M3 1v6a2 2 0 0 0 4 0V1M5 1v6M8 1v4c0 1.1.9 2 2 2v7M12 1v4c0 1.1-.9 2-2 2"/>',
  },
  { id: 'home', label: 'Home', path: '<path d="M2 8l6-5.5L14 8"/><path d="M4 7.5V13.5h8V7.5"/>' },
  {
    id: 'car',
    label: 'Car',
    path: '<path d="M2 10l1.5-4h9L14 10"/><rect x="1.5" y="10" width="13" height="3.5" rx="1"/><circle cx="4.5" cy="13.5" r="1"/><circle cx="11.5" cy="13.5" r="1"/>',
  },
  {
    id: 'bus',
    label: 'Bus',
    path: '<rect x="2" y="2" width="12" height="10" rx="2"/><path d="M2 7h12"/><circle cx="4.5" cy="12.5" r="1"/><circle cx="11.5" cy="12.5" r="1"/>',
  },
  { id: 'plane', label: 'Plane', path: '<path d="M8 1v6M8 7l6-3v2l-6 3v4l2 1v1l-2-1-2 1v-1l2-1V9l-6-3V4l6 3z"/>' },
  { id: 'heart-pulse', label: 'Health', path: '<path d="M2 8h3l2-4 3 8 2-4h3"/>' },
  {
    id: 'graduation-cap',
    label: 'Education',
    path: '<path d="M2 6l6-3 6 3-6 3z"/><path d="M4 7.5V12"/><path d="M2 9v1.5c0 1 3 3.5 6 3.5s6-2.5 6-3.5V9"/>',
  },
  { id: 'book-open', label: 'Books', path: '<path d="M2 3c2-1 5-1 6 1 1-2 4-2 6-1v9c-2-1-5-1-6 1-1-2-4-2-6-1V3z"/>' },
  {
    id: 'gamepad',
    label: 'Entertainment',
    path: '<rect x="1" y="4" width="14" height="8" rx="3"/><circle cx="5" cy="8" r="1"/><circle cx="11" cy="8" r="1"/><path d="M7 6.5v3M5.5 8h3"/>',
  },
  {
    id: 'music',
    label: 'Music',
    path: '<path d="M4 12V3.5L13 2v8.5"/><circle cx="3" cy="12" r="1.5"/><circle cx="12" cy="10.5" r="1.5"/>',
  },
  { id: 'dumbbell', label: 'Gym', path: '<path d="M5 4v8M3 5v6M11 4v8M13 5v6"/><path d="M5 8h6"/>' },
  { id: 'shirt', label: 'Clothing', path: '<path d="M5 1l-3 3h3v10h6V4h3l-3-3"/>' },
  {
    id: 'gift',
    label: 'Gift',
    path: '<rect x="2" y="6" width="12" height="8" rx="1"/><path d="M8 6v8M2 6h12"/><path d="M8 6c0-2-3-4-4-3s1 3 4 3M8 6c0-2 3-4 4-3s-1 3-4 3"/>',
  },
  { id: 'phone', label: 'Phone', path: '<rect x="4" y="1" width="8" height="14" rx="1.5"/><path d="M7 13h2"/>' },
  {
    id: 'wifi',
    label: 'Internet',
    path: '<path d="M1.5 5.5C4 3 7 2 8 2s4 1 6.5 3.5"/><path d="M3.5 8.5C5.5 6.5 7 5.5 8 5.5s2.5 1 4.5 3"/><path d="M5.5 11.5c1-1 2-2 2.5-2s1.5 1 2.5 2"/><circle cx="8" cy="13" r="1"/>',
  },
  { id: 'zap', label: 'Energy', path: '<path d="M9 1L3 9h4l-1 6 6-8H8l1-6z"/>' },
  { id: 'droplets', label: 'Water', path: '<path d="M8 2C6 5 3 7.5 3 10a5 5 0 0 0 10 0c0-2.5-3-5-5-8z"/>' },
  {
    id: 'flame',
    label: 'Gas',
    path: '<path d="M8 1c-2 3-5 5.5-5 9a5 5 0 0 0 10 0c0-3.5-3-6-5-9z"/><path d="M8 8c-1 1.5-2 2.5-2 4a2.5 2.5 0 0 0 5 0c0-1.5-1.5-2.5-3-4z"/>',
  },
  {
    id: 'baby',
    label: 'Kids',
    path: '<circle cx="8" cy="4" r="2"/><path d="M4 8c0-1 1.8-2 4-2s4 1 4 2"/><path d="M8 10v4M6 14h4"/>',
  },
  {
    id: 'dog',
    label: 'Pets',
    path: '<path d="M4 3C3 5 2 8 4 10c-.5 1.5 0 3 1 4h2v-2l1-1 1 1v2h2c1-1 1.5-2.5 1-4 2-2 1-5 0-7"/><circle cx="6" cy="6" r="0.5" fill="currentColor"/>',
  },
  {
    id: 'piggy-bank',
    label: 'Savings',
    path: '<ellipse cx="8" cy="9" rx="5.5" ry="5"/><path d="M11 4c0-1 1.5-2 3-1M8 4V2M3.5 7H1"/><circle cx="10" cy="8" r="0.5" fill="currentColor"/>',
  },
  {
    id: 'briefcase',
    label: 'Work',
    path: '<rect x="1.5" y="5" width="13" height="8" rx="2"/><path d="M5.5 5V3.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V5"/><path d="M1.5 9h13"/>',
  },
  {
    id: 'landmark',
    label: 'Bank',
    path: '<path d="M2 13h12M3 11h10M3 11V6M13 11V6"/><path d="M2 6l6-3.5L14 6"/><path d="M8 2.5v-1"/>',
  },
  { id: 'trending-up', label: 'Investment', path: '<path d="M2 12l4-4 3 3 5-6"/><path d="M11 5h4v4"/>' },
  {
    id: 'hand-coins',
    label: 'Salary',
    path: '<path d="M2 11h3v4H2z"/><path d="M5 12c3-1 5 0 8-2V9c-3 2-5 1-8 2"/><circle cx="11" cy="4" r="2.5"/>',
  },
  {
    id: 'receipt',
    label: 'Bills',
    path: '<path d="M3 1h10v13l-1.5-1-1.5 1-1.5-1-1.5 1-1.5-1L4.5 14 3 13V1z"/><path d="M5.5 5h5M5.5 7.5h5M5.5 10h3"/>',
  },
  {
    id: 'coffee',
    label: 'Coffee',
    path: '<path d="M2 6h10v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z"/><path d="M12 7.5c1.5 0 2.5 1 2.5 2S13.5 12 12 12"/><path d="M5 3.5c0-1 1-2 2-1M8 3.5c0-1 1-2 2-1"/>',
  },
  {
    id: 'pill',
    label: 'Medicine',
    path: '<rect x="2.5" y="6.5" width="11" height="5" rx="2.5" transform="rotate(-45 8 9)"/>',
  },
  {
    id: 'wrench',
    label: 'Repairs',
    path: '<path d="M10.5 1.5l2 2-7 7-2-2 7-7zM5.5 10.5l-3 3"/><path d="M11.5 4.5c1.5-1 3.5 0 3.5 2s-1.5 3-3.5 2"/>',
  },
  { id: 'tag', label: 'Tag', path: '<path d="M2 2l5.5 1L14 9.5 9.5 14 3 7.5z"/><circle cx="5.5" cy="5.5" r="1"/>' },
  {
    id: 'circle-dollar-sign',
    label: 'Money',
    path: '<circle cx="8" cy="8" r="6"/><path d="M6 6.5c0-1 .9-1.5 2-1.5s2 .5 2 1.5S8.9 8 8 8s-2 .5-2 1.5.9 1.5 2 1.5 2-.5 2-1.5"/><path d="M8 4v1M8 11v1"/>',
  },
  {
    id: 'pizza',
    label: 'Delivery',
    path: '<path d="M2 13l6-11 6 11H2z"/><path d="M7 8a1 1 0 1 0 0 .01M10 9a1 1 0 1 0 0 .01"/>',
  },
  {
    id: 'stethoscope',
    label: 'Doctor',
    path: '<path d="M4 1v4c0 2.2 1.8 4 4 4s4-1.8 4-4V1"/><path d="M8 9v3a2 2 0 0 0 4 0v-1"/><circle cx="12" cy="11" r="1"/>',
  },
  {
    id: 'ambulance',
    label: 'Emergency',
    path: '<rect x="1" y="3" width="14" height="9" rx="2"/><path d="M7 7h2M8 6v2"/><circle cx="4" cy="12" r="1"/><circle cx="12" cy="12" r="1"/>',
  },
];

export const CAT_ICON_MAP = new Map(CAT_ICONS.map((i) => [i.id, i]));

export function getCatIconIds(): string[] {
  return CAT_ICONS.map((i) => i.id);
}

export function getCatIconSafe(iconId: string | null | undefined): CatIcon | null {
  if (!iconId) return null;
  return CAT_ICON_MAP.get(iconId) ?? null;
}
