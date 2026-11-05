import { randomBytes } from "node:crypto";

// What a preview will send, exactly, and what the setting was when it was shown.
export type Change =
  | { type: "access"; group: string; app: string; allowed: boolean }
  | { type: "policy"; id: string; value: boolean | number | string };

export type Preview = { id: string; change: Change; before: boolean | number | string; text: string; createdAt: number };

const previews = new Map<string, Preview>();

export function savePreview(change: Change, before: Preview["before"], text: string): Preview {
  const id = randomBytes(4).toString("hex");
  const preview = { id, change, before, text, createdAt: Date.now() };
  previews.set(id, preview);
  return preview;
}

export const findPreview = (id: string) => previews.get(id);
export const forgetPreview = (id: string) => previews.delete(id);
export const clearPreviews = () => previews.clear();

export const askToApply = (p: Preview) => `Preview ${p.id}: ${p.text}\nNothing has been changed yet. To apply exactly this, say yes and I will apply preview ${p.id}.`;
