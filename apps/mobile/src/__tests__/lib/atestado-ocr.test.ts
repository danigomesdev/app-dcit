import { extractAtestadoData } from "@/lib/atestado-ocr";

jest.mock("expo-file-system/legacy", () => ({
  readAsStringAsync: jest.fn().mockResolvedValue("ZmFrZS1pbWFnZS1kYXRh"),
  EncodingType: { Base64: "base64", UTF8: "utf8" },
}));

globalThis.fetch = jest.fn();

describe("extractAtestadoData", () => {
  beforeEach(() => {
    (globalThis.fetch as jest.Mock).mockReset();
  });

  it("posts the base64 image and returns the parsed result on success", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ cid: "J06.9", crm: "CRM-MG 45213", medico: "Dr. Carlos", dias: 2 }),
    });

    const outcome = await extractAtestadoData("test-token", "file:///atestado.jpg");

    expect(outcome).toEqual({
      ok: true,
      result: { cid: "J06.9", crm: "CRM-MG 45213", medico: "Dr. Carlos", dias: 2 },
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/atestados/ocr"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      }),
    );
    const body = JSON.parse((globalThis.fetch as jest.Mock).mock.calls[0][1].body) as {
      mediaType: string;
      imageBase64: string;
    };
    expect(body.mediaType).toBe("image/jpeg");
    expect(body.imageBase64).toBe("ZmFrZS1pbWFnZS1kYXRh");
  });

  it("returns ok:false when the request fails", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false });

    const outcome = await extractAtestadoData("test-token", "file:///atestado.jpg");

    expect(outcome).toEqual({ ok: false });
  });

  it("returns ok:false when the network call throws", async () => {
    (globalThis.fetch as jest.Mock).mockRejectedValue(new TypeError("Network request failed"));

    const outcome = await extractAtestadoData("test-token", "file:///atestado.jpg");

    expect(outcome).toEqual({ ok: false });
  });
});
