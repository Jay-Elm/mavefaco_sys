// The government IDs a farmer can verify with, and how each is captured and
// checked. Shared by the farmer's capture flow, the submission API and the
// staff review panel.

export type IdFrame = "card" | "passport";

export interface IdType {
  key: string;
  label: string;
  hint?: string;
  needsBack: boolean;
  // The capture frame: an ID card (85.6 × 54 mm) or a passport photo page (125 × 88 mm).
  frame: IdFrame;
  // Loose format check on the number with spaces and dashes removed. These
  // catch typos and obviously wrong numbers; staff still compare the number
  // with the photo.
  numberPattern: RegExp;
  numberExample: string;
}

export const ID_TYPES: IdType[] = [
  { key: "rsbsa", label: "RSBSA ID", hint: "Recommended for farmers", needsBack: true, frame: "card", numberPattern: /^\d{12,20}$/, numberExample: "05-05-17-001-000123" },
  { key: "philsys", label: "PhilSys National ID / ePhilID", needsBack: true, frame: "card", numberPattern: /^(\d{12}|\d{16})$/, numberExample: "1234-5678-9101-1213" },
  { key: "drivers_license", label: "Driver's License", needsBack: true, frame: "card", numberPattern: /^[A-Z]\d{10}$/, numberExample: "N01-12-345678" },
  { key: "umid", label: "UMID", needsBack: true, frame: "card", numberPattern: /^\d{12}$/, numberExample: "0111-1234567-8" },
  { key: "passport", label: "Passport", needsBack: false, frame: "passport", numberPattern: /^[A-Z]{1,2}\d{6,7}[A-Z]?$/, numberExample: "P1234567A" },
  { key: "prc", label: "PRC ID", needsBack: true, frame: "card", numberPattern: /^\d{6,8}$/, numberExample: "0123456" },
  { key: "postal", label: "Postal ID", needsBack: true, frame: "card", numberPattern: /^[A-Z0-9]{8,16}$/, numberExample: "PRN 100141234567" },
  { key: "voters", label: "Voter's ID", needsBack: true, frame: "card", numberPattern: /^[A-Z0-9]{10,30}$/, numberExample: "0505-1234A-B567CDE89012" },
  { key: "senior", label: "Senior Citizen ID", needsBack: true, frame: "card", numberPattern: /^[A-Z0-9]{4,20}$/, numberExample: "SC-012345" },
  { key: "pwd", label: "PWD ID", needsBack: true, frame: "card", numberPattern: /^[A-Z0-9]{8,20}$/, numberExample: "05-0517-000-0001234" },
];

/** Label for any stored ID type, including IDs uploaded before types existed. */
export function idTypeLabel(key: string): string {
  return ID_TYPES.find((t) => t.key === key)?.label ?? "Not specified (uploaded before ID types)";
}

export const findIdType = (key: string) => ID_TYPES.find((t) => t.key === key);

/** Width ÷ height of the capture frame. */
export const FRAME_ASPECT: Record<IdFrame, number> = { card: 85.6 / 54, passport: 125 / 88 };

/** Upper-case, without spaces, dashes, dots or slashes; a leading "PRN" label is dropped. */
export function normalizeIdNumber(raw: string): string {
  return raw.toUpperCase().replace(/[\s\-./]/g, "").replace(/^PRN/, "");
}

export function idNumberError(typeKey: string, raw: string): string | null {
  const type = findIdType(typeKey);
  if (!type) return "Choose an ID type";
  const n = normalizeIdNumber(raw);
  if (!n) return "Enter the ID number";
  if (!type.numberPattern.test(n)) return `That doesn't look like a ${type.label} number (for example ${type.numberExample})`;
  return null;
}

export const ID_REJECTION_REASONS = {
  unreadable: "A photo is blurry, dark or cut off",
  side_missing: "A side of the ID is missing or the wrong side was taken",
  face_mismatch: "The selfie doesn't match the photo on the ID",
  not_valid_id: "This isn't one of the accepted government IDs",
  expired: "The ID has expired",
  number_mismatch: "The ID number doesn't match the one on the ID",
  name_mismatch: "The name on the ID doesn't match the account",
  other: "Other",
} as const;
export type IdRejectionReason = keyof typeof ID_REJECTION_REASONS;

/** What the farmer sees of a submission: never the paths or the fingerprint. */
export function submissionSummary(s: {
  id: number; idType: string; numberLast4: string | null; status: string; captureMethod: string;
  rejectionReasons: string[]; rejectionNote: string | null; createdAt: Date; reviewedAt: Date | null;
}) {
  return {
    id: s.id, idType: s.idType, numberLast4: s.numberLast4, status: s.status, captureMethod: s.captureMethod,
    rejectionReasons: s.rejectionReasons, rejectionNote: s.rejectionNote, createdAt: s.createdAt, reviewedAt: s.reviewedAt,
  };
}
