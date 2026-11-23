export interface ProductVisual {
  gradient: string;
  accentText: string;
  badgeBg: string;
  emoji: string;
  tag: string;
}

export function getProductVisual(
  categoryId?: number,
  productName?: string,
): ProductVisual {
  const name = (productName || '').toLowerCase();

  if (
    name.includes('iphone') ||
    name.includes('galaxy') ||
    name.includes('pixel') ||
    categoryId === 2
  ) {
    return {
      gradient: 'from-indigo-600 via-blue-600 to-cyan-500',
      accentText: 'text-indigo-600',
      badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      emoji: '📱',
      tag: 'Flagship 5G',
    };
  }

  if (
    name.includes('macbook') ||
    name.includes('dell') ||
    name.includes('thinkpad') ||
    categoryId === 3
  ) {
    return {
      gradient: 'from-slate-800 via-indigo-900 to-slate-900',
      accentText: 'text-slate-800',
      badgeBg: 'bg-slate-100 text-slate-800 border-slate-200',
      emoji: '💻',
      tag: 'Pro Workstation',
    };
  }

  if (
    name.includes('headphone') ||
    name.includes('airpods') ||
    name.includes('sony') ||
    categoryId === 1
  ) {
    return {
      gradient: 'from-violet-600 via-purple-600 to-fuchsia-500',
      accentText: 'text-violet-600',
      badgeBg: 'bg-violet-50 text-violet-700 border-violet-200',
      emoji: '🎧',
      tag: 'Hi-Res Audio',
    };
  }

  if (
    name.includes('dress') ||
    name.includes('coat') ||
    name.includes('trousers') ||
    categoryId === 6
  ) {
    return {
      gradient: 'from-rose-500 via-pink-500 to-amber-400',
      accentText: 'text-rose-600',
      badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
      emoji: '👗',
      tag: 'Luxury Collection',
    };
  }

  if (
    name.includes('shirt') ||
    name.includes('jeans') ||
    name.includes('jacket') ||
    categoryId === 5 ||
    categoryId === 4
  ) {
    return {
      gradient: 'from-amber-600 via-orange-500 to-rose-500',
      accentText: 'text-amber-700',
      badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
      emoji: '🧥',
      tag: 'Premium Apparel',
    };
  }

  if (
    name.includes('book') ||
    name.includes('data') ||
    name.includes('clean code') ||
    name.includes('system') ||
    categoryId === 8
  ) {
    return {
      gradient: 'from-emerald-600 via-teal-600 to-cyan-600',
      accentText: 'text-emerald-700',
      badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      emoji: '📚',
      tag: 'Bestseller Book',
    };
  }

  if (
    name.includes('shoe') ||
    name.includes('yoga') ||
    name.includes('dumbbell')
  ) {
    return {
      gradient: 'from-lime-600 via-emerald-500 to-teal-500',
      accentText: 'text-emerald-600',
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      emoji: '👟',
      tag: 'Pro Athletics',
    };
  }

  return {
    gradient: 'from-sky-600 via-cyan-600 to-teal-500',
    accentText: 'text-sky-700',
    badgeBg: 'bg-sky-50 text-sky-700 border-sky-200',
    emoji: '🏠',
    tag: 'Smart Living',
  };
}
