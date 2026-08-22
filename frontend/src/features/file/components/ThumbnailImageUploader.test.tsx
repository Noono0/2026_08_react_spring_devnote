import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThumbnailImageUploader } from "@/features/file/components/ThumbnailImageUploader";

vi.mock("@/features/file/api/fileApi", () => ({ uploadEditorImage: vi.fn() }));
vi.mock("@/shared/notification/applicationNotification", () => ({
  applicationNotification: {
    success: vi.fn(),
    warning: vi.fn(),
    apiError: vi.fn(),
  },
}));

describe("ThumbnailImageUploader", () => {
  it("클립보드 이미지를 붙여넣어 업로드할 수 있다", async () => {
    const handleThumbnailChange = vi.fn();
    const imageFile = new File(["image"], "portfolio.png", { type: "image/png" });
    const imageUploadFunction = vi.fn().mockResolvedValue({
      fileId: 17,
      originalFileName: "portfolio.png",
      contentUrl: "/api/v1/files/17/content",
    });
    render(
      <ThumbnailImageUploader
        title="이미지 블록"
        handleThumbnailChange={handleThumbnailChange}
        imageUploadFunction={imageUploadFunction}
      />,
    );

    fireEvent.paste(screen.getByRole("region", { name: "이미지 블록 업로드 영역" }), {
      clipboardData: { files: [imageFile] },
    });

    await waitFor(() => expect(handleThumbnailChange).toHaveBeenCalledWith(17, "/api/v1/files/17/content"));
  });
});
