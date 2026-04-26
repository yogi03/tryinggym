import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Ensure admin is initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

function formatPin(pin: number): string {
  return pin.toString().padStart(8, "0");
}

export const onMemberCreated = functions.firestore
  .document("gyms/{gymId}/members/{memberId}")
  .onCreate(async (snap, context) => {
    const { gymId } = context.params;
    const memberData = snap.data();
    
    if (memberData.devicePin) {
      return null; // Already has a pin
    }

    const gymRef = db.collection("gyms").doc(gymId);

    try {
      const devicePin = await db.runTransaction(async (transaction) => {
        const gymDoc = await transaction.get(gymRef);
        const gymData = gymDoc.data();
        
        let lastPin = gymData?.lastDevicePin || 0;
        const newPin = lastPin + 1;
        
        transaction.update(gymRef, { lastDevicePin: newPin });
        transaction.update(snap.ref, { devicePin: newPin });
        
        return newPin;
      });

      const devicesSnap = await gymRef.collection("biometricDevices").get();
      const batch = db.batch();

      devicesSnap.docs.forEach((deviceDoc) => {
        const commandRef = deviceDoc.ref.collection("deviceCommands").doc();
        batch.set(commandRef, {
          type: "CREATE_USER",
          pin: formatPin(devicePin),
          name: memberData.fullName || "Unknown",
          validFrom: memberData.membershipStartDate?.split("T")[0] || new Date().toISOString().split("T")[0],
          validTo: memberData.membershipEndDate?.split("T")[0] || new Date().toISOString().split("T")[0],
          status: "pending",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      await batch.commit();

    } catch (error) {
      console.error(`Error processing new member ${snap.id} in gym ${gymId}:`, error);
    }
    return null;
  });

export const onMembershipUpdated = functions.firestore
  .document("gyms/{gymId}/members/{memberId}")
  .onUpdate(async (change, context) => {
    const { gymId } = context.params;
    const beforeData = change.before.data();
    const afterData = change.after.data();

    // Check if deleted/deactivated logically
    if (afterData.isArchived || !afterData.fullName) { // Using isArchived flag or if it was somehow physically deleted and this is a phantom update
      if (afterData.devicePin) {
        const gymRef = db.collection("gyms").doc(gymId);
        const devicesSnap = await gymRef.collection("biometricDevices").get();
        const batch = db.batch();

        devicesSnap.docs.forEach((deviceDoc) => {
          const commandRef = deviceDoc.ref.collection("deviceCommands").doc();
          batch.set(commandRef, {
            type: "DELETE_USER",
            pin: formatPin(afterData.devicePin),
            status: "pending",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });

        await batch.commit();
      }
      return null;
    }

    // Check if endDate changed
    if (beforeData.membershipEndDate !== afterData.membershipEndDate && afterData.devicePin) {
      const gymRef = db.collection("gyms").doc(gymId);
      const devicesSnap = await gymRef.collection("biometricDevices").get();
      const batch = db.batch();

      devicesSnap.docs.forEach((deviceDoc) => {
        const commandRef = deviceDoc.ref.collection("deviceCommands").doc();
        batch.set(commandRef, {
          type: "UPDATE_USER_VALIDITY",
          pin: formatPin(afterData.devicePin),
          validFrom: afterData.membershipStartDate?.split("T")[0] || new Date().toISOString().split("T")[0],
          validTo: afterData.membershipEndDate?.split("T")[0] || new Date().toISOString().split("T")[0],
          status: "pending",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      await batch.commit();
    }
  });

export const onMemberDeleted = functions.firestore
  .document("gyms/{gymId}/members/{memberId}")
  .onDelete(async (snap, context) => {
    const { gymId } = context.params;
    const memberData = snap.data();

    if (memberData.devicePin) {
      const gymRef = db.collection("gyms").doc(gymId);
      const devicesSnap = await gymRef.collection("biometricDevices").get();
      const batch = db.batch();

      devicesSnap.docs.forEach((deviceDoc) => {
        const commandRef = deviceDoc.ref.collection("deviceCommands").doc();
        batch.set(commandRef, {
          type: "DELETE_USER",
          pin: formatPin(memberData.devicePin),
          status: "pending",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      await batch.commit();
    }
  });

export const autoExpireMembers = functions.pubsub
  .schedule("30 18 * * *") // Daily at midnight IST
  .timeZone("UTC")
  .onRun(async (context) => {
    const today = new Date();
    // Use yesterday for the validTo date to block them
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    const todayStr = today.toISOString().split("T")[0];

    const gymsSnapshot = await db.collection("gyms").get();

    for (const gymDoc of gymsSnapshot.docs) {
      const membersSnapshot = await gymDoc.ref.collection("members")
        .where("membershipEndDate", "<", todayStr)
        .get();

      const batch = db.batch();
      let hasUpdates = false;

      for (const memberDoc of membersSnapshot.docs) {
        const memberData = memberDoc.data();
        if (memberData.status !== "expired") {
          batch.update(memberDoc.ref, { status: "expired" });
          hasUpdates = true;

          if (memberData.devicePin) {
            const devicesSnap = await gymDoc.ref.collection("biometricDevices").get();
            devicesSnap.docs.forEach((deviceDoc) => {
              const commandRef = deviceDoc.ref.collection("deviceCommands").doc();
              batch.set(commandRef, {
                type: "UPDATE_USER_VALIDITY",
                pin: formatPin(memberData.devicePin),
                validFrom: memberData.membershipStartDate?.split("T")[0] || yesterdayStr,
                validTo: yesterdayStr,
                status: "pending",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            });
          }
        }
      }

      if (hasUpdates) {
        await batch.commit();
      }
    }
  });
