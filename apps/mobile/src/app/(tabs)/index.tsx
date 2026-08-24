import { useState } from "react";
import { Button, StyleSheet } from "react-native";
import type { TimeEntryInput } from "@ponto-dcit/shared-types";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

const API_URL = "http://localhost:3000/time-entries";

export default function HomeScreen() {
  const [message, setMessage] = useState<string | null>(null);

  async function handlePress() {
    const payload: TimeEntryInput = {
      userId: "demo-user",
      clockedAt: new Date().toISOString(),
    };

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setMessage(response.ok ? "Ponto registrado" : "Falha ao registrar ponto");
    } catch {
      setMessage("Falha ao registrar ponto");
    }
  }

  return (
    <ThemedView style={styles.container}>
      <Button title="Bater Ponto" onPress={handlePress} />
      {message ? <ThemedText>{message}</ThemedText> : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
