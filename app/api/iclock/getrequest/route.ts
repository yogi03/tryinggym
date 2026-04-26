import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sn = searchParams.get("SN");

  if (!sn) {
    return new NextResponse("OK\n", { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  try {
    const db = adminDb;
    
    // Find which gym this device belongs to
    const devicesRef = db.collectionGroup("devices").where("cloudId", "==", sn);
    const snapshot = await devicesRef.get();
    
    if (snapshot.empty) {
      return new NextResponse("OK\n", { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    const deviceDoc = snapshot.docs[0];
    const gymRef = deviceDoc.ref.parent.parent;
    if (!gymRef) {
      return new NextResponse("OK\n", { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    
    // Check for pending device commands
    const commandsRef = gymRef.collection("deviceCommands")
      .where("status", "==", "pending");
    
    const commandsSnapshot = await commandsRef.get();
    
    let commandsResponse = "";
    const batch = db.batch();

    let cmdCounter = 1;
    commandsSnapshot.docs.forEach((doc) => {
      const cmd = doc.data();
      // Ensure unique command ID
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
      return new NextResponse(commandsResponse, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // FkWeb protocol expects exactly "OK" if there are no commands
    return new NextResponse("OK\n", { status: 200, headers: { "Content-Type": "text/plain" } });
    
  } catch (error) {
    console.error("Error in GET /api/iclock/getrequest:", error);
    return new NextResponse("OK\n", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
}
