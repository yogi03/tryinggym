export function formatPin(pin: number): string {
  return pin.toString().padStart(8, "0");
}

export function parseAttlogLine(line: string): { pin: string; date: string; time: string; verifyMode: string; status: string } | null {
  // Format: PIN\tDate\tTime\tStatus\tVerifyMode
  const parts = line.trim().split("\t");
  if (parts.length < 5) return null;

  return {
    pin: parts[0],
    date: parts[1],
    time: parts[2],
    status: parts[3],
    verifyMode: parts[4],
  };
}
