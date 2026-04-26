"use server";

import { adminAuth, adminDb } from "@/lib/firebase/admin";

function validatePassword(password: string): string | null {
  if (password.length < 6) return "Password must be at least 6 characters long.";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must contain at least one special character.";
  return null;
}

export async function createOrResetStaffAuth(input: {
  actorUid: string;
  gymId: string;
  staffId: string;
  email: string;
  password: string;
}) {
  const { actorUid, gymId, staffId, email, password } = input;

  if (!actorUid || !gymId || !staffId || !email || !password) {
    return { success: false, error: "All fields are required." };
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return { success: false, error: passwordError };
  }

  try {
    const actorDoc = await adminDb.collection("admins").doc(actorUid).get();
    if (!actorDoc.exists) {
      return { success: false, error: "Only gym owners or developers can manage staff logins." };
    }

    const actorData = actorDoc.data() as { gymId?: string; role?: string };
    const canManageThisGym = actorData.role === "developer" || (actorData.role === "admin" && actorData.gymId === gymId);
    if (!canManageThisGym) {
      return { success: false, error: "You do not have permission to manage staff logins for this gym." };
    }

    const staffDoc = await adminDb.collection("gyms").doc(gymId).collection("staff").doc(staffId).get();
    if (!staffDoc.exists) {
      return { success: false, error: "Staff profile not found." };
    }

    const staffData = staffDoc.data() as { role?: string; fullName?: string; trainerAuthUid?: string; staffAuthUid?: string };
    if (staffData.role !== "Trainer" && staffData.role !== "Front Desk") {
      return { success: false, error: "Login access can only be created for Trainers or Front Desk staff." };
    }

    let authUserUid = staffData.staffAuthUid || staffData.trainerAuthUid || "";

    if (authUserUid) {
      await adminAuth.updateUser(authUserUid, {
        email,
        password,
        displayName: staffData.fullName || "Trainer",
      });
    } else {
      try {
        const existingUser = await adminAuth.getUserByEmail(email);
        authUserUid = existingUser.uid;
        await adminAuth.updateUser(authUserUid, {
          password,
          displayName: staffData.fullName || existingUser.displayName || "Trainer",
        });
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code && code !== "auth/user-not-found") {
          throw error;
        }

        const createdUser = await adminAuth.createUser({
          email,
          password,
          displayName: staffData.fullName || "Trainer",
        });
        authUserUid = createdUser.uid;
      }
    }

    const now = new Date().toISOString();
    const isTrainer = staffData.role === "Trainer";
    const collectionName = isTrainer ? "trainerAccounts" : "frontDeskAccounts";
    const accountRole = isTrainer ? "trainer" : "front_desk";

    await adminDb.collection(collectionName).doc(authUserUid).set({
      email,
      gymId,
      staffId,
      role: accountRole,
      createdAt: now,
      uid: authUserUid,
    }, { merge: true });

    // for backward compatibility, update trainer fields if it's a trainer, else staff fields
    const updatePayload: Record<string, any> = {
      staffAuthUid: authUserUid,
      staffLoginEmail: email,
      staffLoginEnabled: true,
    };
    
    if (isTrainer) {
      updatePayload.trainerAuthUid = authUserUid;
      updatePayload.trainerLoginEmail = email;
      updatePayload.trainerLoginEnabled = true;
    }

    await adminDb.collection("gyms").doc(gymId).collection("staff").doc(staffId).set(updatePayload, { merge: true });

    return {
      success: true,
      message: (staffData.staffAuthUid || staffData.trainerAuthUid) ? "Staff login password updated." : "Staff login created successfully.",
    };
  } catch (error) {
    console.error("Error creating staff login:", error);
    return { success: false, error: (error as Error).message || "Failed to create staff login." };
  }
}

export async function getTrainerMembers(gymId: string, staffId: string) {
  if (!gymId || !staffId) {
    return { success: false, error: "Gym ID and Staff ID are required." };
  }

  try {
    const membersSnap = await adminDb
      .collection("gyms")
      .doc(gymId)
      .collection("members")
      .where("personalTrainerId", "==", staffId)
      .get();

    const members = membersSnap.docs.map(doc => ({
      memberId: doc.id,
      ...doc.data()
    }));

    return { success: true, members };
  } catch (error) {
    console.error("Error fetching trainer members:", error);
    return { success: false, error: (error as Error).message || "Failed to fetch members." };
  }
}
