import { ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";
import { BENEFIT_BALANCES, PARTNERS, formatBRL } from "@/lib/beneficios";

export default function BeneficiosScreen() {
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <ScreenHeader title="Benefícios" />
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="smallBold">Saldo dos benefícios</ThemedText>
        {BENEFIT_BALANCES.map((benefit) => (
          <View key={benefit.id} style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
            <Ionicons name={benefit.icon} size={22} color={theme.secondary} />
            <View style={styles.rowContent}>
              <ThemedText type="smallBold">{benefit.label}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Crédito mensal: {formatBRL(benefit.monthlyCredit)}
              </ThemedText>
            </View>
            <ThemedText type="smallBold">{formatBRL(benefit.balance)}</ThemedText>
          </View>
        ))}

        <ThemedText type="smallBold" style={styles.sectionTitle}>
          Clube de vantagens
        </ThemedText>
        {PARTNERS.map((partner) => (
          <View key={partner.id} style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
            <Ionicons name="pricetag-outline" size={22} color={theme.accent} />
            <View style={styles.rowContent}>
              <ThemedText type="smallBold">{partner.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {partner.category}
              </ThemedText>
            </View>
            <ThemedText type="small" style={{ color: theme.accent }}>
              {partner.discount}
            </ThemedText>
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
  content: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  sectionTitle: {
    marginTop: Spacing.three,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    borderRadius: 14,
    padding: Spacing.three,
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
});
