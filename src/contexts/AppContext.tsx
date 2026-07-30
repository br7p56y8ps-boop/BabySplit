import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Space, Member, PUBLIC_SPACE_ID } from '../types';

interface AppContextType {
  user: User | null;
  spaces: Space[];
  activeSpaceId: string;
  setActiveSpaceId: (id: string) => void;
  activeSpace: Space | undefined;
  members: Member[];
  isLoading: boolean;
  activeIdentityId: string | null;
  setActiveIdentityId: (id: string | null) => void;
  activeMember: Member | undefined;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [activeSpaceId, setActiveSpaceId] = useState<string>(PUBLIC_SPACE_ID);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Listen to ALL spaces in Firestore so every device/member receives spaces in real-time
    const unsubscribe = onSnapshot(
      collection(db, 'spaces'),
      (snapshot) => {
        const loadedSpaces: Space[] = [];
        snapshot.forEach((doc) => {
          loadedSpaces.push({ id: doc.id, ...doc.data() } as Space);
        });

        // Ensure Public Space stays at the top, followed by Private Spaces sorted by createdAt
        loadedSpaces.sort((a, b) => {
          if (a.id === PUBLIC_SPACE_ID) return -1;
          if (b.id === PUBLIC_SPACE_ID) return 1;
          return (a.createdAt || 0) - (b.createdAt || 0);
        });

        setSpaces(loadedSpaces);
        setIsLoading(false);

        // If active space no longer exists, reset to public space
        if (activeSpaceId !== PUBLIC_SPACE_ID && !loadedSpaces.some(s => s.id === activeSpaceId)) {
          setActiveSpaceId(PUBLIC_SPACE_ID);
          setActiveIdentityId(null);
        }
      },
      (err) => {
        console.error('Spaces real-time listener error:', err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, activeSpaceId]);

  useEffect(() => {
    if (!user || !activeSpaceId) return;

    const q = query(collection(db, 'members'), where('spaceId', '==', activeSpaceId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedMembers: Member[] = [];
      snapshot.forEach((doc) => {
        loadedMembers.push({ id: doc.id, ...doc.data() } as Member);
      });
      setMembers(loadedMembers);
    });

    return () => unsubscribe();
  }, [user, activeSpaceId]);

  const activeSpace = spaces.find(s => s.id === activeSpaceId) || {
    id: PUBLIC_SPACE_ID,
    name: 'Public Space',
    type: 'public',
    createdAt: 0,
    createdByUid: 'system',
  };

  const [activeIdentityId, setActiveIdentityIdState] = useState<string | null>(() => {
    return localStorage.getItem(`identity_${activeSpaceId}`);
  });

  useEffect(() => {
    const savedIdentity = localStorage.getItem(`identity_${activeSpaceId}`);
    if (savedIdentity && members.some(m => m.id === savedIdentity)) {
      setActiveIdentityIdState(savedIdentity);
    } else {
      setActiveIdentityIdState(null);
    }
  }, [activeSpaceId, members]);

  const setActiveIdentityId = (id: string | null) => {
    setActiveIdentityIdState(id);
    if (id) {
      localStorage.setItem(`identity_${activeSpaceId}`, id);
    } else {
      localStorage.removeItem(`identity_${activeSpaceId}`);
    }
  };

  const activeMember = members.find(m => m.id === activeIdentityId);

  return (
    <AppContext.Provider value={{
      user,
      spaces,
      activeSpaceId,
      setActiveSpaceId,
      activeSpace,
      members,
      isLoading,
      activeIdentityId,
      setActiveIdentityId,
      activeMember,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};