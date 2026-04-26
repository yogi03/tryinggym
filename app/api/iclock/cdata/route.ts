import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { parseAttlogLine } from "@/lib/devicePin";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sn = searchParams.get("SN");

  if (!sn) {
    return new NextResponse("OK\n", { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  let commandsText = "";

  try {
    const db = adminDb;
    
    // Find device across all gyms
    const devicesRef = db.collectionGroup("devices").where("cloudId", "==", sn);
    const snapshot = await devicesRef.get();

    if (!snapshot.empty) {
      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.update(doc.ref, { lastSeen: new Date() });
      });
      await batch.commit();

      // Fetch pending commands for this gym
      const gymRef = snapshot.docs[0].ref.parent.parent;
      if (gymRef) {
        const commandsRef = gymRef.collection("deviceCommands")
          .where("status", "==", "pending");
        
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
    }
  } catch (error) {
    console.error("Error in GET /api/iclock/cdata:", error);
  }

  // Always return the standard options response to the device
  let responseText = `GET OPTION FROM: ${sn}
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

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sn = searchParams.get("SN");
  const table = searchParams.get("table");

  if (!sn) {
    return new NextResponse("OK\n", { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  try {
    const db = adminDb;
    
    // Find which gym this device belongs to
    const devicesRef = db.collectionGroup("devices").where("cloudId", "==", sn);
    const snapshot = await devicesRef.get();
    
    if (snapshot.empty) {
      // Device not found, but we shouldn't break its polling
      return new NextResponse("OK\n", { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    const deviceDoc = snapshot.docs[0];
    const gymRef = deviceDoc.ref.parent.parent;
    if (!gymRef) {
      return new NextResponse("OK\n", { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    
    const gymId = gymRef.id;

    // Process attendance data if provided
    if (table === "ATTLOG") {
      const bodyText = await request.text();
      const lines = bodyText.split("\n").filter((line) => line.trim().length > 0);
      
      const batch = db.batch();
      let hasWrites = false;

      for (const line of lines) {
        const parsed = parseAttlogLine(line);
        if (!parsed) continue;

        // Find member by devicePin
        const membersSnapshot = await gymRef.collection("members")
          .where("devicePin", "==", parseInt(parsed.pin))
          .limit(1)
          .get();

        const memberId = membersSnapshot.empty ? "unknown" : membersSnapshot.docs[0].id;
        const memberName = membersSnapshot.empty ? "Unknown" : membersSnapshot.docs[0].data().name || "Unknown";

        // Write to attendanceLogs
        const logRef = gymRef.collection("attendanceLogs").doc();
        batch.set(logRef, {
          devicePin: parsed.pin,
          memberId,
          memberName,
          timestamp: new Date(), // Could parse date/time from line, but current time is okay or parse it
          verifyMode: parsed.verifyMode,
          rawEntry: line,
        });
        hasWrites = true;
      }

      if (hasWrites) {
        await batch.commit();
      }
    }

    // Check for pending device commands
    // Removed orderBy("createdAt") to prevent requiring a composite index which causes silent failures
    const commandsRef = gymRef.collection("deviceCommands")
      .where("status", "==", "pending");
    
    const commandsSnapshot = await commandsRef.get();
    
    let commandsResponse = "OK\n";
    const batch = db.batch();

    let cmdCounter = 1;
    commandsSnapshot.docs.forEach((doc) => {
      const cmd = doc.data();
      // Ensure unique command ID for each command in the batch
      const uniqueCmdId = `${Math.floor(Date.now() / 1000)}${cmdCounter++}`;
      
      if (cmd.type === "CREATE_USER") {
        commandsResponse += `C:${uniqueCmdId}:DATA UPDATE USERINFO PIN=${cmd.pin}\tName=${cmd.name || ""}\tPri=0\tValidFrom=${cmd.validFrom || ""}\tValidTo=${cmd.validTo || ""}\n`;
      } else if (cmd.type === "UPDATE_USER_VALIDITY") {
        commandsResponse += `C:${uniqueCmdId}:DATA UPDATE USERINFO PIN=${cmd.pin}\tValidFrom=${cmd.validFrom || ""}\tValidTo=${cmd.validTo || ""}\n`;
      } else if (cmd.type === "DELETE_USER") {
        commandsResponse += `C:${uniqueCmdId}:DATA DELETE USERINFO PIN=${cmd.pin}\n`;
      }

      batch.update(doc.ref, {
        status: "sent",
        sentAt: new Date(),
      });
    });

    if (!commandsSnapshot.empty) {
      await batch.commit();
    }

    return new NextResponse(commandsResponse, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
    
  } catch (error) {
    console.error("Error in POST /api/iclock/cdata:", error);
    return new NextResponse("OK\n", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
}
