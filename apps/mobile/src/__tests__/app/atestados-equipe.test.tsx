import { renderRouter, screen } from "expo-router/testing-library";
import { saveSessionToken } from "@/lib/session";

function fakeJwt(claims: Record<string, unknown>) {
  const BASE64URL_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  function encode(value: string) {
    const bytes = encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
    let bits = "";
    for (let i = 0; i < bytes.length; i++) bits += bytes.charCodeAt(i).toString(2).padStart(8, "0");
    let out = "";
    for (let i = 0; i + 6 <= bits.length; i += 6) out += BASE64URL_CHARS[parseInt(bits.slice(i, i + 6), 2)];
    const remainder = bits.length % 6;
    if (remainder) out += BASE64URL_CHARS[parseInt(bits.slice(-remainder).padEnd(6, "0"), 2)];
    return out;
  }
  return `${encode("{}")}.${encode(JSON.stringify(claims))}.signature`;
}

describe("atestados da equipe screen", () => {
  it("hides clinical fields (CID, CRM, médico) for a gestor", async () => {
    await saveSessionToken(fakeJwt({ sub: "gestor-1", role: "gestor", name: "Bruno Gestor" }));

    renderRouter("src/app", { initialUrl: "/atestados-equipe" });

    expect(await screen.findByText("Ana Colaboradora")).toBeTruthy();
    expect(screen.queryByText(/CID:/)).toBeNull();
    expect(screen.queryByText(/CRM:/)).toBeNull();
  });

  it("shows clinical fields for RH", async () => {
    await saveSessionToken(fakeJwt({ sub: "rh-1", role: "rh", name: "Carla RH" }));

    renderRouter("src/app", { initialUrl: "/atestados-equipe" });

    expect(await screen.findByText(/CID: J06.9/)).toBeTruthy();
    expect(screen.getByText(/CRM: CRM-MG 45213/)).toBeTruthy();
  });
});
