import Keycloak from "keycloak-js";
let session: Promise<Keycloak> | undefined;
export function getSession() {
 if (!session) {
  const keycloak = new Keycloak({ url: `${window.location.origin}/auth`, realm: "ai-business", clientId: "ai-business-web" });
  session = keycloak.init({ onLoad: "check-sso", pkceMethod: "S256", checkLoginIframe: false, responseMode: "query" })
    .then(() => keycloak).catch((error) => { session = undefined; throw error; });
 }
 return session;
}
