import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { TabBackground } from "@/components/tab-background";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";
import {
  ANNOUNCEMENTS,
  UNREAD_WINDOW_DAYS,
  birthdaysThisMonthExcludingToday,
  birthdaysToday,
  formatRelativeDate,
} from "@/lib/mural";

export default function MuralScreen() {
  const theme = useTheme();
  const todayBirthdays = useMemo(() => birthdaysToday(), []);
  const monthBirthdays = useMemo(() => birthdaysThisMonthExcludingToday(), []);

  const sorted = useMemo(
    () =>
      ANNOUNCEMENTS.slice().sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [],
  );

  const [unread, setUnread] = useState<Set<string>>(
    () =>
      new Set(
        sorted
          .filter((post) => {
            const days =
              (Date.now() - new Date(post.createdAt).getTime()) / (24 * 60 * 60 * 1000);
            return days <= UNREAD_WINDOW_DAYS;
          })
          .map((post) => post.id),
      ),
  );
  const [reactions, setReactions] = useState<Record<string, { reacted: boolean; count: number }>>(
    () =>
      Object.fromEntries(
        sorted.map((post) => [post.id, { reacted: false, count: post.reactionCount }]),
      ),
  );

  function markRead(id: string) {
    setUnread((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  function toggleReaction(id: string) {
    setReactions((current) => {
      const entry = current[id];
      return {
        ...current,
        [id]: {
          reacted: !entry.reacted,
          count: entry.reacted ? entry.count - 1 : entry.count + 1,
        },
      };
    });
  }

  return (
    <TabBackground>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedText type="title" style={styles.pageTitle}>
          Mural
        </ThemedText>

        {todayBirthdays.length > 0 ? (
          <View style={[styles.birthdayCard, { backgroundColor: theme.accent }]}>
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
          {sorted.map((post) => {
            const isUnread = unread.has(post.id);
            const reaction = reactions[post.id];
            return (
              <Pressable
                key={post.id}
                onPress={() => markRead(post.id)}
                style={[styles.card, { backgroundColor: theme.backgroundElement }]}
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
                  onPress={() => toggleReaction(post.id)}
                  style={styles.reactionButton}
                  hitSlop={8}
                >
                  <Ionicons
                    name={reaction.reacted ? "heart" : "heart-outline"}
                    size={18}
                    color={reaction.reacted ? theme.accent : theme.textSecondary}
                  />
                  <ThemedText type="small" themeColor="textSecondary">
                    {reaction.count}
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
