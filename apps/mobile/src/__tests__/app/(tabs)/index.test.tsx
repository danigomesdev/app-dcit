import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import HomeScreen from "@/app/(tabs)/index";

globalThis.fetch = jest.fn();

describe("HomeScreen", () => {
  beforeEach(() => {
    (globalThis.fetch as jest.Mock).mockReset();
  });

  it("updates the last punch time after tapping Bater Ponto", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true });

    render(<HomeScreen />);
    expect(screen.getByText(/Registrado às: --:--/)).toBeTruthy();

    fireEvent.press(screen.getByText("Bater Ponto"));

    await waitFor(() => {
      expect(screen.queryByText(/Registrado às: --:--/)).toBeNull();
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:3000/time-entries",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("shows an error message when the request fails", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false });

    render(<HomeScreen />);
    fireEvent.press(screen.getByText("Bater Ponto"));

    await waitFor(() => {
      expect(screen.getByText(/Falha ao registrar/i)).toBeTruthy();
    });
  });
});
