"use server";

import { adminDb } from "@/lib/firebase/admin";
import { generateMemberId } from "@/lib/member-id";
import { addExactMonths, formatDateOnly } from "@/lib/utils";

export async function deleteGymWithArchive(gymId: string, adminUid: string) {
  if (!gymId) {
    return { success: false, error: "Invalid gym ID." };
  }

  try {
    // Fetch gym
    const gymRef = adminDb.collection("gyms").doc(gymId);
    const gymDoc = await gymRef.get();

    if (!gymDoc.exists) {
      return { success: false, error: "Gym not found." };
    }

    const gymData = gymDoc.data();

    // Fetch all members
    const membersSnap = await adminDb.collection("gyms").doc(gymId).collection("members").get();

    const batch = adminDb.batch();

    // 1. Archive gym doc at archives/{gymId}
    const archiveGymRef = adminDb.collection("archives").doc(gymId);
    batch.set(archiveGymRef, {
      ...gymData,
      gymId,
      archivedAt: new Date().toISOString(),
      archivedBy: adminUid,
      archiveType: "gym",
    });

    // 2. Archive each member at archives/{gymId}/members/{memberId}
    membersSnap.docs.forEach((memberDoc) => {
      const archiveMemberRef = adminDb.collection("archives").doc(gymId).collection("members").doc(memberDoc.id);
      batch.set(archiveMemberRef, {
        ...memberDoc.data(),
        memberId: memberDoc.id,
        archivedAt: new Date().toISOString(),
        archivedBy: adminUid,
        archiveType: "member",
      });
    });

    // 3. Delete all members
    membersSnap.docs.forEach((memberDoc) => {
      batch.delete(memberDoc.ref);
    });

    // 4. Delete admin doc
    const adminsSnap = await adminDb.collection("admins").where("gymId", "==", gymId).get();
    adminsSnap.docs.forEach((adminDoc) => {
      batch.delete(adminDoc.ref);
    });

    // 5. Delete gym doc
    batch.delete(gymRef);

    await batch.commit();

    return { success: true };
  } catch (error) {
    console.error("Error deleting gym:", error);
    return { success: false, error: (error as Error).message || "Failed to delete gym." };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function importMembersBulk(gymId: string, members: any[]) {
  if (!gymId || !Array.isArray(members)) return { success: false, error: "Invalid data." };
  
  try {
    const membersRef = adminDb.collection("gyms").doc(gymId).collection("members");
    const paymentsRef = adminDb.collection("gyms").doc(gymId).collection("payments");
    
    // Fetch existing member phones to skip duplicates within the gym
    const snapshot = await membersRef.get();
    const existingPhones = new Set(snapshot.docs.map(doc => doc.data().phone));

    const finalMembers = members.filter(m => {
      const phone = String(m.phone || "").replace(/\D/g, "");
      // Allow only 10-digit numbers and skip if already exists
      return phone.length === 10 && !existingPhones.has(phone);
    });

    if (finalMembers.length === 0) {
      return { success: true, count: 0, message: "No new unique members found to import." };
    }

    const chunkSize = 200; // Lower chunk size due to adding 2 docs per member (member + payment) to stay safely under firestore limits
    for (let i = 0; i < finalMembers.length; i += chunkSize) {
      const chunk = finalMembers.slice(i, i + chunkSize);
      const batch = adminDb.batch();
      
      chunk.forEach(memberData => {
        let memberId = memberData.memberId;
        if (!memberId) {
          memberId = generateMemberId(memberData.fullName, memberData.phone);
        }
        
        const docRef = membersRef.doc(memberId);
        // Use membership start date at 12:00 AM for createdAt to support historical analytics
        const startDateStr = memberData.membershipStartDate;
        const createdAt = startDateStr ? `${startDateStr}T00:00:00Z` : new Date().toISOString();
        
        // Calculate End Date if not provided or to ensure registration parity
        let endDate = memberData.membershipEndDate;
        if (!endDate) {
          const startDate = new Date(memberData.membershipStartDate);
          let durationMonths = 0;
          let durationDays = 0;

          const mType = (memberData.membershipType || "monthly").toLowerCase();
          if (mType === "monthly") durationMonths = 1;
          else if (mType === "quarterly") durationMonths = 3;
          else if (mType === "half-yearly") durationMonths = 6;
          else if (mType === "yearly") durationMonths = 12;
          else if (mType === "trial") durationDays = 1;
          else if (mType === "other") {
            durationMonths = parseInt(memberData.customMonths) || 1;
          }

          const calculatedEnd = durationMonths > 0
            ? addExactMonths(memberData.membershipStartDate, durationMonths)
            : new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + durationDays);
          endDate = formatDateOnly(calculatedEnd);
        }

        const initialPlan = {
          planType: memberData.membershipType || "monthly",
          startDate: memberData.membershipStartDate,
          endDate: endDate,
          amountPaid: Number(memberData.feesPaid) || 0,
          trainingType: memberData.trainingType || "general",
          personalTrainerId: null,
          withGst: false,
        };

        // Remove temporary helper fields before saving to Firestore
        const { customMonths, ...cleanMemberData } = memberData;

        batch.set(docRef, {
          ...cleanMemberData,
          memberId,
          gymId,
          membershipEndDate: endDate,
          isAcknowledged: false,
          photoUrl: "",
          planHistory: [initialPlan],
          createdAt
        });

        if (Number(memberData.feesPaid) > 0) {
          const paymentDocRef = paymentsRef.doc();
          const invoiceId = `INV-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 1000)}`;
          batch.set(paymentDocRef, {
            memberId,
            amount: Number(memberData.feesPaid),
            date: createdAt,
            type: "joining_fee",
            invoiceId,
            planType: memberData.membershipType || "monthly",
            startDate: memberData.membershipStartDate,
            endDate: endDate,
            withGst: false,
          });
        }
      });
      
      await batch.commit();
    }
    
    return { success: true, count: finalMembers.length };
  } catch (error) {
    console.error("Bulk import error:", error);
    return { success: false, error: (error as Error).message || "Failed to import members." };
  }
}

export async function fetchGoogleSheetCsv(url: string) {
  try {
    const match = url.match(/\/d\/(.*?)(\/|$)/);
    if (!match || !match[1]) {
      return { success: false, error: "Invalid Google Sheets URL. Could not find document ID." };
    }
    const sheetId = match[1];
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    
    const res = await fetch(csvUrl);
    if (!res.ok) {
      return { success: false, error: `Failed to fetch from Google Sheets. Ensure it is public. Status: ${res.status}` };
    }
    const text = await res.text();
    if (text.trim().toLowerCase().startsWith("<!doctype html>")) {
      return { success: false, error: "Google Sheet is not public. Please change link sharing to 'Anyone with the link can view'." };
    }
    return { success: true, csv: text };
  } catch (error) {
    console.error("Fetch sheet error:", error);
    return { success: false, error: "Failed to fetch Google Sheet." };
  }
}

export async function updateGymSettings(gymId: string, data: any) {
  if (!gymId) return { success: false, error: "Invalid gym ID." };
  
  try {
    const updateData: any = { ...data, updatedAt: new Date().toISOString() };
    await adminDb.collection("gyms").doc(gymId).update(updateData);
    return { success: true };
  } catch (error) {
    console.error("Update gym settings error:", error);
    return { success: false, error: (error as Error).message || "Failed to update gym settings." };
  }
}

export async function verifyGSTStatus(gymId: string, status: 'validated' | 'rejected') {
  if (!gymId) return { success: false, error: "Invalid gym ID." };
  
  try {
    await adminDb.collection("gyms").doc(gymId).update({
      gstStatus: status,
      updatedAt: new Date().toISOString()
    });
    return { success: true };
  } catch (error) {
    console.error("Verify GST status error:", error);
    return { success: false, error: (error as Error).message || "Failed to verify GST status." };
  }
}

export async function updateGymLogo(gymId: string, logoUrl: string) {
  if (!gymId) return { success: false, error: "Invalid gym ID." };
  
  try {
    await adminDb.collection("gyms").doc(gymId).update({
      logoUrl,
      updatedAt: new Date().toISOString()
    });
    return { success: true };
  } catch (error) {
    console.error("Update gym logo error:", error);
    return { success: false, error: (error as Error).message || "Failed to update gym logo." };
  }
}
