import React, { useState, useEffect, createContext, useContext } from 'react';
import { auth, db, firebase } from '../firebase';
import { UserDoc, CandidateDoc, EmployerDoc } from '../types';

export function useAuthStatus() {
  const [currentUser, setCurrentUser] = useState<firebase.User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [roleDoc, setRoleDoc] = useState<CandidateDoc | EmployerDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeUserDoc: (() => void) | null = null;
    let unsubscribeRoleDoc: (() => void) | null = null;

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);

      // Clean up previous subscriptions immediately
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
        unsubscribeUserDoc = null;
      }
      if (unsubscribeRoleDoc) {
        unsubscribeRoleDoc();
        unsubscribeRoleDoc = null;
      }

      if (user) {
        setLoading(true);
        // Subscribe to user doc
        unsubscribeUserDoc = db.collection('users').doc(user.uid).onSnapshot((uSnap) => {
          if (uSnap.exists) {
            const uData = uSnap.data() as UserDoc;
            setUserDoc(uData);

            // Clean up previous role subscription if any
            if (unsubscribeRoleDoc) {
              unsubscribeRoleDoc();
              unsubscribeRoleDoc = null;
            }

            // Subscribe to candidate/employer doc based on role
            if (uData.role === 'candidate') {
              unsubscribeRoleDoc = db.collection('candidates').doc(user.uid).onSnapshot((cSnap) => {
                if (cSnap.exists) {
                  setRoleDoc(cSnap.data() as CandidateDoc);
                } else {
                  setRoleDoc(null);
                }
              });
            } else if (uData.role === 'employer') {
              unsubscribeRoleDoc = db.collection('employers').doc(user.uid).onSnapshot((eSnap) => {
                if (eSnap.exists) {
                  setRoleDoc(eSnap.data() as EmployerDoc);
                } else {
                  setRoleDoc(null);
                }
              });
            } else {
              setRoleDoc(null);
            }
            setLoading(false);
          } else {
            // User exists in Firebase Auth but user doc is not created in Firestore yet
            setUserDoc(null);
            setRoleDoc(null);
            setLoading(false);
          }
        }, (err) => {
          console.error('Error listening to user document:', err);
          setLoading(false);
        });
      } else {
        setUserDoc(null);
        setRoleDoc(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUserDoc) unsubscribeUserDoc();
      if (unsubscribeRoleDoc) unsubscribeRoleDoc();
    };
  }, []);

  return {
    currentUser,
    userDoc,
    roleDoc,
    loading,
    refetchRoleDoc: async () => {
      if (!currentUser || !userDoc) return;
      if (userDoc.role === 'candidate') {
        const cSnap = await db.collection('candidates').doc(currentUser.uid).get();
        if (cSnap.exists) setRoleDoc(cSnap.data() as CandidateDoc);
      } else if (userDoc.role === 'employer') {
        const eSnap = await db.collection('employers').doc(currentUser.uid).get();
        if (eSnap.exists) setRoleDoc(eSnap.data() as EmployerDoc);
      }
    }
  };
}

export const AuthContext = createContext<ReturnType<typeof useAuthStatus> | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
