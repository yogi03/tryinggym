import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { parseAttlogLine } from "@/lib/devicePin";

async function findDevice(deviceToken: string) {
  const db = adminDb;
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

      await deviceDoc.ref.update({ lastSeen: new Date() });

      const commandsSnapshot = await deviceDoc.ref
        .collection("deviceCommands")
        .where("status", "==", "pending")
        .get();

      if (!commandsSnapshot.empty) {
        const cmdBatch = adminDb.batch();
        let cmdCounter = 1;

        commandsSnapshot.docs.forEach((doc) => {
          const cmd = doc.data();
          const uniqueCmdId = `${Math.floor(Date.now() / 1000)}${String(cmdCounter++).padStart(4, "0")}`;

          // PIN: plain integer (device internally zero-pads to 8 digits, e.g. "1" → "00000001")
          const pin = parseInt(String(cmd.pin), 10);

          // Dates: YYYY-MM-DD format WITH dashes (confirmed from device UI)
          const validFrom = cmd.validFrom || "";
          const validTo = cmd.validTo || "";

          if (cmd.type === "CREATE_USER") {
            commandsText += `C:${uniqueCmdId}:DATA UPDATE USERINFO PIN=${pin}\tName=${cmd.name || ""}\tPri=0\tValidFrom=${validFrom}\tValidTo=${validTo}\n`;
          } else if (cmd.type === "UPDATE_USER_VALIDITY") {
            commandsText += `C:${uniqueCmdId}:DATA UPDATE USERINFO PIN=${pin}\tValidFrom=${validFrom}\tValidTo=${validTo}\n`;
          } else if (cmd.type === "DELETE_USER") {
            commandsText += `C:${uniqueCmdId}:DATA DELETE USERINFO PIN=${pin}\n`;
          }

          cmdBatch.update(doc.ref, { status: "sent", sentAt: new Date() });
        });

        await cmdBatch.commit();
        console.log(`[Biometric GET] Sent ${commandsSnapshot.size} commands to device ${serialNo}`);
        console.log(`[Biometric GET] Command payload:\n${commandsText}`);
      }
    }
  } catch (error) {
    console.error(`[Biometric GET] Error for token ${deviceToken}:`, error);
  }

  const responseLines = [
    `GET OPTION FROM: ${serialNo}`,
    `ATTLOGStamp=None`,
    `OPERLOGStamp=9999`,
    `ATTPHOTOStamp=None`,
    `ErrorDelay=30`,
    `Delay=10`,
    `TransTimes=00:00;14:05`,
    `TransInterval=1`,
    `TransFlag=TransData AttLog`,
    `Realtime=1`,
    `Encrypt=None`,
  ];

  let responseText = responseLines.join("\n");
  if (commandsText) {
    responseText += "\n" + commandsText;
  }

  return new NextResponse(responseText, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function POST(request: NextRequest, { params }: { params: { deviceToken: string } }) {
  const url = new URL(request.url);
  const { deviceToken } = params;
  const table = url.searchParams.get("table");

  if (!deviceToken) {
    return new NextResponse("OK\n", { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  // Read raw body
  const bodyText = await request.text();
  const contentType = request.headers.get("content-type") || "";

  // Log EVERYTHING to understand the device's protocol
  console.log(`[Biometric POST] url=${url.toString()}`);
  console.log(`[Biometric POST] content-type=${contentType}`);
  console.log(`[Biometric POST] table=${table}`);
  console.log(`[Biometric POST] body=${bodyText}`);

  try {
    const result = await findDevice(deviceToken);
    if (!result) {
      return new NextResponse("OK\n", { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    const { deviceDoc, gymRef } = result;
    const deviceData = deviceDoc.data()!;

    await deviceDoc.ref.update({ lastSeen: new Date() });

    // Try to parse as JSON first (Realtime FkWeb JSON format)
    let parsedJson: Record<string, string> | null = null;
    try {
      if (bodyText.trim().startsWith("{")) {
        parsedJson = JSON.parse(bodyText);
        console.log(`[Biometric POST] Parsed JSON:`, JSON.stringify(parsedJson));
      }
    } catch (_) { /* not JSON */ }

    // Handle CMD_REPLY (device confirming it processed a command)
    if (table === "CMD_REPLY" || bodyText.includes("CMD_REPLY")) {
      console.log(`[Biometric POST] CMD_REPLY from ${deviceData.serialNo}`);
      return new NextResponse("OK\n", { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    // Handle attendance: JSON format {"fk_name":"...", "fk_time":"*YYYYMMDDHHMMSS", "fk_user":"PIN", ...}
    if (parsedJson && (parsedJson.fk_time || parsedJson.fk_user)) {
      console.log(`[Biometric POST] Processing JSON attendance record`);

      const pin = parsedJson.fk_user || parsedJson.fk_name || "";
      // fk_time format appears to be "*YYYYMMDDHHMMSS" or "YYYYMMDDHHMMSS"
      const rawTime = (parsedJson.fk_time || "").replace(/^\*/, "");
      const direction = deviceData.mode === "out" ? "out" : "in";

      if (pin) {
        const membersSnapshot = await gymRef
          .collection("members")
          .where("devicePin", "==", parseInt(pin))
          .limit(1)
          .get();

        const memberId = membersSnapshot.empty ? "unknown" : membersSnapshot.docs[0].id;
        const memberName = membersSnapshot.empty
          ? "Unknown"
          : membersSnapshot.docs[0].data().fullName || "Unknown";

        await gymRef.collection("attendanceLogs").add({
          deviceToken,
          machineName: deviceData.machineName || "Unknown",
          devicePin: pin,
          memberId,
          memberName,
          timestamp: new Date(),
          rawTime,
          direction,
          rawEntry: bodyText,
        });
        console.log(`[Biometric POST] Attendance logged for PIN=${pin}, member=${memberName}`);
      }
      return new NextResponse("OK\n", { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    // Handle plain-text ATTLOG format (fallback)
    if (table === "ATTLOG" && !parsedJson) {
      const lines = bodyText.split("\n").filter((line) => line.trim().length > 0);
      const batch = adminDb.batch();
      let hasWrites = false;
      const direction = deviceData.mode === "out" ? "out" : "in";

      for (const line of lines) {
        const parsed = parseAttlogLine(line);
        if (!parsed) continue;

        const membersSnapshot = await gymRef
          .collection("members")
          .where("devicePin", "==", parseInt(parsed.pin))
          .limit(1)
          .get();

        const memberId = membersSnapshot.empty ? "unknown" : membersSnapshot.docs[0].id;
        const memberName = membersSnapshot.empty ? "Unknown"
          : membersSnapshot.docs[0].data().fullName || "Unknown";

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

      if (hasWrites) await batch.commit();
    }

    return new NextResponse("OK\n", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (error) {
    console.error(`[Biometric POST] Error for token ${deviceToken}:`, error);
    return new NextResponse("OK\n", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
}
