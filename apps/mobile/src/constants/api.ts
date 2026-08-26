// EXPO_PUBLIC_API_URL must be the API's LAN address (not "localhost") so a
// physical device on the same Wi-Fi network can reach it — "localhost" on
// a phone resolves to the phone itself, not this machine.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
