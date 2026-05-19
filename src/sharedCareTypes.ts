export type SharedCareRole = 'owner' | 'member';

export type SharedCareMember = {
  userId: string;
  displayName: string;
  role: SharedCareRole;
};

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i += 1) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}
