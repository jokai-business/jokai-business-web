import type { components } from "@/lib/api/schema";
export type Customer = components["schemas"]["Customer"];
export type CustomerInput = components["schemas"]["CustomerInput"];
export type Contact = components["schemas"]["Contact"];
export type Context = components["schemas"]["UserContext"];
export function errorMessage(error: unknown) { return error instanceof Error ? error.message : "The request could not be completed. Please try again."; }
