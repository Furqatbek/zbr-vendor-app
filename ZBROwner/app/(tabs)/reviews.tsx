import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../../constants/theme';
import { useStore } from '../../store';
import type { Review } from '../../types';
import Card from '../../components/Card';
import RatingStars from '../../components/RatingStars';
import Chip from '../../components/Chip';
import { useT } from '../../i18n';

type Filter = 'all' | 'positive' | 'negative' | 'unresponded';

const filterKeys: Record<Filter, string> = {
  all: 'common.all',
  positive: 'reviews.positive',
  negative: 'reviews.negative',
  unresponded: 'reviews.unresponded',
};

export default function ReviewsScreen() {
  const { reviews, replyToReview } = useStore();
  const t = useT();
  const [filter, setFilter] = useState<Filter>('all');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const overallRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  }, [reviews]);

  const ratingDistribution = useMemo(() => {
    const dist = [0, 0, 0, 0, 0];
    reviews.forEach((r) => dist[r.rating - 1]++);
    return dist.reverse(); // 5 star first
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    switch (filter) {
      case 'positive': return reviews.filter((r) => r.rating >= 4);
      case 'negative': return reviews.filter((r) => r.rating <= 2);
      case 'unresponded': return reviews.filter((r) => !r.replied);
      default: return reviews;
    }
  }, [reviews, filter]);

  const handleReply = () => {
    if (replyingTo && replyText.trim()) {
      replyToReview(replyingTo, replyText.trim());
      setReplyingTo(null);
      setReplyText('');
    }
  };

  const renderReview = ({ item }: { item: Review }) => (
    <Card style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View>
          <Text style={styles.reviewerName}>{item.customerName}</Text>
          <Text style={styles.reviewDate}>{item.date}</Text>
        </View>
        <View style={styles.reviewMeta}>
          <RatingStars rating={item.rating} size={14} />
          <View style={styles.platformBadge}>
            <Text style={styles.platformText}>{item.platform}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.reviewComment}>{item.comment}</Text>
      <Text style={styles.reviewItems}>
        {item.orderItems.join(' · ')}
      </Text>
      {item.replied && item.replyText && (
        <View style={styles.replyBox}>
          <Text style={styles.replyLabel}>{t('reviews.yourReply')}</Text>
          <Text style={styles.replyText}>{item.replyText}</Text>
        </View>
      )}
      <View style={styles.reviewActions}>
        {!item.replied && (
          <TouchableOpacity style={styles.replyButton} onPress={() => setReplyingTo(item.id)}>
            <Ionicons name="chatbubble-outline" size={16} color={Colors.accent} />
            <Text style={styles.replyButtonText}>{t('reviews.reply')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.flagButton}
          onPress={() => Alert.alert(t('reviews.report'), t('reviews.reviewFlagged'))}
        >
          <Ionicons name="flag-outline" size={16} color={Colors.gray400} />
        </TouchableOpacity>
      </View>
    </Card>
  );

  const maxCount = Math.max(...ratingDistribution, 1);

  const renderHeader = () => (
    <View>
      {/* Overall Rating */}
      <Card style={styles.overallCard}>
        <Text style={styles.overallRating}>{overallRating.toFixed(1)}</Text>
        <RatingStars rating={Math.round(overallRating)} size={24} />
        <Text style={styles.overallCount}>{t('reviews.reviewsCount', { count: reviews.length })}</Text>
      </Card>

      {/* Rating Distribution */}
      <Card style={styles.distributionCard}>
        {ratingDistribution.map((count, index) => {
          const starNum = 5 - index;
          return (
            <View key={starNum} style={styles.distRow}>
              <Text style={styles.distStar}>{starNum}</Text>
              <Ionicons name="star" size={12} color={Colors.warning} />
              <View style={styles.distBarBg}>
                <View style={[styles.distBarFill, { width: `${(count / maxCount) * 100}%` }]} />
              </View>
              <Text style={styles.distCount}>{count}</Text>
            </View>
          );
        })}
      </Card>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        {(['all', 'positive', 'negative', 'unresponded'] as Filter[]).map((f) => (
          <Chip
            key={f}
            label={t(filterKeys[f] as any)}
            selected={filter === f}
            onPress={() => setFilter(f)}
          />
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={filteredReviews}
        keyExtractor={(item) => item.id}
        renderItem={renderReview}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Reply Modal */}
      <Modal visible={replyingTo !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('reviews.replyToReview')}</Text>
              <TouchableOpacity onPress={() => { setReplyingTo(null); setReplyText(''); }}>
                <Ionicons name="close" size={24} color={Colors.gray600} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.replyInput}
              placeholder={t('reviews.writeReply')}
              value={replyText}
              onChangeText={setReplyText}
              multiline
              autoFocus
            />
            <TouchableOpacity
              style={[styles.submitButton, !replyText.trim() && styles.submitDisabled]}
              onPress={handleReply}
              disabled={!replyText.trim()}
            >
              <Text style={styles.submitText}>{t('reviews.submitReply')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.gray50 },
  listContent: { padding: Spacing.base, paddingBottom: 100 },
  overallCard: { alignItems: 'center', marginBottom: Spacing.base, gap: Spacing.sm },
  overallRating: { ...Typography.largeTitle, color: Colors.black, fontSize: 48 },
  overallCount: { ...Typography.footnote, color: Colors.gray500 },
  distributionCard: { marginBottom: Spacing.base },
  distRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 },
  distStar: { ...Typography.footnote, color: Colors.gray600, width: 14, textAlign: 'right' },
  distBarBg: { flex: 1, height: 8, backgroundColor: Colors.gray100, borderRadius: 4 },
  distBarFill: { height: 8, backgroundColor: Colors.warning, borderRadius: 4 },
  distCount: { ...Typography.footnote, color: Colors.gray500, width: 24, textAlign: 'right' },
  filterRow: { flexDirection: 'row', marginBottom: Spacing.base },
  reviewCard: { marginBottom: Spacing.sm },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  reviewerName: { ...Typography.headline, color: Colors.black },
  reviewDate: { ...Typography.caption1, color: Colors.gray500, marginTop: 2 },
  reviewMeta: { alignItems: 'flex-end', gap: 4 },
  platformBadge: { backgroundColor: Colors.accentLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  platformText: { ...Typography.caption2, color: Colors.accent, fontWeight: '600' },
  reviewComment: { ...Typography.body, color: Colors.gray700, marginTop: Spacing.sm },
  reviewItems: { ...Typography.footnote, color: Colors.gray400, marginTop: Spacing.sm },
  replyBox: { backgroundColor: Colors.gray50, borderRadius: BorderRadius.chip, padding: Spacing.md, marginTop: Spacing.sm },
  replyLabel: { ...Typography.caption1, color: Colors.gray500, fontWeight: '600' },
  replyText: { ...Typography.subhead, color: Colors.gray700, marginTop: 4 },
  reviewActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.gray100, paddingTop: Spacing.sm },
  replyButton: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: Spacing.sm },
  replyButtonText: { ...Typography.subhead, color: Colors.accent, fontWeight: '600' },
  flagButton: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.white, borderTopLeftRadius: BorderRadius.card, borderTopRightRadius: BorderRadius.card, padding: Spacing.xl, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.base },
  modalTitle: { ...Typography.title3, color: Colors.black },
  replyInput: { borderWidth: 1, borderColor: Colors.gray200, borderRadius: BorderRadius.chip, padding: Spacing.md, ...Typography.body, height: 100, textAlignVertical: 'top' },
  submitButton: { backgroundColor: Colors.accent, borderRadius: BorderRadius.button, paddingVertical: 14, alignItems: 'center', marginTop: Spacing.base, minHeight: 48 },
  submitDisabled: { opacity: 0.5 },
  submitText: { ...Typography.headline, color: Colors.white },
});
