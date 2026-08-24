import { render, screen } from "@testing-library/react-native";
import { EmptyState } from "../empty-state";

describe("EmptyState", () => {
  it("renders the glyph, title and description", () => {
    render(
      <EmptyState
        glyph="🌴"
        title="Férias"
        description="Suas solicitações de férias vão aparecer aqui."
      />
    );

    expect(screen.getByText("🌴")).toBeTruthy();
    expect(screen.getByText("Férias")).toBeTruthy();
    expect(screen.getByText("Suas solicitações de férias vão aparecer aqui.")).toBeTruthy();
  });
});
