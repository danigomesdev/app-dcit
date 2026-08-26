import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  DOCUMENT_STATUS_LABEL,
  type DocumentStatus,
} from "@/context/documentos-context";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";
import { decodeSessionToken, type SessionClaims } from "@/lib/jwt";
import { getSessionToken } from "@/lib/session";
import { TEAM_ATESTADOS } from "@/lib/documentos";

function StatusBadge({ status }: { status: DocumentStatus }) {
  const theme = useTheme();
  const color: Record<DocumentStatus, string> = {
    enviado: theme.secondary,
    em_analise: theme.secondary,
    aprovado: theme.success,
    recusado: theme.accent,
  };
  return (
    <View style={[styles.statusBadge, { backgroundColor: color[status] }]}>
      <ThemedText type="small" style={{ color: theme.onAccent }}>
        {DOCUMENT_STATUS_LABEL[status]}
      </ThemedText>
    </View>
  );
}

export default function AtestadosEquipeScreen() {
  const theme = useTheme();
  const [claims, setClaims] = useState<SessionClaims | null>(null);

  useEffect(() => {
    getSessionToken().then((token) => {
      if (token) setClaims(decodeSessionToken(token));
    });
  }, []);

  // RH is the only role the spec allows to see clinical fields (CID, CRM,
  // médico) — everyone else (including this screen's default, unresolved
  // state) gets the aggregated view: who, status, days. Never the reverse.
  const canSeeClinicalDetails = claims?.role === "rh";

  return (
    <ThemedView style={styles.container}>
      <ScreenHeader title="Atestados da equipe" />
      <ThemedText type="small" themeColor="textSecondary" style={styles.disclaimer}>
        {canSeeClinicalDetails
          ? "Como RH, você vê os dados clínicos do atestado."
          : "Como gestor, você vê apenas o resultado da aprovação — CID, médico e CRM são visíveis somente ao RH (LGPD)."}
      </ThemedText>
      <ScrollView contentContainerStyle={styles.list}>
        {TEAM_ATESTADOS.map((atestado) => (
          <View key={atestado.id} style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="person-circle-outline" size={22} color={theme.secondary} />
              <ThemedText type="smallBold" style={styles.name}>
                {atestado.colaborador}
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
});
