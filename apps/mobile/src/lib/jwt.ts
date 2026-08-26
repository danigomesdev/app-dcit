// Decodes the payload of a JWT for display purposes only — this app never
// verifies the signature client-side, it just trusts a token it received
// straight from its own backend a moment ago. No atob/Buffer assumption:
// Hermes doesn't ship either by default, so this decodes base64url by hand.
const BASE64URL_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function base64UrlDecode(segment: string): string {
  let bits = "";
  for (const char of segment) {
    const index = BASE64URL_CHARS.indexOf(char);
    if (index === -1) continue;
    bits += index.toString(2).padStart(6, "0");
  }

  let output = "";
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    output += String.fromCharCode(parseInt(bits.slice(i, i + 8), 2));
  }
  return decodeURIComponent(
    output
      .split("")
      .map((char) => "%" + char.charCodeAt(0).toString(16).padStart(2, "0"))
      .join(""),
  );
}

export type SessionClaims = {
  sub: string;
  role: "colaborador" | "gestor" | "rh";
  name: string;
};

export function decodeSessionToken(token: string): SessionClaims | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    return JSON.parse(base64UrlDecode(payload)) as SessionClaims;
  } catch {
    return null;
  }
}
