import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PasswordInput } from "@/components/ui/password-input";

describe("PasswordInput visibility toggle", () => {
  it("hides the password until the view button is pressed, then hides it again", () => {
    render(<PasswordInput aria-label="Password saat ini" defaultValue="rahasia12345" />);

    const field = screen.getByLabelText("Password saat ini");
    expect(field).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: "Lihat password" }));

    expect(screen.getByLabelText("Password saat ini")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Password saat ini")).toHaveValue("rahasia12345");
    expect(screen.getByRole("button", { name: "Sembunyikan password" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Sembunyikan password" }));

    expect(screen.getByLabelText("Password saat ini")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Lihat password" })).toHaveAttribute("aria-pressed", "false");
  });

  it("is a plain button so toggling never submits the form", () => {
    render(
      <form onSubmit={(e) => e.preventDefault()}>
        <PasswordInput aria-label="Password baru" defaultValue="rahasia12345" />
      </form>,
    );

    expect(screen.getByRole("button", { name: "Lihat password" })).toHaveAttribute("type", "button");
  });
});
