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
import { decodeSessionToken, type SessionClaims } from "@/lib/jwt";
import { fetchMuralPosts, type MuralPostRecord } from "@/lib/mural-api";
import { getSessionToken } from "@/lib/session";

type SearchResult = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  href: Href;
  // Extra terms a result should match on without being shown — lets
  // "banco", "hora extra" etc find "Banco de Horas" even though neither
  // phrase appears verbatim in its title/subtitle.
  keywords?: string;
};

// Every screen in the app, so search doubles as a command palette — not
// just a filter over user-generated content (documents, atestados, mural
// posts). Gated entries (role) mirror the same gating perfil.tsx already
// applies to its menu rows, so search never surfaces a destination the
// viewer wouldn't otherwise see.
function screenResults(role: SessionClaims["role"] | undefined): SearchResult[] {
  const results: SearchResult[] = [
    {
      id: "screen-ponto",
      icon: "time-outline",
      title: "Bater Ponto",
      subtitle: "Ponto",
      href: "/(tabs)",
      keywords: "registrar entrada saida horario",
    },
    {
      id: "screen-banco-de-horas",
      icon: "hourglass-outline",
      title: "Banco de Horas",
      subtitle: "Saldo, extras e compensações",
      href: "/(tabs)/banco-de-horas",
      keywords: "hora extra saldo compensacao",
    },
    {
      id: "screen-ferias",
      icon: "sunny-outline",
      title: "Férias",
      subtitle: "Solicitar e acompanhar",
      href: "/(tabs)/ferias",
      keywords: "descanso",
    },
    {
      id: "screen-documentos",
      icon: "document-text-outline",
      title: "Documentos",
      subtitle: "Admissionais, atestados, holerites, certificações",
      href: "/(tabs)/documentos",
    },
    {
      id: "screen-mural",
      icon: "megaphone-outline",
      title: "Mural",
      subtitle: "Avisos e aniversariantes",
      href: "/(tabs)/mural",
      keywords: "aviso comunicado aniversario",
    },
    {
      id: "screen-historico",
      icon: "receipt-outline",
      title: "Histórico de pontos",
      subtitle: "Ponto",
      href: "/historico",
    },
    {
      id: "screen-folha",
      icon: "document-text-outline",
      title: "Folha de ponto",
      subtitle: "Ponto",
      href: "/folha",
      keywords: "espelho de ponto exportar pdf",
    },
    {
      id: "screen-ajustar",
      icon: "briefcase-outline",
      title: "Ajustar meu ponto",
      subtitle: "Ponto",
      href: "/ajustar",
    },
    {
      id: "screen-solicitacoes",
      icon: "create-outline",
      title: "Solicitações de ajustes",
      subtitle: "Ponto",
      href: "/solicitacoes",
    },
    {
      id: "screen-perfil",
      icon: "person-outline",
      title: "Perfil",
      subtitle: "Meus dados e configurações",
      href: "/perfil",
    },
    {
      id: "screen-notificacoes",
      icon: "notifications-outline",
      title: "Notificações",
      subtitle: "Central de avisos",
      href: "/notificacoes",
    },
    {
      id: "screen-beneficios",
      icon: "gift-outline",
      title: "Benefícios e clube de vantagens",
      subtitle: "Perfil",
      href: "/beneficios",
    },
    {
      id: "screen-onboarding",
      icon: "rocket-outline",
      title: "Boas-vindas / Onboarding",
      subtitle: "Perfil",
      href: "/onboarding",
    },
    {
      id: "screen-operacional",
      icon: "construct-outline",
      title: "Operacional / TI",
      subtitle: "Perfil",
      href: "/operacional",
    },
  ];

  if (role && role !== "colaborador") {
    results.push({
      id: "screen-atestados-equipe",
      icon: "people-outline",
      title: "Atestados da equipe",
      subtitle: "Perfil · Gestão",
      href: "/atestados-equipe",
    });
  }

  return results;
}

const DIACRITICS_PATTERN = new RegExp("[̀-ͯ]", "g");

function normalize(value: string): string {
  return value.normalize("NFD").replace(DIACRITICS_PATTERN, "").toLowerCase();
}

export default function BuscaScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [claims, setClaims] = useState<SessionClaims | null>(null);
  const [atestados, setAtestados] = useState<AtestadoRecord[]>([]);
  const [certifications, setCertifications] = useState<CertificationRecord[]>([]);
  const [admissionDocuments, setAdmissionDocuments] = useState<AdmissionDocumentRecord[]>([]);
  const [muralPosts, setMuralPosts] = useState<MuralPostRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getSessionToken().then(async (token) => {
        if (!token) return;
        setClaims(decodeSessionToken(token));
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
    const results: SearchResult[] = [...screenResults(claims?.role)];

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
  }, [claims?.role, admissionDocuments, atestados, certifications, muralPosts]);

  const filtered = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return [];
    return allResults.filter(
      (result) =>
        normalize(result.title).includes(needle) ||
        normalize(result.subtitle).includes(needle) ||
        (result.keywords && normalize(result.keywords).includes(needle)),
    );
  }, [allResults, query]);

  return (
    <ThemedView style={styles.container}>
      <ScreenHeader title="Buscar" />
      <View style={styles.searchBox}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar telas, documentos, atestados, avisos..."
          placeholderTextColor={theme.textSecondary}
          autoFocus
          style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
        />
      </View>

      {query.trim() === "" ? (
        <EmptyState
          glyph="🔎"
          title="Busque em qualquer lugar do app"
          description="Telas, documentos, atestados, certificações e avisos do mural."
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
