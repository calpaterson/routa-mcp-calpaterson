import type { Tool } from "../tool.ts";
import { showAccess } from "./show-access.ts";
import { showPolicies } from "./show-policies.ts";
import { previewAccessChange } from "./preview-access-change.ts";
import { previewPolicyChange } from "./preview-policy-change.ts";
import { applyChange } from "./apply-change.ts";

// Each tool lives in its own file in this folder and is listed here.
export const tools: Tool[] = [showAccess, showPolicies, previewAccessChange, previewPolicyChange, applyChange];
