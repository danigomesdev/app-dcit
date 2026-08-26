import { fireEvent, render, screen } from "@testing-library/react-native";
import LoginScreen from "@/app/login";

describe("login screen", () => {
  it("renders the SSO entry point", () => {
    render(<LoginScreen />);
    expect(screen.getByText("Ponto DCIT")).toBeTruthy();
    expect(screen.getByText("Entrar com SSO")).toBeTruthy();
  });

  it("shows a placeholder message on press since SSO isn't wired yet", () => {
    render(<LoginScreen />);
    fireEvent.press(screen.getByText("Entrar com SSO"));
    expect(screen.getByText("O login com SSO ainda não está conectado.")).toBeTruthy();
  });
});
