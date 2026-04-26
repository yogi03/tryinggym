// Plain CommonJS script — run with: node scripts/resetCommands.js
require("dotenv").config({ path: ".env" });

const admin = require("firebase-admin");

const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey,
  }),
});

const db = admin.firestore();

async function resetCommands() {
  const gymsSnap = await db.collection("gyms").get();
  let total = 0;

  for (const gymDoc of gymsSnap.docs) {
    const devicesSnap = await gymDoc.ref.collection("biometricDevices").get();
    for (const deviceDoc of devicesSnap.docs) {
      const cmdsSnap = await deviceDoc.ref
        .collection("deviceCommands")
        .where("status", "==", "sent")
        .get();

      if (!cmdsSnap.empty) {
        const batch = db.batch();
        cmdsSnap.docs.forEach((d) => batch.update(d.ref, { status: "pending" }));
        await batch.commit();
        total += cmdsSnap.size;
        console.log(`  Reset ${cmdsSnap.size} commands in device ${deviceDoc.id} (gym: ${gymDoc.id})`);
      }
    }
  }

  console.log(`\nDone. Total reset: ${total} commands back to pending.`);
  process.exit(0);
}

resetCommands().catch((e) => {
  console.error(e);
  process.exit(1);
});
