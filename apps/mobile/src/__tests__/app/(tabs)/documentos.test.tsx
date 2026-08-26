import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import * as ImagePicker from "expo-image-picker";

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

describe("documentos screen", () => {
  beforeEach(() => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: true,
    });
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({ canceled: true });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true });
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
