import createClient from "openapi-fetch";
import type { paths } from "./schema";
import { getSession } from "@/lib/auth/session";
export const api = createClient<paths>({ baseUrl: "" });
api.use({ async onRequest({ request }) {
 const session = await getSession();
 if (!session.authenticated) throw new Error("Sign in to continue.");
 try { await session.updateToken(30); } catch { throw new Error("Your session expired. Sign in again."); }
 request.headers.set("Authorization", `Bearer ${session.token}`);
 return request;
}});
