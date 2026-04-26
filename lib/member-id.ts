export function generateMemberId(fullName: string, phone: string): string {
  const letters = (fullName || "")
    .toLowerCase()
    .match(/[a-z]/g) || [];
  const prefix = (letters.slice(0, 2).join("") || "xx").padEnd(2, "x");
  const phonePart = (phone || "").trim();
  return `${prefix}${phonePart}`;
}
