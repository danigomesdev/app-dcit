import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter, type Href } from "expo-router";

import { EmptyState } from "@/components/empty-state";
import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";
import { fetchMyAtestados, type AtestadoRecord } from "@/lib/atestados-api";
import {
  fetchAdmissionDocuments,
  fetchCertifications,
  type AdmissionDocumentRecord,
  type CertificationRecord,
} from "@/lib/documentos-api";
import { fetchMuralPosts, type MuralPostRecord } from "@/lib/mural-api";
import { getSessionToken } from "@/lib/session";

type SearchResult = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  href: Href;
};

const DIACRITICS_PATTERN = new RegExp("[̀-ͯ]", "g");

function normalize(value: string): string {
  return value.normalize("NFD").replace(DIACRITICS_PATTERN, "").toLowerCase();
}

export default function BuscaScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [atestados, setAtestados] = useState<AtestadoRecord[]>([]);
  const [certifications, setCertifications] = useState<CertificationRecord[]>([]);
  const [admissionDocuments, setAdmissionDocuments] = useState<AdmissionDocumentRecord[]>([]);
  const [muralPosts, setMuralPosts] = useState<MuralPostRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getSessionToken().then(async (token) => {
        if (!token) return;
        const [atestadoResult, certResult, admissionResult, muralResult] = await Promise.all([
          fetchMyAtestados(token),
          fetchCertifications(token),
          fetchAdmissionDocuments(token),
          fetchMuralPosts(token),
        ]);
        if (cancelled) return;
        if (atestadoResult) setAtestados(atestadoResult);
        if (certResult) setCertifications(certResult);
        if (admissionResult) setAdmissionDocuments(admissionResult);
        if (muralResult) setMuralPosts(muralResult);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const allResults = useMemo<SearchResult[]>(() => {
    const results: SearchResult[] = [];

    for (const doc of admissionDocuments) {
      results.push({
        id: `adm-${doc.id}`,
        icon: "document-text-outline",
        title: doc.title,
        subtitle: "Documentos · Admissionais",
        href: "/(tabs)/documentos",
      });
    }
    for (const atestado of atestados) {
      results.push({
        id: `atestado-${atestado.id}`,
        icon: "medkit-outline",
        title: `Atestado · ${atestado.dias} dia(s)`,
        subtitle: "Documentos · Atestados",
        href: "/(tabs)/documentos",
      });
    }
    for (const cert of certifications) {
      results.push({
        id: `cert-${cert.id}`,
        icon: "ribbon-outline",
        title: cert.name,
        subtitle: `Documentos · Certificações · ${cert.institution}`,
        href: "/(tabs)/documentos",
      });
    }
    for (const post of muralPosts) {
      results.push({
        id: `mural-${post.id}`,
        icon: "megaphone-outline",
        title: post.title,
        subtitle: "Mural",
        href: "/(tabs)/mural",
      });
    }

    return results;
  }, [admissionDocuments, atestados, certifications, muralPosts]);

  const filtered = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return [];
    return allResults.filter(
      (result) => normalize(result.title).includes(needle) || normalize(result.subtitle).includes(needle),
    );
  }, [allResults, query]);

  return (
    <ThemedView style={styles.container}>
      <ScreenHeader title="Buscar" />
      <View style={styles.searchBox}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar documentos, atestados, avisos..."
          placeholderTextColor={theme.textSecondary}
          autoFocus
          style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
        />
      </View>

      {query.trim() === "" ? (
        <EmptyState
          glyph="🔎"
          title="Busque no seu conteúdo"
          description="Documentos, atestados, certificações e avisos do mural."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          glyph="🔎"
          title="Nada encontrado"
          description={`Nenhum resultado para "${query}".`}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {filtered.map((result) => (
            <Pressable
              key={result.id}
              onPress={() => router.push(result.href)}
              style={[styles.row, { backgroundColor: theme.backgroundElement }]}
            >
              <Ionicons name={result.icon} size={20} color={theme.secondary} />
              <View style={styles.rowContent}>
                <ThemedText type="smallBold">{result.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {result.subtitle}
                </ThemedText>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBox: {
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.two,
  },
  input: {
    borderRadius: 12,
    padding: Spacing.three,
    fontSize: 16,
  },
  list: {
    padding: Spacing.four,
    paddingTop: 0,
    gap: Spacing.two,
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
