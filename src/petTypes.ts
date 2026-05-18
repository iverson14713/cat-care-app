export type PetType = 'cat' | 'dog';

export type DailyCheckItem = {
  id: string;
  labelKey: string;
  emoji: string;
};

const DAILY_SHARED_TOP: DailyCheckItem[] = [
  { id: 'feedMorning', labelKey: 'feedMorning', emoji: '🍖' },
  { id: 'feedNight', labelKey: 'feedNight', emoji: '🌙' },
];

const DAILY_CAT_SPECIFIC: DailyCheckItem[] = [
  { id: 'litterMorning', labelKey: 'litterMorning', emoji: '🚽' },
  { id: 'litterNight', labelKey: 'litterNight', emoji: '🧹' },
];

const DAILY_DOG_SPECIFIC: DailyCheckItem[] = [
  { id: 'walkMorning', labelKey: 'walkMorning', emoji: '🦮' },
  { id: 'walkNight', labelKey: 'walkNight', emoji: '🌆' },
];

const DAILY_SHARED_REST: DailyCheckItem[] = [
  { id: 'pee', labelKey: 'pee', emoji: '💧' },
  { id: 'poop', labelKey: 'poop', emoji: '💩' },
  { id: 'waterCan', labelKey: 'waterCan', emoji: '🥫' },
  { id: 'snack', labelKey: 'snack', emoji: '🍪' },
  { id: 'brushHair', labelKey: 'brushHair', emoji: '🪮' },
  { id: 'brushTeeth', labelKey: 'brushTeeth', emoji: '🪥' },
];

export function normalizePetType(value: unknown): PetType {
  return value === 'dog' ? 'dog' : 'cat';
}

export function defaultEmojiForPetType(petType: PetType): string {
  return petType === 'dog' ? '🐶' : '🐱';
}

export function getDailyItemsForPetType(petType: PetType): DailyCheckItem[] {
  const specific = petType === 'dog' ? DAILY_DOG_SPECIFIC : DAILY_CAT_SPECIFIC;
  return [...DAILY_SHARED_TOP, ...specific, ...DAILY_SHARED_REST];
}
