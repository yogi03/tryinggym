"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut, 
  User as FirebaseUser,
  signInWithPopup,
  GoogleAuthProvider 
} from "firebase/auth";
import { auth, db } from "@/lib/firebase/config";
import { doc, getDoc, collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { Admin, Gym, TrainerAccount, FrontDeskAccount } from "@/types";

type ScopedGym = Pick<Gym, "gymId" | "name" | "logoUrl">;

interface AuthContextType {
  user: FirebaseUser | null;
  adminData: Admin | null;
  trainerData: TrainerAccount | null;
  frontDeskData: FrontDeskAccount | null;
  loading: boolean;
  isAdmin: boolean;
  isDeveloper: boolean;
  isTrainer: boolean;
  isFrontDesk: boolean;
  availableGyms: ScopedGym[];
  activeGymId: string | null;
  activeGym: Gym | null;
  setActiveGymId: (gymId: string) => void;
  loginAsAdmin: (email: string, pass: string) => Promise<void>;
  loginAsDeveloper: (email: string, pass: string) => Promise<void>;
  loginAsTrainer: (email: string, pass: string) => Promise<TrainerAccount>;
  loginAsFrontDesk: (email: string, pass: string) => Promise<FrontDeskAccount>;
  loginWithGoogle: (promptSelectAccount?: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [baseAdminData, setBaseAdminData] = useState<Admin | null>(null);
  const [trainerData, setTrainerData] = useState<TrainerAccount | null>(null);
  const [frontDeskData, setFrontDeskData] = useState<FrontDeskAccount | null>(null);
  const [availableGyms, setAvailableGyms] = useState<ScopedGym[]>([]);
  const [activeGymId, setActiveGymIdState] = useState<string | null>(null);
  const [activeGym, setActiveGym] = useState<Gym | null>(null);
  const [loading, setLoading] = useState(true);

  const setActiveGymId = (gymId: string) => {
    setActiveGymIdState(gymId);
    if (typeof window !== "undefined" && user?.uid) {
      window.localStorage.setItem(`developer-active-gym:${user.uid}`, gymId);
    }
  };

  useEffect(() => {
    if (!activeGymId) {
      setActiveGym(null);
      return;
    }

    const unsub = onSnapshot(doc(db, "gyms", activeGymId), (snapshot) => {
      if (snapshot.exists()) {
        setActiveGym({ gymId: activeGymId, ...snapshot.data() } as Gym);
      } else {
        setActiveGym(null);
      }
    }, (err) => {
      console.error("Error fetching active gym:", err);
    });

    return () => unsub();
  }, [activeGymId]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        setUser(firebaseUser);
        
        if (firebaseUser) {
          let nextAdminData: Admin | null = null;
          let nextTrainerData: TrainerAccount | null = null;
          let nextFrontDeskData: FrontDeskAccount | null = null;

          // Check if user is an admin - Fetch by UID
          const adminDocRef = doc(db, "admins", firebaseUser.uid);
          const adminSnapshot = await getDoc(adminDocRef);
          
          if (adminSnapshot.exists()) {
            nextAdminData = { adminId: adminSnapshot.id, ...adminSnapshot.data() } as Admin;
          } else {
            // Fallback check by email (for legacy or manual entries)
            try {
              const adminsRef = collection(db, "admins");
              const q = query(adminsRef, where("email", "==", firebaseUser.email));
              const querySnapshot = await getDocs(q);
              
              if (!querySnapshot.empty) {
                const adminDoc = querySnapshot.docs[0];
                nextAdminData = { adminId: adminDoc.id, ...adminDoc.data() } as Admin;
              } else {
                nextAdminData = null;
              }
            } catch (fallbackError) {
              console.warn("Could not query admins by email:", fallbackError);
              nextAdminData = null;
            }
          }

          setBaseAdminData(nextAdminData);

          if (nextAdminData?.role === "developer") {
            const gymsSnapshot = await getDocs(collection(db, "gyms"));
            const gyms = gymsSnapshot.docs
              .map((gymDoc) => ({ gymId: gymDoc.id, name: String(gymDoc.data().name || gymDoc.id) }))
              .sort((a, b) => a.name.localeCompare(b.name));

            setAvailableGyms(gyms);

            const storedGymId = typeof window !== "undefined"
              ? window.localStorage.getItem(`developer-active-gym:${firebaseUser.uid}`)
              : null;
            const fallbackGymId = gyms[0]?.gymId || nextAdminData.gymId || null;
            const nextGymId = gyms.some((gym) => gym.gymId === storedGymId) ? storedGymId : fallbackGymId;
            setActiveGymIdState(nextGymId);
            setTrainerData(null);
            setFrontDeskData(null);
          } else {
            if (!nextAdminData) {
              const trainerDocRef = doc(db, "trainerAccounts", firebaseUser.uid);
              const trainerSnapshot = await getDoc(trainerDocRef);

              if (trainerSnapshot.exists()) {
                nextTrainerData = { trainerAccountId: trainerSnapshot.id, ...trainerSnapshot.data() } as TrainerAccount;
              } else {
                try {
                  const trainerAccountsRef = collection(db, "trainerAccounts");
                  const trainerQuery = query(trainerAccountsRef, where("email", "==", firebaseUser.email));
                  const trainerQuerySnapshot = await getDocs(trainerQuery);

                  if (!trainerQuerySnapshot.empty) {
                    const trainerDoc = trainerQuerySnapshot.docs[0];
                    nextTrainerData = { trainerAccountId: trainerDoc.id, ...trainerDoc.data() } as TrainerAccount;
                  }
                } catch (trainerFallbackError) {
                  console.warn("Could not query trainers by email:", trainerFallbackError);
                }
              }

              if (!nextTrainerData) {
                // Check if user is front desk
                const frontDeskDocRef = doc(db, "frontDeskAccounts", firebaseUser.uid);
                const frontDeskSnapshot = await getDoc(frontDeskDocRef);

                if (frontDeskSnapshot.exists()) {
                  nextFrontDeskData = { frontDeskAccountId: frontDeskSnapshot.id, ...frontDeskSnapshot.data() } as FrontDeskAccount;
                } else {
                  try {
                    const frontDeskAccountsRef = collection(db, "frontDeskAccounts");
                    const frontDeskQuery = query(frontDeskAccountsRef, where("email", "==", firebaseUser.email));
                    const frontDeskQuerySnapshot = await getDocs(frontDeskQuery);

                    if (!frontDeskQuerySnapshot.empty) {
                      const fdDoc = frontDeskQuerySnapshot.docs[0];
                      nextFrontDeskData = { frontDeskAccountId: fdDoc.id, ...fdDoc.data() } as FrontDeskAccount;
                    }
                  } catch (fdFallbackError) {
                    console.warn("Could not query front desk by email:", fdFallbackError);
                  }
                }
              }
            }

            setAvailableGyms([]);
            setActiveGymIdState(nextAdminData?.gymId || nextTrainerData?.gymId || nextFrontDeskData?.gymId || null);
            setTrainerData(nextTrainerData);
            setFrontDeskData(nextFrontDeskData);
          }
        } else {
          setBaseAdminData(null);
          setTrainerData(null);
          setFrontDeskData(null);
          setAvailableGyms([]);
          setActiveGymIdState(null);
        }
      } catch (error) {
        console.error("Error in auth state change:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const loginAsAdmin = async (email: string, pass: string) => {
    await loginWithRole(email, pass, "admin");
  };

  const loginAsDeveloper = async (email: string, pass: string) => {
    await loginWithRole(email, pass, "developer");
  };

  const loginAsTrainer = async (email: string, pass: string): Promise<TrainerAccount> => {
    const userCredential = await signInWithEmailAndPassword(auth, email, pass);
    const firebaseUser = userCredential.user;

    const trainerDocRef = doc(db, "trainerAccounts", firebaseUser.uid);
    const trainerSnapshot = await getDoc(trainerDocRef);

    let matchedTrainer: TrainerAccount | null = null;

    if (trainerSnapshot.exists()) {
      matchedTrainer = { trainerAccountId: trainerSnapshot.id, ...trainerSnapshot.data() } as TrainerAccount;
    } else {
      const trainerAccountsRef = collection(db, "trainerAccounts");
      const trainerQuery = query(trainerAccountsRef, where("email", "==", email));
      const trainerQuerySnapshot = await getDocs(trainerQuery);

      if (!trainerQuerySnapshot.empty) {
        const trainerDoc = trainerQuerySnapshot.docs[0];
        matchedTrainer = { trainerAccountId: trainerDoc.id, ...trainerDoc.data() } as TrainerAccount;
      }
    }

    if (!matchedTrainer || matchedTrainer.role !== "trainer") {
      await signOut(auth);
      throw new Error("This account is not registered as a trainer.");
    }

    return matchedTrainer;
  };

  const loginAsFrontDesk = async (email: string, pass: string): Promise<FrontDeskAccount> => {
    const userCredential = await signInWithEmailAndPassword(auth, email, pass);
    const firebaseUser = userCredential.user;

    const fdDocRef = doc(db, "frontDeskAccounts", firebaseUser.uid);
    const fdSnapshot = await getDoc(fdDocRef);

    let matchedFD: FrontDeskAccount | null = null;

    if (fdSnapshot.exists()) {
      matchedFD = { frontDeskAccountId: fdSnapshot.id, ...fdSnapshot.data() } as FrontDeskAccount;
    } else {
      const fdAccountsRef = collection(db, "frontDeskAccounts");
      const fdQuery = query(fdAccountsRef, where("email", "==", email));
      const fdQuerySnapshot = await getDocs(fdQuery);

      if (!fdQuerySnapshot.empty) {
        const fdDoc = fdQuerySnapshot.docs[0];
        matchedFD = { frontDeskAccountId: fdDoc.id, ...fdDoc.data() } as FrontDeskAccount;
      }
    }

    if (!matchedFD || matchedFD.role !== "front_desk") {
      await signOut(auth);
      throw new Error("This account is not registered as Front Desk staff.");
    }

    return matchedFD;
  };

  const loginWithRole = async (email: string, pass: string, expectedRole: Admin["role"]) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, pass);
    const firebaseUser = userCredential.user;

    const adminDocRef = doc(db, "admins", firebaseUser.uid);
    const adminSnapshot = await getDoc(adminDocRef);

    let matchedAdmin: Admin | null = null;

    if (adminSnapshot.exists()) {
      matchedAdmin = { adminId: adminSnapshot.id, ...adminSnapshot.data() } as Admin;
    } else {
      const adminsRef = collection(db, "admins");
      const q = query(adminsRef, where("email", "==", email));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const adminDoc = querySnapshot.docs[0];
        matchedAdmin = { adminId: adminDoc.id, ...adminDoc.data() } as Admin;
      }
    }

    if (!matchedAdmin) {
      await signOut(auth);
      throw new Error("Access denied. You are not registered as an admin.");
    }

    if (matchedAdmin.role !== expectedRole) {
      await signOut(auth);
      throw new Error(
        expectedRole === "developer"
          ? "This account is not registered as a developer."
          : "This account is not registered as a gym admin."
      );
    }
  };

  const loginWithGoogle = async (promptSelectAccount = false) => {
    const provider = new GoogleAuthProvider();
    if (promptSelectAccount) {
      provider.setCustomParameters({ prompt: 'select_account' });
    }
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const adminData = useMemo(() => {
    if (!baseAdminData) return null;

    if (baseAdminData.role === "developer") {
      if (!activeGymId) return null;
      return {
        ...baseAdminData,
        gymId: activeGymId,
      };
    }

    return baseAdminData;
  }, [baseAdminData, activeGymId]);

  return (
    <AuthContext.Provider value={{ 
      user, 
      adminData, 
      trainerData,
      frontDeskData,
      loading, 
      isAdmin: !!adminData,
      isDeveloper: adminData?.role === "developer",
      isTrainer: trainerData?.role === "trainer",
      isFrontDesk: frontDeskData?.role === "front_desk",
      availableGyms,
      activeGymId,
      activeGym,
      setActiveGymId,
      loginAsAdmin,
      loginAsDeveloper,
      loginAsTrainer,
      loginAsFrontDesk,
      loginWithGoogle,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
