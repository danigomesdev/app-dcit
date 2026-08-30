import * as FileSystem from "expo-file-system/legacy";

export function mediaTypeFor(uri: string): "image/jpeg" | "image/png" {
  return uri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
}

export async function readPhotoAsDataUrl(uri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:${mediaTypeFor(uri)};base64,${base64}`;
}
