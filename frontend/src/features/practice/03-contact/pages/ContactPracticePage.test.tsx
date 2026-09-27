import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ContactPracticePage } from "./ContactPracticePage";

describe("연락처 저장 데이터 복원", () => {
  beforeEach(() => localStorage.clear());

  it("잘못된 저장 항목 때문에 화면이 중단되지 않으며 정상 연락처를 유지한다", () => {
    localStorage.setItem("practiceContacts", JSON.stringify([
      null,
      { contactId: 2, contactName: 7 },
      { contactId: 3, contactName: "유효한 연락처", emailAddress: "reader@example.com", phoneNumber: "010-1234-5678" },
    ]));
    render(<ContactPracticePage />);
    expect(screen.getByText("유효한 연락처")).toBeInTheDocument();
    expect(screen.getByText("reader@example.com")).toBeInTheDocument();
  });
});
