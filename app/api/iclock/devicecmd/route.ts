import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sn = searchParams.get("SN");

  if (!sn) {
    return new NextResponse("OK\n", { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  try {
    // The device sends the execution result of the command here.
    // Usually it contains an ID=... and Return=0 (success) or Return<0 (error)
    const bodyText = await request.text();
    // We could parse the bodyText to mark specific commands as successful in Firestore
    // For now, returning OK ensures the device knows the server received the execution result.

    return new NextResponse("OK\n", { status: 200, headers: { "Content-Type": "text/plain" } });
    
  } catch (error) {
    console.error("Error in POST /api/iclock/devicecmd:", error);
    return new NextResponse("OK\n", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
}
