export const copyText = async (value: string): Promise<void> => {
  if (!value) throw new Error("복사할 내용이 없습니다.");
  await navigator.clipboard.writeText(value);
};

export const downloadText = (fileName: string, value: string, mimeType = "text/plain;charset=utf-8"): void => {
  const blob = new Blob([value], { type: mimeType });
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(downloadUrl);
};

