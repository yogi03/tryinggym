import { db } from "@/lib/firebase/config";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  writeBatch,
} from "firebase/firestore";
import { Member, Gym, Staff } from "@/types";

/**
 * Archives a single member before deleting them.
 * Saves at: archives/{gymId}/members/{memberId}
 * Uses a batched write so archive + delete are atomic.
 */
export async function archiveMember(
  gymId: string,
  memberId: string,
  adminUid: string
): Promise<void> {
  const memberRef = doc(db, "gyms", gymId, "members", memberId);
  const memberSnap = await getDoc(memberRef);

  if (!memberSnap.exists()) {
    throw new Error("Member not found");
  }

  const memberData = memberSnap.data() as Member;

  const batch = writeBatch(db);

  // 1. Write to archives/{gymId}/members/{memberId}
  const archiveRef = doc(db, "archives", gymId, "members", memberId);
  batch.set(archiveRef, {
    ...memberData,
    memberId,
    originalGymId: gymId,
    archivedAt: new Date().toISOString(),
    archivedBy: adminUid,
    archiveType: "member",
  });

  // 2. Delete the original
  batch.delete(memberRef);

  await batch.commit();
}

/**
 * Archives an entire gym (with all members) before deleting.
 * Saves gym doc at: archives/{gymId}
 * Saves each member at: archives/{gymId}/members/{memberId}
 * Uses a batched write so everything is atomic.
 */
export async function archiveGym(
  gymId: string,
  adminUid: string
): Promise<void> {
  const gymRef = doc(db, "gyms", gymId);
  const gymSnap = await getDoc(gymRef);

  if (!gymSnap.exists()) {
    throw new Error("Gym not found");
  }

  const gymData = gymSnap.data() as Gym;

  // Fetch all members
  const membersSnap = await getDocs(collection(db, "gyms", gymId, "members"));
  const membersData = membersSnap.docs.map((d) => ({
    memberId: d.id,
    ...d.data(),
  })) as Member[];

  const batch = writeBatch(db);

  // 1. Write gym snapshot to archives/{gymId}
  const archiveGymRef = doc(db, "archives", gymId);
  batch.set(archiveGymRef, {
    ...gymData,
    gymId,
    archivedAt: new Date().toISOString(),
    archivedBy: adminUid,
    archiveType: "gym",
  });

  // 2. Write each member to archives/{gymId}/members/{memberId}
  membersData.forEach((member) => {
    const archiveMemberRef = doc(db, "archives", gymId, "members", member.memberId);
    batch.set(archiveMemberRef, {
      ...member,
      archivedAt: new Date().toISOString(),
      archivedBy: adminUid,
      archiveType: "member",
    });
  });

  // 3. Delete all member docs
  membersSnap.docs.forEach((memberDoc) => {
    batch.delete(memberDoc.ref);
  });

  // 4. Delete the gym doc
  batch.delete(gymRef);

  await batch.commit();
}

/**
 * Archives a single staff member before deleting them.
 * Saves at: archives/{gymId}/staff/{staffId}
 */
export async function archiveStaff(
  gymId: string,
  staffId: string,
  adminUid: string
): Promise<void> {
  const staffRef = doc(db, "gyms", gymId, "staff", staffId);
  const staffSnap = await getDoc(staffRef);

  if (!staffSnap.exists()) {
    throw new Error("Staff member not found");
  }

  const staffData = staffSnap.data() as Staff;
  const batch = writeBatch(db);

  // 1. Write to archives/{gymId}/staff/{staffId}
  const archiveRef = doc(db, "archives", gymId, "staff", staffId);
  batch.set(archiveRef, {
    ...staffData,
    staffId,
    originalGymId: gymId,
    archivedAt: new Date().toISOString(),
    archivedBy: adminUid,
    archiveType: "staff",
  });

  // 2. Delete the original
  batch.delete(staffRef);

  await batch.commit();
}
