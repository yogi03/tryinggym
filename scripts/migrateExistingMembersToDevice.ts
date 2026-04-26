import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue, FieldPath } from "firebase-admin/firestore";

const firebaseAdminConfig = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
};

if (!getApps().length) {
  initializeApp({
    credential: cert(firebaseAdminConfig),
  });
}

const db = getFirestore();

// Parse command line arguments to get gymId if provided
const args = process.argv.slice(2);
const gymIdArg = args.find((arg) => arg.startsWith("--gymId="));
const targetGymId = gymIdArg ? gymIdArg.split("=")[1] : null;

function formatPin(pin: number): string {
  return pin.toString().padStart(8, "0");
}

async function migrate() {
  console.log("Starting migration of existing members to device...");
  let totalGymsProcessed = 0;
  let totalMembersMigrated = 0;

  try {
    let gymsQuery: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection("gyms");
    if (targetGymId) {
      gymsQuery = gymsQuery.where(FieldPath.documentId(), "==", targetGymId);
    }

    const gymsSnapshot = await gymsQuery.get();
    
    if (gymsSnapshot.empty) {
      console.log("No gyms found to process.");
      return;
    }

    for (const gymDoc of gymsSnapshot.docs) {
      const gymId = gymDoc.id;
      const gymName = gymDoc.data().name || gymId;
      console.log(`Processing Gym: ${gymName} (${gymId})`);
      
      let gymMembersMigrated = 0;
      
      // Fetch members without a devicePin
      // Note: We'll fetch all and filter in memory, or use a not-in query if supported.
      // Firestore doesn't easily support "where field does not exist" without index workarounds, 
      // so we fetch all members for this gym and filter.
      const membersSnapshot = await gymDoc.ref.collection("members").get();
      const membersToMigrate = membersSnapshot.docs.filter(doc => !doc.data().devicePin);

      if (membersToMigrate.length === 0) {
        console.log(`  No members need migration in ${gymName}.`);
        totalGymsProcessed++;
        continue;
      }

      console.log(`  Found ${membersToMigrate.length} members without devicePin.`);

      // Process in batches, but lastDevicePin update MUST be atomic
      // So we'll process each member transactionally for the pin, then batch the command.
      
      // We can do batches of 500 max writes.
      // 1 update to member + 1 write to command = 2 writes per member.
      // We can do up to 250 members per batch.
      const BATCH_SIZE = 200;
      for (let i = 0; i < membersToMigrate.length; i += BATCH_SIZE) {
        const batchMembers = membersToMigrate.slice(i, i + BATCH_SIZE);
        const batch = db.batch();

        for (const memberDoc of batchMembers) {
          const memberData = memberDoc.data();
          const today = new Date().toISOString().split("T")[0];
          const validFrom = memberData.membershipStartDate?.split("T")[0] || today;
          const validTo = memberData.membershipEndDate?.split("T")[0] || today;

          // Transaction to get and increment lastDevicePin safely
          const devicePin = await db.runTransaction(async (transaction) => {
            const gymSnap = await transaction.get(gymDoc.ref);
            const gymData = gymSnap.data() || {};
            let lastPin = gymData.lastDevicePin || 0;
            const newPin = lastPin + 1;
            transaction.update(gymDoc.ref, { lastDevicePin: newPin });
            return newPin;
          });

          // Add updates to batch
          batch.update(memberDoc.ref, { devicePin });

          const commandRef = gymDoc.ref.collection("deviceCommands").doc();
          batch.set(commandRef, {
            type: "CREATE_USER",
            pin: formatPin(devicePin),
            name: memberData.fullName || "Unknown",
            validFrom: validFrom,
            validTo: validTo,
            status: "pending",
            createdAt: FieldValue.serverTimestamp(),
          });
          
          // Check if validTo is in the past
          if (new Date(validTo) < new Date(today)) {
            const updateCommandRef = gymDoc.ref.collection("deviceCommands").doc();
            batch.set(updateCommandRef, {
              type: "UPDATE_USER_VALIDITY",
              pin: formatPin(devicePin),
              validFrom: validFrom,
              validTo: validTo,
              status: "pending",
              createdAt: FieldValue.serverTimestamp(),
            });
          }

          gymMembersMigrated++;
        }

        await batch.commit();
        console.log(`  Migrated ${gymMembersMigrated}/${membersToMigrate.length} members so far...`);
      }
      
      totalMembersMigrated += gymMembersMigrated;
      totalGymsProcessed++;
    }

    console.log("\nMigration Summary:");
    console.log(`Total Gyms Processed: ${totalGymsProcessed}`);
    console.log(`Total Members Migrated: ${totalMembersMigrated}`);

  } catch (error) {
    console.error("Error during migration:", error);
  }
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
