import * as ImagePicker from "expo-image-picker";

export async function pickPhoto(source: "camera" | "library"): Promise<string | null> {
  const permission =
    source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });

  if (!result.canceled && result.assets[0]) {
    return result.assets[0].uri;
  }
  return null;
}
