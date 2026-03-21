import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Switch, Alert, TextInput, Modal,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../../constants/theme';
import { useStore } from '../../store';
import type { MenuCategory, MenuItem } from '../../types';
import Card from '../../components/Card';

type ViewMode = 'categories' | 'items';

export default function MenuScreen() {
  const {
    categories, menuItems,
    toggleCategoryActive, toggleItemStock, addCategory, deleteMenuItem,
  } = useStore();

  const [viewMode, setViewMode] = useState<ViewMode>('categories');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showEditItem, setShowEditItem] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  const selectedItems = selectedCategoryId
    ? menuItems.filter((i) => i.categoryId === selectedCategoryId)
    : menuItems;

  const handleDeleteItem = useCallback((item: MenuItem) => {
    Alert.alert('Delete Item', `Remove "${item.name}" from the menu?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMenuItem(item.id) },
    ]);
  }, [deleteMenuItem]);

  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      addCategory(newCategoryName.trim());
      setNewCategoryName('');
      setShowAddCategory(false);
    }
  };

  const renderCategory = ({ item }: { item: MenuCategory }) => (
    <Card style={styles.categoryCard}>
      <TouchableOpacity
        style={styles.categoryRow}
        onPress={() => { setSelectedCategoryId(item.id); setViewMode('items'); }}
        activeOpacity={0.7}
      >
        <View style={styles.dragHandle}>
          <Ionicons name="reorder-three" size={24} color={Colors.gray400} />
        </View>
        <View style={styles.categoryInfo}>
          <Text style={styles.categoryName}>{item.name}</Text>
          <Text style={styles.categoryCount}>{item.itemCount} items</Text>
        </View>
        <Switch
          value={item.isActive}
          onValueChange={() => toggleCategoryActive(item.id)}
          trackColor={{ false: Colors.gray300, true: Colors.accentLight }}
          thumbColor={item.isActive ? Colors.accent : Colors.gray400}
        />
      </TouchableOpacity>
    </Card>
  );

  const renderMenuItem = ({ item }: { item: MenuItem }) => (
    <Card style={styles.menuItemCard}>
      <View style={styles.menuItemRow}>
        <View style={styles.menuItemImagePlaceholder}>
          <Ionicons name="image-outline" size={24} color={Colors.gray400} />
        </View>
        <View style={styles.menuItemInfo}>
          <Text style={styles.menuItemName}>{item.name}</Text>
          <Text style={styles.menuItemDesc} numberOfLines={1}>{item.description}</Text>
          <Text style={styles.menuItemPrice}>${item.price.toFixed(2)}</Text>
        </View>
        <View style={styles.menuItemActions}>
          {!item.inStock && (
            <View style={styles.outOfStockBadge}>
              <Text style={styles.outOfStockText}>Out</Text>
            </View>
          )}
          <Switch
            value={item.inStock}
            onValueChange={() => toggleItemStock(item.id)}
            trackColor={{ false: Colors.dangerLight, true: Colors.successLight }}
            thumbColor={item.inStock ? Colors.success : Colors.danger}
          />
          <TouchableOpacity
            onPress={() => { setEditingItem(item); setShowEditItem(true); }}
            style={styles.editButton}
            accessibilityLabel="Edit item"
          >
            <Ionicons name="pencil" size={18} color={Colors.accent} />
          </TouchableOpacity>
        </View>
      </View>
      <TouchableOpacity
        style={styles.deleteSwipe}
        onPress={() => handleDeleteItem(item)}
        accessibilityLabel="Delete item"
      >
        <Ionicons name="trash-outline" size={16} color={Colors.danger} />
        <Text style={styles.deleteText}>Delete</Text>
      </TouchableOpacity>
    </Card>
  );

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        {viewMode === 'items' && selectedCategoryId && (
          <TouchableOpacity
            onPress={() => { setViewMode('categories'); setSelectedCategoryId(null); }}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.accent} />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>
          {viewMode === 'categories'
            ? 'Menu Categories'
            : categories.find((c) => c.id === selectedCategoryId)?.name ?? 'All Items'}
        </Text>
      </View>

      {viewMode === 'categories' ? (
        <FlatList
          data={categories}
          keyExtractor={(item) => item.id}
          renderItem={renderCategory}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            <TouchableOpacity style={styles.addButton} onPress={() => setShowAddCategory(true)}>
              <Ionicons name="add-circle" size={20} color={Colors.accent} />
              <Text style={styles.addButtonText}>Add Category</Text>
            </TouchableOpacity>
          }
        />
      ) : (
        <FlatList
          data={selectedItems}
          keyExtractor={(item) => item.id}
          renderItem={renderMenuItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="fast-food-outline" size={48} color={Colors.gray300} />
              <Text style={styles.emptyText}>No items in this category</Text>
            </View>
          }
        />
      )}

      {/* FAB for adding items */}
      {viewMode === 'items' && (
        <TouchableOpacity style={styles.fab} activeOpacity={0.8}>
          <Ionicons name="add" size={28} color={Colors.white} />
        </TouchableOpacity>
      )}

      {/* Add Category Modal */}
      <Modal visible={showAddCategory} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Category</Text>
            <TextInput
              style={styles.input}
              placeholder="Category name"
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => { setShowAddCategory(false); setNewCategoryName(''); }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmButton} onPress={handleAddCategory}>
                <Text style={styles.modalConfirmText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Item Modal */}
      <Modal visible={showEditItem} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.editModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Item</Text>
              <TouchableOpacity onPress={() => setShowEditItem(false)}>
                <Ionicons name="close" size={24} color={Colors.gray600} />
              </TouchableOpacity>
            </View>
            {editingItem && (
              <ScrollView>
                <Text style={styles.fieldLabel}>Name</Text>
                <TextInput style={styles.input} value={editingItem.name} editable={false} />
                <Text style={styles.fieldLabel}>Description</Text>
                <TextInput style={[styles.input, styles.textArea]} value={editingItem.description} multiline editable={false} />
                <Text style={styles.fieldLabel}>Price</Text>
                <TextInput style={styles.input} value={`$${editingItem.price.toFixed(2)}`} editable={false} />
                <Text style={styles.fieldLabel}>Category</Text>
                <TextInput style={styles.input} value={categories.find((c) => c.id === editingItem.categoryId)?.name ?? ''} editable={false} />
                <Text style={styles.hintText}>Connect to backend API to enable editing</Text>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.gray50 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.gray200 },
  backButton: { marginRight: Spacing.sm, minWidth: 44, minHeight: 44, justifyContent: 'center' },
  headerTitle: { ...Typography.title3, color: Colors.black },
  listContent: { padding: Spacing.base, paddingBottom: 100 },
  categoryCard: { marginBottom: Spacing.sm },
  categoryRow: { flexDirection: 'row', alignItems: 'center' },
  dragHandle: { marginRight: Spacing.md, minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  categoryInfo: { flex: 1 },
  categoryName: { ...Typography.headline, color: Colors.black },
  categoryCount: { ...Typography.footnote, color: Colors.gray500, marginTop: 2 },
  menuItemCard: { marginBottom: Spacing.sm },
  menuItemRow: { flexDirection: 'row', alignItems: 'center' },
  menuItemImagePlaceholder: { width: 56, height: 56, borderRadius: BorderRadius.chip, backgroundColor: Colors.gray100, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  menuItemInfo: { flex: 1 },
  menuItemName: { ...Typography.headline, color: Colors.black },
  menuItemDesc: { ...Typography.footnote, color: Colors.gray500, marginTop: 2 },
  menuItemPrice: { ...Typography.subhead, color: Colors.accent, fontWeight: '600', marginTop: 4 },
  menuItemActions: { alignItems: 'center', gap: 4 },
  outOfStockBadge: { backgroundColor: Colors.dangerLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  outOfStockText: { ...Typography.caption2, color: Colors.danger, fontWeight: '600' },
  editButton: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  deleteSwipe: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.gray100, marginTop: Spacing.sm, gap: 4, minHeight: 44 },
  deleteText: { ...Typography.footnote, color: Colors.danger },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.base, gap: Spacing.sm, minHeight: 48 },
  addButtonText: { ...Typography.headline, color: Colors.accent },
  fab: { position: 'absolute', right: Spacing.base, bottom: Spacing.xl, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center', ...Shadows.cardHover },
  emptyContainer: { alignItems: 'center', paddingTop: Spacing['3xl'], gap: Spacing.md },
  emptyText: { ...Typography.body, color: Colors.gray400 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: Colors.white, borderRadius: BorderRadius.card, padding: Spacing.xl, width: '85%' },
  editModalContent: { backgroundColor: Colors.white, borderRadius: BorderRadius.card, padding: Spacing.xl, width: '90%', maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.base },
  modalTitle: { ...Typography.title3, color: Colors.black },
  input: { borderWidth: 1, borderColor: Colors.gray200, borderRadius: BorderRadius.chip, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, ...Typography.body, marginTop: Spacing.sm, minHeight: 48 },
  textArea: { height: 80, textAlignVertical: 'top' },
  fieldLabel: { ...Typography.subhead, fontWeight: '600', color: Colors.gray700, marginTop: Spacing.md },
  hintText: { ...Typography.footnote, color: Colors.gray400, textAlign: 'center', marginTop: Spacing.xl },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: Spacing.xl, gap: Spacing.md },
  modalCancelButton: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, minHeight: 44, justifyContent: 'center' },
  modalCancelText: { ...Typography.headline, color: Colors.gray500 },
  modalConfirmButton: { backgroundColor: Colors.accent, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: BorderRadius.button, minHeight: 44, justifyContent: 'center' },
  modalConfirmText: { ...Typography.headline, color: Colors.white },
});
