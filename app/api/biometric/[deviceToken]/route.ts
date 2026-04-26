import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { parseAttlogLine } from "@/lib/devicePin";

async function findDevice(deviceToken: string) {
  const db = adminDb;
  // Use top-level lookup doc — no index required
  const lookupDoc = await db.collection("biometricTokens").doc(deviceToken).get();
  if (!lookupDoc.exists) return null;

  const { gymId, deviceId } = lookupDoc.data() as { gymId: string; deviceId: string };
  const deviceDoc = await db.collection("gyms").doc(gymId).collection("biometricDevices").doc(deviceId).get();
  if (!deviceDoc.exists) return null;

  return { gymId, deviceId, deviceDoc, gymRef: db.collection("gyms").doc(gymId) };
}

export async function GET(request: NextRequest, { params }: { params: { deviceToken: string } }) {
  const { deviceToken } = params;

  if (!deviceToken) {
    return new NextResponse("OK\n", { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  let commandsText = "";
  let serialNo = "Unknown";

  try {
    const result = await findDevice(deviceToken);

    if (result) {
      const { deviceDoc } = result;
      const deviceData = deviceDoc.data()!;
      serialNo = deviceData.serialNo || "Unknown";

      // Update lastSeen
      await deviceDoc.ref.update({ lastSeen: new Date() });

      // Fetch pending commands for this specific device
      const commandsSnapshot = await deviceDoc.ref
        .collection("deviceCommands")
        .where("status", "==", "pending")
        .get();

      if (!commandsSnapshot.empty) {
        const cmdBatch = adminDb.batch();
        let cmdCounter = 1;

        commandsSnapshot.docs.forEach((doc) => {
          const cmd = doc.data();
          const uniqueCmdId = `${Math.floor(Date.now() / 1000)}${cmdCounter++}`;

          if (cmd.type === "CREATE_USER") {
            commandsText += `C:${uniqueCmdId}:DATA UPDATE USERINFO PIN=${cmd.pin}\tName=${cmd.name || ""}\tPri=0\tValidFrom=${cmd.validFrom || ""}\tValidTo=${cmd.validTo || ""}\n`;
          } else if (cmd.type === "UPDATE_USER_VALIDITY") {
            commandsText += `C:${uniqueCmdId}:DATA UPDATE USERINFO PIN=${cmd.pin}\tValidFrom=${cmd.validFrom || ""}\tValidTo=${cmd.validTo || ""}\n`;
          } else if (cmd.type === "DELETE_USER") {
            commandsText += `C:${uniqueCmdId}:DATA DELETE USERINFO PIN=${cmd.pin}\n`;
          }

          cmdBatch.update(doc.ref, { status: "sent", sentAt: new Date() });
        });

        await cmdBatch.commit();
      }
    }
  } catch (error) {
    console.error(`Error in GET /api/biometric/${deviceToken}:`, error);
  }

  let responseText = `GET OPTION FROM: ${serialNo}
ATTLOGStamp=None
OPERLOGStamp=9999
ATTPHOTOStamp=None
ErrorDelay=30
Delay=10
TransTimes=00:00;14:05
TransInterval=1
TransFlag=TransData AttLog
Realtime=1
Encrypt=None`;

  if (commandsText) {
    responseText += "\n" + commandsText;
  }

  return new NextResponse(responseText, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function POST(request: NextRequest, { params }: { params: { deviceToken: string } }) {
  const { searchParams } = new URL(request.url);
  const { deviceToken } = params;
  const table = searchParams.get("table");

  if (!deviceToken) {
    return new NextResponse("OK\n", { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  try {
    const result = await findDevice(deviceToken);

    if (!result) {
      return new NextResponse("OK\n", { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    const { deviceDoc, gymRef } = result;
    const deviceData = deviceDoc.data()!;

    // Update lastSeen
    await deviceDoc.ref.update({ lastSeen: new Date() });

    // Process attendance data if provided
    if (table === "ATTLOG") {
      const bodyText = await request.text();
      const lines = bodyText.split("\n").filter((line) => line.trim().length > 0);

      const batch = adminDb.batch();
      let hasWrites = false;

      const direction = deviceData.mode === "out" ? "out" : "in";

      for (const line of lines) {
        const parsed = parseAttlogLine(line);
        if (!parsed) continue;

        // Find member by devicePin
        const membersSnapshot = await gymRef
          .collection("members")
          .where("devicePin", "==", parseInt(parsed.pin))
          .limit(1)
          .get();

        const memberId = membersSnapshot.empty ? "unknown" : membersSnapshot.docs[0].id;
        const memberName = membersSnapshot.empty
          ? "Unknown"
          : membersSnapshot.docs[0].data().fullName || membersSnapshot.docs[0].data().name || "Unknown";

        const logRef = gymRef.collection("attendanceLogs").doc();
        batch.set(logRef, {
          deviceToken,
          machineName: deviceData.machineName || "Unknown",
          devicePin: parsed.pin,
          memberId,
          memberName,
          timestamp: new Date(),
          verifyMode: parsed.verifyMode,
          direction,
          rawEntry: line,
        });
        hasWrites = true;
      }

      if (hasWrites) {
        await batch.commit();
      }
    }

    return new NextResponse("OK\n", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (error) {
    console.error(`Error in POST /api/biometric/${deviceToken}:`, error);
    return new NextResponse("OK\n", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
}
