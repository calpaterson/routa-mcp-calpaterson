import type { Tool } from "../tool.ts";
import { showAccess } from "./show-access.ts";
import { showPolicies } from "./show-policies.ts";

// Each tool lives in its own file in this folder and is listed here.
export const tools: Tool[] = [showAccess, showPolicies];
