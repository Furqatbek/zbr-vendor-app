import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, TextInput, Modal,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { fetchMenuCategories, createMenuCategory, updateMenuCategory, deleteMenuCategory as apiDeleteCategory } from '../../services/api';
import type { MenuCategory, CreateMenuCategoryRequest } from '../../types';
import Card from '../../components/Card';
import { useT } from '../../i18n';

export default function MenuScreen() {
  const restaurant = useAuthStore((s) => s.restaurant);
  const t = useT();

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add category modal
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);

  // Edit category modal
  const [showEditCategory, setShowEditCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  const loadCategories = useCallback(async () => {
    if (!restaurant) return;
    try {
      const res = await fetchMenuCategories(restaurant.id);
      setCategories(res.data ?? []);
    } catch {
      // silent
    }
  }, [restaurant]);

  useEffect(() => {
    loadCategories().finally(() => setLoading(false));
  }, [loadCategories]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadCategories();
    setRefreshing(false);
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim() || !restaurant || addingCategory) return;
    setAddingCategory(true);
    try {
      const data: CreateMenuCategoryRequest = {
        name: newCategoryName.trim(),
        description: newCategoryDesc.trim() || undefined,
        sortOrder: categories.length,
      };
      await createMenuCategory(restaurant.id, data);
      setNewCategoryName('');
      setNewCategoryDesc('');
      setShowAddCategory(false);
      await loadCategories();
    } catch {
      // TODO: error toast
    } finally {
      setAddingCategory(false);
    }
  };

  const handleEditCategory = (cat: MenuCategory) => {
    setEditingCategory(cat);
    setEditName(cat.name);
    setEditDesc(cat.description ?? '');
    setShowEditCategory(true);
  };

  const handleSaveCategory = async () => {
    if (!editingCategory || !restaurant || savingCategory) return;
    setSavingCategory(true);
    try {
      await updateMenuCategory(restaurant.id, editingCategory.id, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
        sortOrder: editingCategory.sortOrder,
      });
      setShowEditCategory(false);
      await loadCategories();
    } catch {
      // TODO: error toast
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = (cat: MenuCategory) => {
    if (!restaurant) return;
    Alert.alert(t('common.delete'), t('menu.deleteCategoryConfirm', { name: cat.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive', onPress: async () => {
          try {
            await apiDeleteCategory(restaurant.id, cat.id);
            await loadCategories();
          } catch {
            // TODO: error toast
          }
        },
      },
    ]);
  };

  const renderCategory = ({ item }: { item: MenuCategory }) => (
    <Card style={styles.categoryCard}>
      <TouchableOpacity
        style={styles.categoryRow}
        onPress={() => handleEditCategory(item)}
        activeOpacity={0.7}
      >
        <View style={styles.categoryIconWrap}>
          <Ionicons name="grid-outline" size={20} color={Colors.accent} />
        </View>
        <View style={styles.categoryInfo}>
          <Text style={styles.categoryName}>{item.name}</Text>
          {item.description ? (
            <Text style={styles.categoryDesc} numberOfLines={1}>{item.description}</Text>
          ) : null}
          <Text style={styles.categoryCount}>{t('menu.itemsCount', { count: item.itemCount })}</Text>
        </View>
        <TouchableOpacity
          onPress={() => handleDeleteCategory(item)}
          style={styles.deleteButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={18} color={Colors.danger} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Card>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={categories}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderCategory}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.accent} colors={[Colors.accent]} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={48} color={Colors.gray300} />
            <Text style={styles.emptyText}>{t('menu.noCategories')}</Text>
          </View>
        }
        ListFooterComponent={
          <TouchableOpacity style={styles.addButton} onPress={() => setShowAddCategory(true)}>
            <Ionicons name="add-circle" size={20} color={Colors.accent} />
            <Text style={styles.addButtonText}>{t('menu.addCategory')}</Text>
          </TouchableOpacity>
        }
      />

      {/* Add Category Modal */}
      <Modal visible={showAddCategory} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('menu.newCategory')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('menu.categoryName')}
              placeholderTextColor={Colors.gray400}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              autoFocus
              maxLength={100}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('menu.categoryDescription')}
              placeholderTextColor={Colors.gray400}
              value={newCategoryDesc}
              onChangeText={setNewCategoryDesc}
              multiline
              maxLength={500}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => { setShowAddCategory(false); setNewCategoryName(''); setNewCategoryDesc(''); }}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmButton, addingCategory && styles.buttonDisabled]}
                onPress={handleAddCategory}
                disabled={addingCategory}
              >
                {addingCategory ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>{t('common.add')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Category Modal */}
      <Modal visible={showEditCategory} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('menu.editCategory')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('menu.categoryName')}
              placeholderTextColor={Colors.gray400}
              value={editName}
              onChangeText={setEditName}
              autoFocus
              maxLength={100}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('menu.categoryDescription')}
              placeholderTextColor={Colors.gray400}
              value={editDesc}
              onChangeText={setEditDesc}
              multiline
              maxLength={500}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowEditCategory(false)}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmButton, savingCategory && styles.buttonDisabled]}
                onPress={handleSaveCategory}
                disabled={savingCategory}
              >
                {savingCategory ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>{t('profile.save')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.gray50 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: Spacing.base, paddingBottom: 100 },
  categoryCard: { marginBottom: Spacing.sm },
  categoryRow: { flexDirection: 'row', alignItems: 'center' },
  categoryIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.accentLight, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  categoryInfo: { flex: 1 },
  categoryName: { ...Typography.headline, color: Colors.black },
  categoryDesc: { ...Typography.footnote, color: Colors.gray500, marginTop: 2 },
  categoryCount: { ...Typography.caption1, color: Colors.gray400, marginTop: 2 },
  deleteButton: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.base, gap: Spacing.sm, minHeight: 48 },
  addButtonText: { ...Typography.headline, color: Colors.accent },
  emptyContainer: { alignItems: 'center', paddingTop: Spacing['3xl'], gap: Spacing.md },
  emptyText: { ...Typography.body, color: Colors.gray400 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: Colors.white, borderRadius: BorderRadius.card, padding: Spacing.xl, width: '85%' },
  modalTitle: { ...Typography.title3, color: Colors.black },
  input: { borderWidth: 1, borderColor: Colors.gray200, borderRadius: BorderRadius.chip, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, ...Typography.body, marginTop: Spacing.sm, minHeight: 48 },
  textArea: { height: 80, textAlignVertical: 'top' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: Spacing.xl, gap: Spacing.md },
  modalCancelButton: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, minHeight: 44, justifyContent: 'center' },
  modalCancelText: { ...Typography.headline, color: Colors.gray500 },
  modalConfirmButton: { backgroundColor: Colors.accent, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: BorderRadius.button, minHeight: 44, justifyContent: 'center' },
  modalConfirmText: { ...Typography.headline, color: Colors.white },
  buttonDisabled: { opacity: 0.5 },
});
