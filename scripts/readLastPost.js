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

async function check() {
  const doc = await db.collection("debug").doc("lastPost").get();
  if (doc.exists) {
    console.log("--- FOUND POST DATA ---");
    console.log(JSON.stringify(doc.data(), null, 2));
  } else {
    console.log("No post data found yet");
  }
  process.exit(0);
}

check().catch(e => {
    console.error(e);
    process.exit(1);
});
