import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import { TabBackground } from "@/components/tab-background";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { Elevation, Spacing } from "@/constants/theme";
import {
  UNREAD_WINDOW_DAYS,
  birthdaysThisMonthExcludingToday,
  birthdaysToday,
  formatRelativeDate,
  type Birthday,
} from "@/lib/mural";
import {
  fetchBirthdays,
  fetchMuralPosts,
  toggleMuralReaction,
  type MuralPostRecord,
} from "@/lib/mural-api";
import { getSessionToken } from "@/lib/session";

export default function MuralScreen() {
  const theme = useTheme();
  const [posts, setPosts] = useState<MuralPostRecord[]>([]);
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [unread, setUnread] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getSessionToken().then(async (token) => {
        if (!token) return;
        const [postsResult, birthdaysResult] = await Promise.all([
          fetchMuralPosts(token),
          fetchBirthdays(token),
        ]);
        if (cancelled) return;
        if (postsResult) {
          setPosts(postsResult);
          setUnread((current) => {
            // Only seed unread state the first time posts load — a post
            // already marked read shouldn't reset just because the list
            // refreshed on refocus.
            if (current.size > 0) return current;
            return new Set(
              postsResult
                .filter((post) => {
                  const days =
                    (Date.now() - new Date(post.createdAt).getTime()) / (24 * 60 * 60 * 1000);
                  return days <= UNREAD_WINDOW_DAYS;
                })
                .map((post) => post.id),
            );
          });
        }
        if (birthdaysResult) setBirthdays(birthdaysResult);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const todayBirthdays = useMemo(() => birthdaysToday(birthdays), [birthdays]);
  const monthBirthdays = useMemo(
    () => birthdaysThisMonthExcludingToday(birthdays),
    [birthdays],
  );

  function markRead(id: string) {
    setUnread((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  async function handleToggleReaction(id: string) {
    const token = await getSessionToken();
    if (!token) return;
    const result = await toggleMuralReaction(token, id);
    if (!result) return;
    setPosts((current) =>
      current.map((post) =>
        post.id === id
          ? { ...post, reactionCount: result.reactionCount, reacted: result.reacted }
          : post,
      ),
    );
  }

  return (
    <TabBackground>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedText type="title" style={styles.pageTitle}>
          Mural
        </ThemedText>

        {todayBirthdays.length > 0 ? (
          <View style={[styles.birthdayCard, { backgroundColor: theme.accent }, Elevation.card]}>
            <ThemedText style={styles.birthdayGlyph}>🎂</ThemedText>
            <View style={styles.birthdayText}>
              <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                Aniversariante(s) de hoje
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.onAccent }}>
                {todayBirthdays.map((b) => b.name).join(", ")}
              </ThemedText>
            </View>
          </View>
        ) : null}

        {monthBirthdays.length > 0 ? (
          <View style={styles.monthBirthdays}>
            <Ionicons name="gift-outline" size={16} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.monthBirthdaysText}>
              Também fazem aniversário este mês:{" "}
              {monthBirthdays.map((b) => `${b.name} (${String(b.day).padStart(2, "0")}/${String(b.month).padStart(2, "0")})`).join(", ")}
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.feed}>
          {posts.map((post) => {
            const isUnread = unread.has(post.id);
            return (
              <Pressable
                key={post.id}
                onPress={() => markRead(post.id)}
                style={[styles.card, { backgroundColor: theme.backgroundElement }, Elevation.card]}
              >
                <View style={styles.cardHeader}>
                  <ThemedText style={styles.cardGlyph}>{post.glyph}</ThemedText>
                  <View style={styles.cardHeaderText}>
                    <ThemedText type="smallBold">{post.title}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {formatRelativeDate(post.createdAt)}
                    </ThemedText>
                  </View>
                  {isUnread ? (
                    <View style={[styles.unreadDot, { backgroundColor: theme.secondary }]} />
                  ) : null}
                </View>
                <ThemedText type="small" style={styles.cardBody}>
                  {post.body}
                </ThemedText>
                <Pressable
                  onPress={() => handleToggleReaction(post.id)}
                  style={styles.reactionButton}
                  hitSlop={8}
                >
                  <Ionicons
                    name={post.reacted ? "heart" : "heart-outline"}
                    size={18}
                    color={post.reacted ? theme.accent : theme.textSecondary}
                  />
                  <ThemedText type="small" themeColor="textSecondary">
                    {post.reactionCount}
                  </ThemedText>
                </Pressable>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </TabBackground>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  pageTitle: {
    fontSize: 24,
    lineHeight: 30,
  },
  birthdayCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    borderRadius: 16,
    padding: Spacing.three,
  },
  birthdayGlyph: {
    fontSize: 32,
  },
  birthdayText: {
    flex: 1,
    gap: 2,
  },
  monthBirthdays: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.two,
  },
  monthBirthdaysText: {
    flex: 1,
  },
  feed: {
    gap: Spacing.three,
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
  cardGlyph: {
    fontSize: 24,
  },
  cardHeaderText: {
    flex: 1,
    gap: 2,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  cardBody: {
    lineHeight: 20,
  },
  reactionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    alignSelf: "flex-start",
  },
});
