import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { initializePublicSpace, PUBLIC_SPACE_ID } from '../lib/db';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { Space, Member, SpaceMember } from '../types';

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
  const [spacesAccess, setSpacesAccess] = useState<SpaceMember[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          await initializePublicSpace(currentUser.uid);
        } catch (e) {
          console.error("Failed to init public space", e);
        }
      } else {
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'spaceMembers'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const access: SpaceMember[] = [];
      snapshot.forEach((doc) => access.push({ id: doc.id, ...doc.data() } as SpaceMember));
      setSpacesAccess(access);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user || spacesAccess.length === 0) return;
    
    const spaceIds = spacesAccess.map(sa => sa.spaceId);
    
    const unsubs = spaceIds.map(id => {
       const spaceRef = doc(db, 'spaces', id);
       return onSnapshot(spaceRef, (docSnap) => {
         if (docSnap.exists()) {
           const spaceData = { id: docSnap.id, ...docSnap.data() } as Space;
           setSpaces(prev => {
             const filtered = prev.filter(s => s.id !== docSnap.id);
             return [...filtered, spaceData];
           });
         } else {
           setSpaces(prev => prev.filter(s => s.id !== id));
           if (activeSpaceId === id) {
             setActiveSpaceId(PUBLIC_SPACE_ID);
             setActiveIdentityId(null);
           }
         }
       }, (err) => {
         console.error('Space doc listener error:', err);
       });
    });

    setIsLoading(false);
    return () => unsubs.forEach(unsub => unsub());
  }, [spacesAccess, user]);

  useEffect(() => {
    if (!user || !activeSpaceId) return;
    
    const q = query(collection(db, 'members'), where('spaceId', '==', activeSpaceId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const m: Member[] = [];
      snapshot.forEach(doc => m.push({ id: doc.id, ...doc.data() } as Member));
      setMembers(m);
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
