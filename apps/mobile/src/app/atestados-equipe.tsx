import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";
import { DOCUMENT_STATUS_LABEL, type DocumentStatus } from "@/lib/documentos";
import { decodeSessionToken, type SessionClaims } from "@/lib/jwt";
import { getSessionToken } from "@/lib/session";
import {
  fetchTeamAtestados,
  updateAtestadoStatus,
  type AtestadoRecord,
} from "@/lib/atestados-api";

function StatusBadge({ status }: { status: string }) {
  const theme = useTheme();
  const color: Record<string, string> = {
    enviado: theme.secondary,
    em_analise: theme.secondary,
    aprovado: theme.success,
    recusado: theme.accent,
  };
  const label = DOCUMENT_STATUS_LABEL[status as DocumentStatus] ?? status;
  return (
    <View style={[styles.statusBadge, { backgroundColor: color[status] ?? theme.secondary }]}>
      <ThemedText type="small" style={{ color: theme.onAccent }}>
        {label}
      </ThemedText>
    </View>
  );
}

export default function AtestadosEquipeScreen() {
  const theme = useTheme();
  const [claims, setClaims] = useState<SessionClaims | null>(null);
  const [atestados, setAtestados] = useState<AtestadoRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getSessionToken().then(async (token) => {
        if (!token) return;
        setClaims(decodeSessionToken(token));
        const result = await fetchTeamAtestados(token);
        if (!cancelled && result) setAtestados(result);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // RH is the only role the spec allows to see clinical fields (CID, CRM,
  // médico) — everyone else (including this screen's default, unresolved
  // state) gets the aggregated view: who, status, days. Never the reverse.
  // The backend already masks these fields for a non-RH caller, so this is
  // belt-and-suspenders, not the only line of defense.
  const canSeeClinicalDetails = claims?.role === "rh";

  async function handleDecision(id: string, status: "aprovado" | "recusado") {
    const token = await getSessionToken();
    if (!token) return;
    const updated = await updateAtestadoStatus(token, id, status);
    if (!updated) return;
    setAtestados((current) => current.map((a) => (a.id === id ? updated : a)));
  }

  return (
    <ThemedView style={styles.container}>
      <ScreenHeader title="Atestados da equipe" />
      <ThemedText type="small" themeColor="textSecondary" style={styles.disclaimer}>
        {canSeeClinicalDetails
          ? "Como RH, você vê os dados clínicos do atestado."
          : "Como gestor, você vê apenas o resultado da aprovação — CID, médico e CRM são visíveis somente ao RH (LGPD)."}
      </ThemedText>
      <ScrollView contentContainerStyle={styles.list}>
        {atestados.map((atestado) => (
          <View key={atestado.id} style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="person-circle-outline" size={22} color={theme.secondary} />
              <ThemedText type="smallBold" style={styles.name}>
                {atestado.userName}
              </ThemedText>
              <StatusBadge status={atestado.status} />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {atestado.dias} dia(s) · {new Date(atestado.createdAt).toLocaleDateString("pt-BR")}
            </ThemedText>
            {canSeeClinicalDetails ? (
              <View style={[styles.clinicalBox, { backgroundColor: theme.background }]}>
                <ThemedText type="small">CID: {atestado.cid}</ThemedText>
                <ThemedText type="small">Médico: {atestado.medico}</ThemedText>
                <ThemedText type="small">CRM: {atestado.crm}</ThemedText>
              </View>
            ) : null}
            {atestado.status === "enviado" ? (
              <View style={styles.actions}>
                <Pressable
                  style={[styles.actionButton, { backgroundColor: theme.success }]}
                  onPress={() => handleDecision(atestado.id, "aprovado")}
                >
                  <ThemedText type="small" style={{ color: theme.onAccent }}>
                    Aprovar
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.actionButton, { backgroundColor: theme.accent }]}
                  onPress={() => handleDecision(atestado.id, "recusado")}
                >
                  <ThemedText type="small" style={{ color: theme.onAccent }}>
                    Recusar
                  </ThemedText>
                </Pressable>
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  disclaimer: {
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.two,
  },
  list: {
    padding: Spacing.four,
    paddingTop: 0,
    gap: Spacing.two,
  },
  card: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  name: {
    flex: 1,
  },
  statusBadge: {
    borderRadius: 8,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  clinicalBox: {
    borderRadius: 12,
    padding: Spacing.two,
    gap: 2,
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  actionButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: Spacing.two,
    alignItems: "center",
  },
});
