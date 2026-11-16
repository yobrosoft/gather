export function churchOwnerIds(church: { ownerIds?: string[]; leaderUserId?: string }): string[] {
  if (church.ownerIds && church.ownerIds.length > 0) return church.ownerIds;
  if (church.leaderUserId) return [church.leaderUserId];
  return [];
}

export function isChurchOwner(church: { ownerIds?: string[]; leaderUserId?: string }, userId: string): boolean {
  return churchOwnerIds(church).includes(userId);
}
