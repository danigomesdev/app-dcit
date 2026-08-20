import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import HomeScreen from "../index";

global.fetch = jest.fn();

describe("HomeScreen", () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockReset();
  });

  it("shows a confirmation after tapping Bater Ponto", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    render(<HomeScreen />);
    fireEvent.press(screen.getByText("Bater Ponto"));

    await waitFor(() => {
      expect(screen.getByText(/Ponto registrado/i)).toBeTruthy();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:3000/time-entries",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("shows an error message when the request fails", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

    render(<HomeScreen />);
    fireEvent.press(screen.getByText("Bater Ponto"));

    await waitFor(() => {
      expect(screen.getByText(/Falha ao registrar/i)).toBeTruthy();
    });
  });
});
