import { Modal, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ThemedButton } from "./themed-button";
import { ThemedText } from "./themed-text";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";
import type { SessionClaims } from "@/lib/jwt";

const ROLE_LABEL: Record<SessionClaims["role"], string> = {
  colaborador: "Colaborador",
  gestor: "Gestor",
  rh: "RH",
};

type PunchConfirmationModalProps = {
  visible: boolean;
  onClose: () => void;
  clockedAt: Date | null;
  claims: SessionClaims | null;
};

export function PunchConfirmationModal({
  visible,
  onClose,
  clockedAt,
  claims,
}: PunchConfirmationModalProps) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.card, { backgroundColor: theme.backgroundElement }]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={[styles.badge, { backgroundColor: theme.success }]}>
            <Ionicons name="checkmark" size={28} color="#ffffff" />
          </View>
          <ThemedText type="subtitle" style={styles.title}>
            Ponto registrado
          </ThemedText>
          {clockedAt ? (
            <ThemedText type="title" themeColor="success" style={styles.time}>
              {clockedAt.toLocaleTimeString("pt-BR")}
            </ThemedText>
          ) : null}

          <View style={[styles.details, { backgroundColor: theme.background }]}>
            {clockedAt ? (
              <DetailRow
                label="Data"
                value={clockedAt.toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              />
            ) : null}
            <DetailRow label="Colaborador" value={claims?.name ?? "—"} />
            <DetailRow label="Perfil" value={claims ? ROLE_LABEL[claims.role] : "—"} />
            <DetailRow label="Empregador" value="DCIT Tecnologia" />
          </View>

          <ThemedButton title="Fechar" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.four,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    padding: Spacing.four,
    alignItems: "center",
    gap: Spacing.two,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.one,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
  },
  time: {
    fontSize: 36,
    lineHeight: 42,
    marginBottom: Spacing.three,
  },
  details: {
    alignSelf: "stretch",
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
});
