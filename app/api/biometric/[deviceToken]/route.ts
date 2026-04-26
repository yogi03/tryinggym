import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { parseAttlogLine } from "@/lib/devicePin";

export async function GET(request: NextRequest, { params }: { params: { deviceToken: string } }) {
  const { deviceToken } = params;

  if (!deviceToken) {
    return new NextResponse("OK\n", { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  let commandsText = "";
  let serialNo = "Unknown";

  try {
    const db = adminDb;
    
    // Find device across all gyms by deviceToken
    const devicesRef = db.collectionGroup("biometricDevices").where("deviceToken", "==", deviceToken);
    const snapshot = await devicesRef.get();

    if (!snapshot.empty) {
      const deviceDoc = snapshot.docs[0];
      const deviceData = deviceDoc.data();
      serialNo = deviceData.serialNo || "Unknown";

      // Update lastSeen
      await deviceDoc.ref.update({ lastSeen: new Date() });

      // Fetch pending commands for this specific device
      const commandsRef = deviceDoc.ref.collection("deviceCommands").where("status", "==", "pending");
      const commandsSnapshot = await commandsRef.get();
      
      if (!commandsSnapshot.empty) {
        const cmdBatch = db.batch();
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

          cmdBatch.update(doc.ref, {
            status: "sent",
            sentAt: new Date(),
          });
        });
        
        await cmdBatch.commit();
      }
    }
  } catch (error) {
    console.error(`Error in GET /api/biometric/${deviceToken}:`, error);
  }

  // Always return the standard options response to the device
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

  // Append commands if any
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
    const db = adminDb;
    
    // Find device by deviceToken
    const devicesRef = db.collectionGroup("biometricDevices").where("deviceToken", "==", deviceToken);
    const snapshot = await devicesRef.get();
    
    if (snapshot.empty) {
      return new NextResponse("OK\n", { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    const deviceDoc = snapshot.docs[0];
    const deviceData = deviceDoc.data();
    
    // Update lastSeen
    await deviceDoc.ref.update({ lastSeen: new Date() });

    const gymRef = deviceDoc.ref.parent.parent;
    if (!gymRef) {
      return new NextResponse("OK\n", { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    // Process attendance data if provided
    if (table === "ATTLOG") {
      const bodyText = await request.text();
      const lines = bodyText.split("\n").filter((line) => line.trim().length > 0);
      
      const batch = db.batch();
      let hasWrites = false;

      // Determine direction based on mode
      const getDirection = (mode: string) => {
        if (mode === "in") return "in";
        if (mode === "out") return "out";
        // for "both", realistically the device passes state or we'd just log it without direction,
        // but for now we'll mark as both if unknown
        return "in"; 
      };
      
      const direction = getDirection(deviceData.mode);

      for (const line of lines) {
        const parsed = parseAttlogLine(line);
        if (!parsed) continue;

        // Find member by devicePin
        const membersSnapshot = await gymRef.collection("members")
          .where("devicePin", "==", parseInt(parsed.pin))
          .limit(1)
          .get();

        const memberId = membersSnapshot.empty ? "unknown" : membersSnapshot.docs[0].id;
        const memberName = membersSnapshot.empty ? "Unknown" : membersSnapshot.docs[0].data().fullName || membersSnapshot.docs[0].data().name || "Unknown";

        // Write to attendanceLogs
        const logRef = gymRef.collection("attendanceLogs").doc();
        batch.set(logRef, {
          deviceToken: deviceToken,
          machineName: deviceData.machineName || "Unknown",
          devicePin: parsed.pin,
          memberId,
          memberName,
          timestamp: new Date(), // Could parse date/time from line, but current time is okay
          verifyMode: parsed.verifyMode,
          direction: direction,
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
