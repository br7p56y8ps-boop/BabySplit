import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { initializePublicSpace } from '../lib/db';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { Space, Member, SpaceMember, PUBLIC_SPACE_ID } from '../types';

interface AppContextType {
  user: User | null;
  activeSpaceId: string;
  setActiveSpaceId: (id: string) => void;
  activeIdentityId: string | null;
  setActiveIdentityId: (id: string | null) => void;
  spaces: Space[];
  members: Member[];
  isLoading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [activeSpaceId, setActiveSpaceId] = useState<string>(PUBLIC_SPACE_ID);
  const [activeIdentityId, setActiveIdentityId] = useState<string | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      let activeUser = currentUser;
      if (!activeUser) {
        let fallbackUid = localStorage.getItem('babysplit_anonymous_uid');
        if (!fallbackUid) {
          fallbackUid = 'anon_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
          localStorage.setItem('babysplit_anonymous_uid', fallbackUid);
        }
        activeUser = { uid: fallbackUid } as User;
      }

      setUser(activeUser);
      try {
        await initializePublicSpace(activeUser.uid);
      } catch (e) {
        console.error("Failed to init public space", e);
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

        if (!loadedSpaces.some(s => s.id === PUBLIC_SPACE_ID) && user) {
          initializePublicSpace(user.uid);
        }

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
      const m: Member[] = [];
      snapshot.forEach(doc => m.push({ id: doc.id, ...doc.data() } as Member));
      setMembers(m);

      if (activeSpaceId === PUBLIC_SPACE_ID && snapshot.empty && user) {
        initializePublicSpace(user.uid);
      }
    });
    return () => unsubscribe();
  }, [activeSpaceId, user]);

  // Load active identity from localStorage when space changes
  useEffect(() => {
    const savedIdentity = localStorage.getItem(`identity_${activeSpaceId}`);
    if (savedIdentity) {
      setActiveIdentityId(savedIdentity);
    } else {
      setActiveIdentityId(null);
    }
  }, [activeSpaceId]);

  const handleSetIdentity = (id: string | null) => {
    setActiveIdentityId(id);
    if (id) {
      localStorage.setItem(`identity_${activeSpaceId}`, id);
    } else {
      localStorage.removeItem(`identity_${activeSpaceId}`);
    }
  };

  return (
    <AppContext.Provider value={{
      user,
      activeSpaceId,
      setActiveSpaceId,
      activeIdentityId,
      setActiveIdentityId: handleSetIdentity,
      spaces,
      members,
      isLoading
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};
