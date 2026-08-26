import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import * as ImagePicker from "expo-image-picker";
import { saveSessionToken } from "@/lib/session";

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock("expo-file-system/legacy", () => ({
  readAsStringAsync: jest.fn().mockResolvedValue("ZmFrZS1pbWFnZS1kYXRh"),
  EncodingType: { Base64: "base64", UTF8: "utf8" },
}));

globalThis.fetch = jest.fn();

describe("documentos screen", () => {
  beforeEach(async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: true,
    });
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({ canceled: true });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true });
    (globalThis.fetch as jest.Mock).mockReset();
    await saveSessionToken("test-token");
  });

  it("defaults to the Atestados category with the seeded status list", () => {
    renderRouter("src/app", { initialUrl: "/documentos" });

    expect(screen.getByText("Enviar Atestado")).toBeTruthy();
    expect(screen.getByText("Aprovado")).toBeTruthy();
    expect(screen.getByText("Recusado")).toBeTruthy();
  });

  it("shows the seeded admission documents when that category is selected", () => {
    renderRouter("src/app", { initialUrl: "/documentos" });

    fireEvent.press(screen.getByText("Admissionais"));

    expect(screen.getByText("Contrato de trabalho assinado")).toBeTruthy();
  });

  it("submits a new atestado through the manual form", () => {
    renderRouter("src/app", { initialUrl: "/documentos" });

    fireEvent.press(screen.getByText("Enviar Atestado"));
    fireEvent.changeText(screen.getByPlaceholderText("CID"), "J06.9");
    fireEvent.changeText(screen.getByPlaceholderText("CRM do médico"), "CRM-MG 11111");
    fireEvent.changeText(screen.getByPlaceholderText("Nome do médico"), "Dr. Teste");
    fireEvent.changeText(screen.getByPlaceholderText("Quantidade de dias"), "3");
    fireEvent.press(screen.getByText("Enviar"));

    expect(screen.getAllByText(/CRM-MG 11111/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Enviado").length).toBeGreaterThan(0);
  });

  it("opens the camera when Tirar foto is pressed and previews the captured photo", async () => {
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file://fake-photo.jpg" }],
    });

    renderRouter("src/app", { initialUrl: "/documentos" });
    fireEvent.press(screen.getByText("Enviar Atestado"));
    fireEvent.press(screen.getByText("Tirar foto"));

    await waitFor(() => {
      expect(ImagePicker.launchCameraAsync).toHaveBeenCalled();
    });
  });

  it("prefills the atestado fields after a successful automatic OCR read", async () => {
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file://fake-photo.jpg" }],
    });
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        cid: "J06.9",
        crm: "CRM-MG 45213",
        medico: "Dr. Carlos Mendes",
        dias: 2,
      }),
    });

    renderRouter("src/app", { initialUrl: "/documentos" });
    fireEvent.press(screen.getByText("Enviar Atestado"));
    fireEvent.press(screen.getByText("Tirar foto"));

    await waitFor(() => {
      expect(screen.getByText(/Dados preenchidos automaticamente/)).toBeTruthy();
    });
    expect(screen.getByDisplayValue("J06.9")).toBeTruthy();
    expect(screen.getByDisplayValue("CRM-MG 45213")).toBeTruthy();
    expect(screen.getByDisplayValue("Dr. Carlos Mendes")).toBeTruthy();
    expect(screen.getByDisplayValue("2")).toBeTruthy();
  });

  it("falls back to manual entry when the OCR request fails", async () => {
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file://fake-photo.jpg" }],
    });
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false });

    renderRouter("src/app", { initialUrl: "/documentos" });
    fireEvent.press(screen.getByText("Enviar Atestado"));
    fireEvent.press(screen.getByText("Tirar foto"));

    await waitFor(() => {
      expect(screen.getByText(/Não foi possível ler automaticamente/)).toBeTruthy();
    });
    expect(screen.getByPlaceholderText("CID").props.value).toBe("");
  });

  it("expands a payslip to show the discount breakdown", () => {
    renderRouter("src/app", { initialUrl: "/documentos" });

    fireEvent.press(screen.getByText("Holerites"));
    fireEvent.press(screen.getByText("Julho 2026"));

    expect(screen.getByText("Salário bruto")).toBeTruthy();
    expect(screen.getByText("Líquido a receber")).toBeTruthy();
  });

  it("adds a new certification", () => {
    renderRouter("src/app", { initialUrl: "/documentos" });

    fireEvent.press(screen.getByText("Certificações"));
    fireEvent.press(screen.getByText("Adicionar certificação"));
    fireEvent.changeText(screen.getByPlaceholderText("Nome da certificação"), "AWS Certified");
    fireEvent.changeText(screen.getByPlaceholderText("Instituição"), "Amazon");
    fireEvent.changeText(screen.getByPlaceholderText("Validade (DD/MM/AAAA)"), "10/10/2028");
    fireEvent.press(screen.getByText("Salvar"));

    expect(screen.getByText("AWS Certified")).toBeTruthy();
  });
});
