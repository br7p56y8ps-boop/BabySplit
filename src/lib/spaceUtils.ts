import { Space, Member } from '../types';

export const isMemberCreator = (
  member: Member | undefined | null,
  activeSpace: Space | undefined | null,
  allSpaceMembers: Member[]
): boolean => {
  if (!member || !activeSpace || activeSpace.type !== 'private') return false;

  if (activeSpace.creatorMemberId && member.id === activeSpace.creatorMemberId) return true;

  if (activeSpace.creatorMemberName && member.name.trim().toLowerCase() === activeSpace.creatorMemberName.trim().toLowerCase()) return true;

  if (allSpaceMembers && allSpaceMembers.length > 0) {
    const sorted = [...allSpaceMembers].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    if (sorted[0]?.id === member.id) return true;
  }

  return false;
};

export const isUserSpaceCreator = (
  activeSpace: Space | undefined | null,
  userUid: string | undefined | null,
  activeMember: Member | undefined | null,
  allSpaceMembers: Member[]
): boolean => {
  if (!activeSpace || activeSpace.type !== 'private') return false;

  if (userUid && activeSpace.creatorUid === userUid) return true;

  if (activeMember && isMemberCreator(activeMember, activeSpace, allSpaceMembers)) return true;

  return false;
};
