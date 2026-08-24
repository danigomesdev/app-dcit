import { render, screen } from "@testing-library/react-native";
import BancoDeHorasScreen from "@/app/(tabs)/banco-de-horas";
import FeriasScreen from "@/app/(tabs)/ferias";
import DocumentosScreen from "@/app/(tabs)/documentos";
import MuralScreen from "@/app/(tabs)/mural";

describe("placeholder screens", () => {
  it("renders the Banco de Horas empty state", () => {
    render(<BancoDeHorasScreen />);
    expect(screen.getByText("Banco de Horas")).toBeTruthy();
  });

  it("renders the Férias empty state", () => {
    render(<FeriasScreen />);
    expect(screen.getByText("Férias")).toBeTruthy();
  });

  it("renders the Documentos empty state", () => {
    render(<DocumentosScreen />);
    expect(screen.getByText("Documentos")).toBeTruthy();
  });

  it("renders the Mural empty state", () => {
    render(<MuralScreen />);
    expect(screen.getByText("Mural")).toBeTruthy();
  });
});
