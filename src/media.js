// Image attachments for the main composer. Files are read as
// base64 in the browser and sent inline with the post request;
// tweet-gas uploads them to X and attaches the returned media ids.
// The limits mirror the server side (tweet-gas validateMediaItem).
export const MAX_MEDIA = 4;
export const MAX_MEDIA_BYTES = 5 * 1024 * 1024;
export const MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

// Returns an error message for a file that cannot be attached, or
// null when the file is usable.
export function mediaFileError(file) {
  if (!file) return "ファイルが選ばれていません";
  if (!MEDIA_TYPES.includes(file.type)) {
    return "対応していない形式です（JPEG / PNG / GIF / WebP のみ）";
  }
  if (file.size > MAX_MEDIA_BYTES) {
    return "画像が大きすぎます（1枚あたり5MBまで）";
  }
  return null;
}

// Reads a File into a { data, type } media item, where data is the
// base64 payload without the data URL prefix. FileReaderImpl is
// injectable for tests.
export function fileToMediaItem(file, FileReaderImpl = FileReader) {
  return new Promise((resolve, reject) => {
    const reader = new FileReaderImpl();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve({ data: comma >= 0 ? result.slice(comma + 1) : result, type: file.type });
    };
    reader.onerror = () => reject(reader.error || new Error("ファイルを読み込めませんでした"));
    reader.readAsDataURL(file);
  });
}

// A data URL for previewing an attached media item.
export function mediaPreviewUrl(item) {
  return `data:${item.type};base64,${item.data}`;
}
