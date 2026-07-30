import { collection, doc, setDoc, getDoc, getDocs, onSnapshot, query, where, orderBy, writeBatch, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { Space, Member, SpaceMember, Expense, History, ChatMessage, Notification } from '../types';

export const PUBLIC_SPACE_ID = 'public';
export const PRESET_MEMBERS = ['Avraar', 'Chetan', 'Tenzing', 'Sanajaoba', 'Balbir', 'Dhanaraj'];

export const initializePublicSpace = async (uid: string) => {
  const spaceRef = doc(db, 'spaces', PUBLIC_SPACE_ID);
  const spaceSnap = await getDoc(spaceRef);

  const batch = writeBatch(db);
  let hasWrites = false;

  if (!spaceSnap.exists()) {
    // Create public space
    batch.set(spaceRef, {
      name: 'Public Space',
      type: 'public',
      creatorUid: 'system',
      createdAt: Date.now(),
    });
    hasWrites = true;
  }

  // Check if members exist
  const membersQuery = query(collection(db, 'members'), where('spaceId', '==', PUBLIC_SPACE_ID));
  const membersSnap = await getDocs(membersQuery);
  
  if (membersSnap.empty) {
    // Create preset members
    for (const name of PRESET_MEMBERS) {
      const memberRef = doc(collection(db, 'members'));
      batch.set(memberRef, {
        spaceId: PUBLIC_SPACE_ID,
        name,
        pin: '1234',
        isTemporary: false,
        isPreset: true,
        createdAt: Date.now(),
      });
    }
    hasWrites = true;
  }

  if (hasWrites) {
    await batch.commit();
  }

  // Ensure current user is in spaceMembers for public space
  const memberAccessRef = doc(db, 'spaceMembers', `${PUBLIC_SPACE_ID}_${uid}`);
  const memberAccessSnap = await getDoc(memberAccessRef);
  if (!memberAccessSnap.exists()) {
    await setDoc(memberAccessRef, {
      spaceId: PUBLIC_SPACE_ID,
      uid,
      joinedAt: Date.now(),
    });
  }
};

export const createPrivateSpace = async (name: string, joinPin: string, memberNames: string[], uid: string, creatorMemberName?: string) => {
  const batch = writeBatch(db);
  const spaceRef = doc(collection(db, 'spaces'));
  const spaceId = spaceRef.id;

  const firstMemberName = creatorMemberName || memberNames[0] || '';

  batch.set(spaceRef, {
    name,
    type: 'private',
    joinPin,
    creatorUid: uid,
    creatorMemberName: firstMemberName,
    createdAt: Date.now(),
  });

  const memberAccessRef = doc(db, 'spaceMembers', `${spaceId}_${uid}`);
  batch.set(memberAccessRef, {
    spaceId,
    uid,
    joinedAt: Date.now(),
  });

  for (const memberName of memberNames) {
    if (!memberName.trim()) continue;
    const memberRef = doc(collection(db, 'members'));
    batch.set(memberRef, {
      spaceId,
      name: memberName,
      pin: '1234',
      isTemporary: false,
      createdAt: Date.now(),
    });
  }

  await batch.commit();
  return spaceId;
};

export const joinPrivateSpace = async (spaceId: string, joinPin: string, uid: string) => {
  // Try to get space to verify PIN
  const spaceRef = doc(db, 'spaces', spaceId);
  const spaceSnap = await getDoc(spaceRef);
  
  if (!spaceSnap.exists() || spaceSnap.data().type !== 'private' || spaceSnap.data().joinPin !== joinPin) {
    throw new Error('Invalid Space ID or PIN');
  }

  const memberAccessRef = doc(db, 'spaceMembers', `${spaceId}_${uid}`);
  await setDoc(memberAccessRef, {
    spaceId,
    uid,
    joinedAt: Date.now(),
  });
};
