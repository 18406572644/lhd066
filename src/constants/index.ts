export const CATEGORY_MAP: Record<string, string> = {
  poster: '海报',
  phone: '手机',
  computer: '电脑',
  packaging: '包装'
}

export const CATEGORIES = [
  { value: 'poster', label: '海报' },
  { value: 'phone', label: '手机' },
  { value: 'computer', label: '电脑' },
  { value: 'packaging', label: '包装' }
]

export function getCategoryLabel(key: string): string {
  return CATEGORY_MAP[key] || key
}

export const SIZE_PRESETS = [
  { label: '1080×1920', w: 1080, h: 1920 },
  { label: '1920×1080', w: 1920, h: 1080 },
  { label: '1080×1080', w: 1080, h: 1080 },
  { label: '750×1334', w: 750, h: 1334 },
  { label: '1440×900', w: 1440, h: 900 },
  { label: '1200×1600', w: 1200, h: 1600 },
]
