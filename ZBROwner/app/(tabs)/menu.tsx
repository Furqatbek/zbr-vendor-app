import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Pressable, Alert, TextInput, Modal,
  ScrollView, KeyboardAvoidingView, Platform, RefreshControl, ActivityIndicator, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import {
  fetchMenuCategories, createMenuCategory, updateMenuCategory, deleteMenuCategory as apiDeleteCategory,
  fetchMenuItem, createMenuItem as apiCreateItem, updateMenuItem as apiUpdateItem,
  updateMenuItemStock, deleteMenuItem as apiDeleteItem,
} from '../../services/api';
import type { MenuCategory, MenuItem, CreateMenuCategoryRequest, CreateMenuItemRequest } from '../../types';
import Card from '../../components/Card';
import { useT } from '../../i18n';

type ViewMode = 'categories' | 'items';

export default function MenuScreen() {
  const restaurant = useAuthStore((s) => s.restaurant);
  const t = useT();

  const [viewMode, setViewMode] = useState<ViewMode>('categories');
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Category modals
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [savingCat, setSavingCat] = useState(false);

  const [showEditCategory, setShowEditCategory] = useState(false);
  const [editCat, setEditCat] = useState<MenuCategory | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatDesc, setEditCatDesc] = useState('');

  // Item modals
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemForm, setItemForm] = useState<CreateMenuItemRequest>({ categoryId: 0, name: '', price: 0 });
  const [savingItem, setSavingItem] = useState(false);

  // ── Data loading ──

  const loadData = useCallback(async () => {
    if (!restaurant) return;
    try {
      const res = await fetchMenuCategories(restaurant.id);
      const cats = res.data ?? [];
      setCategories(cats);
      setSelectedCategory((prev) => prev ? cats.find((c) => c.id === prev.id) ?? null : null);
    } catch { /* silent */ }
  }, [restaurant]);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ── Category actions ──

  const handleAddCategory = async () => {
    if (!newCatName.trim() || !restaurant || savingCat) return;
    setSavingCat(true);
    try {
      await createMenuCategory(restaurant.id, { name: newCatName.trim(), description: newCatDesc.trim() || undefined, sortOrder: categories.length });
      setNewCatName(''); setNewCatDesc(''); setShowAddCategory(false);
      await loadData();
    } catch { /* */ } finally { setSavingCat(false); }
  };

  const openEditCategory = (cat: MenuCategory) => {
    setEditCat(cat); setEditCatName(cat.name); setEditCatDesc(cat.description ?? ''); setShowEditCategory(true);
  };

  const handleSaveCategory = async () => {
    if (!editCat || !restaurant || savingCat) return;
    setSavingCat(true);
    try {
      await updateMenuCategory(restaurant.id, editCat.id, { name: editCatName.trim(), description: editCatDesc.trim() || undefined, sortOrder: editCat.sortOrder });
      setShowEditCategory(false);
      await loadData();
    } catch { /* */ } finally { setSavingCat(false); }
  };

  const handleDeleteCategory = (cat: MenuCategory) => {
    if (!restaurant) return;
    Alert.alert(t('common.delete'), t('menu.deleteCategoryConfirm', { name: cat.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => { try { await apiDeleteCategory(restaurant.id, cat.id); await loadData(); } catch { /* */ } } },
    ]);
  };

  // ── Item actions ──

  // Derive all items from categories
  const allItems = categories.flatMap((c) => c.items ?? []);
  const categoryItems = selectedCategory ? (selectedCategory.items ?? []) : allItems;

  const openAddItem = () => {
    setEditingItem(null);
    setItemForm({ categoryId: selectedCategory?.id ?? 0, name: '', price: 0, sortOrder: categoryItems.length });
    setShowItemForm(true);
  };

  const openEditItem = async (item: MenuItem) => {
    if (!restaurant) return;
    setEditingItem(item);
    // Pre-fill from the list data immediately
    setItemForm({
      categoryId: item.categoryId,
      name: item.name,
      description: item.description,
      price: item.price,
      originalPrice: item.originalPrice,
      prepTimeMinutes: item.prepTimeMinutes,
      calories: item.calories,
      vegetarian: item.vegetarian,
      vegan: item.vegan,
      glutenFree: item.glutenFree,
      spicy: item.spicy,
      allergens: item.allergens,
      featured: item.featured,
      sortOrder: item.sortOrder,
    });
    setShowItemForm(true);
    // Fetch full details (variants, options) from the item management API
    try {
      const res = await fetchMenuItem(restaurant.id, item.id);
      const full = res.data;
      if (full) {
        setEditingItem(full);
        setItemForm({
          categoryId: full.categoryId,
          name: full.name,
          description: full.description,
          price: full.price,
          originalPrice: full.originalPrice,
          prepTimeMinutes: full.prepTimeMinutes,
          calories: full.calories,
          vegetarian: full.vegetarian,
          vegan: full.vegan,
          glutenFree: full.glutenFree,
          spicy: full.spicy,
          allergens: full.allergens,
          featured: full.featured,
          sortOrder: full.sortOrder,
          variants: full.variants?.map((v) => ({ name: v.name, priceDelta: v.priceDelta, sortOrder: v.sortOrder })),
          options: full.options?.map((o) => ({ groupName: o.groupName, name: o.name, priceDelta: o.priceDelta, isDefault: o.isDefault, maxSelections: o.maxSelections, required: o.required })),
        });
      }
    } catch { /* use pre-filled data */ }
  };

  const handleSaveItem = async () => {
    if (!restaurant || savingItem || !itemForm.name.trim()) return;
    setSavingItem(true);
    try {
      if (editingItem) {
        await apiUpdateItem(restaurant.id, editingItem.id, { ...itemForm, name: itemForm.name.trim() });
      } else {
        await apiCreateItem(restaurant.id, { ...itemForm, name: itemForm.name.trim() });
      }
      setShowItemForm(false);
      await loadData();
    } catch { /* */ } finally { setSavingItem(false); }
  };

  const handleToggleStock = async (item: MenuItem) => {
    if (!restaurant) return;
    try {
      await updateMenuItemStock(restaurant.id, item.id, !item.inStock);
      await loadData();
    } catch { /* */ }
  };

  const handleDeleteItem = (item: MenuItem) => {
    if (!restaurant) return;
    Alert.alert(t('common.delete'), t('menu.deleteItemConfirm', { name: item.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => { try { await apiDeleteItem(restaurant.id, item.id); await loadData(); } catch { /* */ } } },
    ]);
  };

  // ── Renders ──

  const renderCategory = ({ item }: { item: MenuCategory }) => (
    <Card style={styles.categoryCard}>
      <TouchableOpacity style={styles.categoryRow} onPress={() => { setSelectedCategory(item); setViewMode('items'); }} activeOpacity={0.7}>
        <View style={styles.iconWrap}>
          <Ionicons name="grid-outline" size={20} color={Colors.accent} />
        </View>
        <View style={styles.infoFlex}>
          <Text style={styles.titleText}>{item.name}</Text>
          {item.description ? <Text style={styles.subtitleText} numberOfLines={1}>{item.description}</Text> : null}
          <Text style={styles.countText}>{t('menu.itemsCount', { count: (item.items ?? []).length })}</Text>
        </View>
        <Pressable onPress={() => openEditCategory(item)} style={styles.actionBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="pencil" size={16} color={Colors.accent} />
        </Pressable>
        <Pressable onPress={() => handleDeleteCategory(item)} style={styles.actionBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="trash-outline" size={16} color={Colors.danger} />
        </Pressable>
        <Ionicons name="chevron-forward" size={18} color={Colors.gray400} />
      </TouchableOpacity>
    </Card>
  );

  const renderItem = ({ item }: { item: MenuItem }) => (
    <Card style={styles.itemCard}>
      <TouchableOpacity style={styles.itemRow} onPress={() => openEditItem(item)} activeOpacity={0.7}>
        <View style={styles.itemImagePlaceholder}>
          {item.imageUrl ? <Ionicons name="image" size={24} color={Colors.accent} /> : <Ionicons name="image-outline" size={24} color={Colors.gray400} />}
        </View>
        <View style={styles.infoFlex}>
          <Text style={styles.titleText}>{item.name}</Text>
          {item.description ? <Text style={styles.subtitleText} numberOfLines={1}>{item.description}</Text> : null}
          <View style={styles.priceRow}>
            <Text style={styles.priceText}>{t('common.currency', { amount: item.price.toFixed(2) })}</Text>
            {item.onSale && item.originalPrice ? <Text style={styles.originalPrice}>{t('common.currency', { amount: item.originalPrice.toFixed(2) })}</Text> : null}
            {item.featured ? <View style={styles.featuredBadge}><Text style={styles.featuredText}>{t('menu.featured')}</Text></View> : null}
          </View>
        </View>
        <View style={styles.itemActions}>
          <Switch
            value={item.inStock}
            onValueChange={() => handleToggleStock(item)}
            trackColor={{ false: Colors.dangerLight, true: Colors.successLight }}
            thumbColor={item.inStock ? Colors.success : Colors.danger}
          />
          <TouchableOpacity onPress={() => handleDeleteItem(item)} style={styles.actionBtn}>
            <Ionicons name="trash-outline" size={16} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Card>
  );

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={Colors.accent} /></View>;
  }

  return (
    <View style={styles.screen}>
      {/* Back bar for items view */}
      {viewMode === 'items' && selectedCategory && (
        <TouchableOpacity onPress={() => { setViewMode('categories'); setSelectedCategory(null); }} style={styles.backRow}>
          <Ionicons name="chevron-back" size={20} color={Colors.accent} />
          <Text style={styles.backText}>{selectedCategory.name}</Text>
        </TouchableOpacity>
      )}

      {viewMode === 'categories' ? (
        <FlatList
          data={categories}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCategory}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.accent} colors={[Colors.accent]} />}
          ListEmptyComponent={<View style={styles.emptyContainer}><Ionicons name="folder-open-outline" size={48} color={Colors.gray300} /><Text style={styles.emptyText}>{t('menu.noCategories')}</Text></View>}
          ListFooterComponent={<TouchableOpacity style={styles.addButton} onPress={() => setShowAddCategory(true)}><Ionicons name="add-circle" size={20} color={Colors.accent} /><Text style={styles.addButtonText}>{t('menu.addCategory')}</Text></TouchableOpacity>}
        />
      ) : (
        <FlatList
          data={categoryItems}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.accent} colors={[Colors.accent]} />}
          ListEmptyComponent={<View style={styles.emptyContainer}><Ionicons name="fast-food-outline" size={48} color={Colors.gray300} /><Text style={styles.emptyText}>{t('menu.noItemsInCategory')}</Text></View>}
        />
      )}

      {/* FAB for adding items */}
      {viewMode === 'items' && selectedCategory && (
        <TouchableOpacity style={styles.fab} activeOpacity={0.8} onPress={openAddItem}>
          <Ionicons name="add" size={28} color={Colors.white} />
        </TouchableOpacity>
      )}

      {/* ── Add Category Modal ── */}
      <Modal visible={showAddCategory} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('menu.newCategory')}</Text>
            <TextInput style={styles.input} placeholder={t('menu.categoryName')} placeholderTextColor={Colors.gray400} value={newCatName} onChangeText={setNewCatName} autoFocus maxLength={100} />
            <TextInput style={[styles.input, styles.textArea]} placeholder={t('menu.categoryDescription')} placeholderTextColor={Colors.gray400} value={newCatDesc} onChangeText={setNewCatDesc} multiline maxLength={500} />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setShowAddCategory(false); setNewCatName(''); setNewCatDesc(''); }}><Text style={styles.cancelText}>{t('common.cancel')}</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirmBtn, savingCat && styles.disabled]} onPress={handleAddCategory} disabled={savingCat}>
                {savingCat ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.confirmText}>{t('common.add')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Edit Category Modal ── */}
      <Modal visible={showEditCategory} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('menu.editCategory')}</Text>
            <TextInput style={styles.input} placeholder={t('menu.categoryName')} placeholderTextColor={Colors.gray400} value={editCatName} onChangeText={setEditCatName} autoFocus maxLength={100} />
            <TextInput style={[styles.input, styles.textArea]} placeholder={t('menu.categoryDescription')} placeholderTextColor={Colors.gray400} value={editCatDesc} onChangeText={setEditCatDesc} multiline maxLength={500} />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowEditCategory(false)}><Text style={styles.cancelText}>{t('common.cancel')}</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirmBtn, savingCat && styles.disabled]} onPress={handleSaveCategory} disabled={savingCat}>
                {savingCat ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.confirmText}>{t('profile.save')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Add/Edit Item Modal ── */}
      <Modal visible={showItemForm} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.itemModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingItem ? t('menu.editItem') : t('menu.addItem')}</Text>
              <TouchableOpacity onPress={() => setShowItemForm(false)}><Ionicons name="close" size={24} color={Colors.gray600} /></TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>{t('common.name')} *</Text>
              <TextInput style={styles.input} value={itemForm.name} onChangeText={(v) => setItemForm((f) => ({ ...f, name: v }))} maxLength={200} />

              <Text style={styles.fieldLabel}>{t('common.description')}</Text>
              <TextInput style={[styles.input, styles.textArea]} value={itemForm.description ?? ''} onChangeText={(v) => setItemForm((f) => ({ ...f, description: v }))} multiline maxLength={1000} />

              <Text style={styles.fieldLabel}>{t('common.price')} *</Text>
              <TextInput style={styles.input} value={itemForm.price ? String(itemForm.price) : ''} onChangeText={(v) => setItemForm((f) => ({ ...f, price: Number(v) || 0 }))} keyboardType="numeric" />

              <Text style={styles.fieldLabel}>{t('menu.originalPrice')}</Text>
              <TextInput style={styles.input} value={itemForm.originalPrice ? String(itemForm.originalPrice) : ''} onChangeText={(v) => setItemForm((f) => ({ ...f, originalPrice: v ? Number(v) : undefined }))} keyboardType="numeric" />

              <Text style={styles.fieldLabel}>{t('menu.prepTime')}</Text>
              <TextInput style={styles.input} value={itemForm.prepTimeMinutes ? String(itemForm.prepTimeMinutes) : ''} onChangeText={(v) => setItemForm((f) => ({ ...f, prepTimeMinutes: v ? Number(v) : undefined }))} keyboardType="numeric" />

              <Text style={styles.fieldLabel}>{t('menu.calories')}</Text>
              <TextInput style={styles.input} value={itemForm.calories ? String(itemForm.calories) : ''} onChangeText={(v) => setItemForm((f) => ({ ...f, calories: v ? Number(v) : undefined }))} keyboardType="numeric" />

              <Text style={styles.fieldLabel}>{t('menu.allergens')}</Text>
              <TextInput style={styles.input} value={itemForm.allergens ?? ''} onChangeText={(v) => setItemForm((f) => ({ ...f, allergens: v }))} maxLength={500} />

              {/* Toggle flags */}
              <View style={styles.flagsRow}>
                {(['vegetarian', 'vegan', 'glutenFree', 'spicy', 'featured'] as const).map((flag) => (
                  <TouchableOpacity
                    key={flag}
                    style={[styles.flagChip, itemForm[flag] && styles.flagChipActive]}
                    onPress={() => setItemForm((f) => ({ ...f, [flag]: !f[flag] }))}
                  >
                    <Text style={[styles.flagChipText, itemForm[flag] && styles.flagChipTextActive]}>{t(`menu.${flag}` as any)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* ── Variants ── */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('menu.variants')}</Text>
                <TouchableOpacity onPress={() => setItemForm((f) => ({ ...f, variants: [...(f.variants ?? []), { name: '', priceDelta: 0, sortOrder: (f.variants ?? []).length }] }))}>
                  <Ionicons name="add-circle-outline" size={22} color={Colors.accent} />
                </TouchableOpacity>
              </View>
              {(itemForm.variants ?? []).length === 0 && (
                <Text style={styles.emptyHint}>{t('menu.noVariants')}</Text>
              )}
              {(itemForm.variants ?? []).map((variant, idx) => (
                <View key={idx} style={styles.subItemCard}>
                  <View style={styles.subItemRow}>
                    <View style={styles.subItemFlex}>
                      <TextInput
                        style={styles.subInput}
                        placeholder={t('menu.variantName')}
                        placeholderTextColor={Colors.gray400}
                        value={variant.name}
                        onChangeText={(v) => setItemForm((f) => {
                          const variants = [...(f.variants ?? [])];
                          variants[idx] = { ...variants[idx], name: v };
                          return { ...f, variants };
                        })}
                      />
                    </View>
                    <View style={styles.subInputSmall}>
                      <TextInput
                        style={styles.subInput}
                        placeholder={t('menu.priceDelta')}
                        placeholderTextColor={Colors.gray400}
                        value={variant.priceDelta ? String(variant.priceDelta) : ''}
                        onChangeText={(v) => setItemForm((f) => {
                          const variants = [...(f.variants ?? [])];
                          variants[idx] = { ...variants[idx], priceDelta: Number(v) || 0 };
                          return { ...f, variants };
                        })}
                        keyboardType="numeric"
                      />
                    </View>
                    <TouchableOpacity
                      onPress={() => setItemForm((f) => ({ ...f, variants: (f.variants ?? []).filter((_, i) => i !== idx) }))}
                      style={styles.removeBtn}
                    >
                      <Ionicons name="close-circle" size={20} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {/* ── Options ── */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('menu.options')}</Text>
                <TouchableOpacity onPress={() => setItemForm((f) => ({ ...f, options: [...(f.options ?? []), { groupName: '', name: '', priceDelta: 0, isDefault: false, maxSelections: 1, required: false }] }))}>
                  <Ionicons name="add-circle-outline" size={22} color={Colors.accent} />
                </TouchableOpacity>
              </View>
              {(itemForm.options ?? []).length === 0 && (
                <Text style={styles.emptyHint}>{t('menu.noOptions')}</Text>
              )}
              {(itemForm.options ?? []).map((option, idx) => (
                <View key={idx} style={styles.subItemCard}>
                  <View style={styles.subItemRow}>
                    <View style={styles.subItemFlex}>
                      <TextInput
                        style={styles.subInput}
                        placeholder={t('menu.optionGroupName')}
                        placeholderTextColor={Colors.gray400}
                        value={option.groupName}
                        onChangeText={(v) => setItemForm((f) => {
                          const options = [...(f.options ?? [])];
                          options[idx] = { ...options[idx], groupName: v };
                          return { ...f, options };
                        })}
                      />
                    </View>
                    <TouchableOpacity
                      onPress={() => setItemForm((f) => ({ ...f, options: (f.options ?? []).filter((_, i) => i !== idx) }))}
                      style={styles.removeBtn}
                    >
                      <Ionicons name="close-circle" size={20} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.subItemRow}>
                    <View style={styles.subItemFlex}>
                      <TextInput
                        style={styles.subInput}
                        placeholder={t('menu.optionName')}
                        placeholderTextColor={Colors.gray400}
                        value={option.name}
                        onChangeText={(v) => setItemForm((f) => {
                          const options = [...(f.options ?? [])];
                          options[idx] = { ...options[idx], name: v };
                          return { ...f, options };
                        })}
                      />
                    </View>
                    <View style={styles.subInputSmall}>
                      <TextInput
                        style={styles.subInput}
                        placeholder={t('menu.priceDelta')}
                        placeholderTextColor={Colors.gray400}
                        value={option.priceDelta ? String(option.priceDelta) : ''}
                        onChangeText={(v) => setItemForm((f) => {
                          const options = [...(f.options ?? [])];
                          options[idx] = { ...options[idx], priceDelta: Number(v) || 0 };
                          return { ...f, options };
                        })}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                  <View style={styles.optionFlagsRow}>
                    <TouchableOpacity
                      style={[styles.optionFlag, option.isDefault && styles.optionFlagActive]}
                      onPress={() => setItemForm((f) => {
                        const options = [...(f.options ?? [])];
                        options[idx] = { ...options[idx], isDefault: !options[idx].isDefault };
                        return { ...f, options };
                      })}
                    >
                      <Text style={[styles.optionFlagText, option.isDefault && styles.optionFlagTextActive]}>{t('menu.optionDefault')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.optionFlag, option.required && styles.optionFlagActive]}
                      onPress={() => setItemForm((f) => {
                        const options = [...(f.options ?? [])];
                        options[idx] = { ...options[idx], required: !options[idx].required };
                        return { ...f, options };
                      })}
                    >
                      <Text style={[styles.optionFlagText, option.required && styles.optionFlagTextActive]}>{t('menu.optionRequired')}</Text>
                    </TouchableOpacity>
                    <View style={styles.maxSelectWrap}>
                      <Text style={styles.maxSelectLabel}>{t('menu.maxSelections')}</Text>
                      <TextInput
                        style={styles.maxSelectInput}
                        value={option.maxSelections ? String(option.maxSelections) : ''}
                        onChangeText={(v) => setItemForm((f) => {
                          const options = [...(f.options ?? [])];
                          options[idx] = { ...options[idx], maxSelections: Number(v) || undefined };
                          return { ...f, options };
                        })}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                </View>
              ))}

              {/* Save */}
              <TouchableOpacity style={[styles.saveButton, savingItem && styles.disabled]} onPress={handleSaveItem} disabled={savingItem} activeOpacity={0.8}>
                {savingItem ? <ActivityIndicator color={Colors.white} size="small" /> : (
                  <><Ionicons name="checkmark-circle" size={20} color={Colors.white} /><Text style={styles.saveButtonText}>{t('profile.save')}</Text></>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.gray50 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: Spacing.base, paddingBottom: 100 },
  backRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.gray200 },
  backText: { ...Typography.subhead, color: Colors.accent, marginLeft: 4 },

  // Category card
  categoryCard: { marginBottom: Spacing.sm },
  categoryRow: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.accentLight, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  infoFlex: { flex: 1 },
  titleText: { ...Typography.headline, color: Colors.black },
  subtitleText: { ...Typography.footnote, color: Colors.gray500, marginTop: 2 },
  countText: { ...Typography.caption1, color: Colors.gray400, marginTop: 2 },
  actionBtn: { minWidth: 36, minHeight: 36, justifyContent: 'center', alignItems: 'center' },

  // Item card
  itemCard: { marginBottom: Spacing.sm },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  itemImagePlaceholder: { width: 56, height: 56, borderRadius: BorderRadius.chip, backgroundColor: Colors.gray100, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: Spacing.sm },
  priceText: { ...Typography.subhead, color: Colors.accent, fontWeight: '600' },
  originalPrice: { ...Typography.caption1, color: Colors.gray400, textDecorationLine: 'line-through' },
  featuredBadge: { backgroundColor: Colors.warningLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  featuredText: { ...Typography.caption2, color: Colors.warning, fontWeight: '600' },
  itemActions: { alignItems: 'center', gap: 4 },

  // Buttons
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.base, gap: Spacing.sm, minHeight: 48 },
  addButtonText: { ...Typography.headline, color: Colors.accent },
  fab: { position: 'absolute', right: Spacing.base, bottom: Spacing.xl, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center', ...Shadows.cardHover },
  emptyContainer: { alignItems: 'center', paddingTop: Spacing['3xl'], gap: Spacing.md },
  emptyText: { ...Typography.body, color: Colors.gray400 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: Colors.white, borderRadius: BorderRadius.card, padding: Spacing.xl, width: '85%' },
  itemModalContent: { backgroundColor: Colors.white, borderRadius: BorderRadius.card, padding: Spacing.xl, width: '92%', maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.base },
  modalTitle: { ...Typography.title3, color: Colors.black },
  input: { borderWidth: 1, borderColor: Colors.gray200, borderRadius: BorderRadius.chip, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, ...Typography.body, marginTop: Spacing.sm, minHeight: 48 },
  textArea: { height: 80, textAlignVertical: 'top' },
  fieldLabel: { ...Typography.subhead, fontWeight: '600', color: Colors.gray700, marginTop: Spacing.md },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: Spacing.xl, gap: Spacing.md },
  modalCancelBtn: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, minHeight: 44, justifyContent: 'center' },
  cancelText: { ...Typography.headline, color: Colors.gray500 },
  modalConfirmBtn: { backgroundColor: Colors.accent, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: BorderRadius.button, minHeight: 44, justifyContent: 'center' },
  confirmText: { ...Typography.headline, color: Colors.white },
  disabled: { opacity: 0.5 },

  // Flags
  flagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md },
  flagChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.gray200 },
  flagChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  flagChipText: { ...Typography.caption1, color: Colors.gray500 },
  flagChipTextActive: { color: Colors.white },

  // Sections (variants/options)
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.xl, marginBottom: Spacing.sm, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.gray200 },
  sectionTitle: { ...Typography.headline, color: Colors.black },
  emptyHint: { ...Typography.footnote, color: Colors.gray400, textAlign: 'center', paddingVertical: Spacing.md },
  subItemCard: { backgroundColor: Colors.gray50, borderRadius: BorderRadius.chip, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.gray200 },
  subItemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 },
  subItemFlex: { flex: 1 },
  subInputSmall: { width: 90 },
  subInput: { borderWidth: 1, borderColor: Colors.gray200, borderRadius: BorderRadius.chip, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, ...Typography.footnote, backgroundColor: Colors.white, minHeight: 40 },
  removeBtn: { padding: 4 },
  optionFlagsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4, flexWrap: 'wrap' },
  optionFlag: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.gray300 },
  optionFlagActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  optionFlagText: { ...Typography.caption2, color: Colors.gray500 },
  optionFlagTextActive: { color: Colors.white },
  maxSelectWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  maxSelectLabel: { ...Typography.caption2, color: Colors.gray500 },
  maxSelectInput: { borderWidth: 1, borderColor: Colors.gray200, borderRadius: BorderRadius.chip, paddingHorizontal: Spacing.sm, paddingVertical: 2, width: 44, textAlign: 'center', ...Typography.caption1, backgroundColor: Colors.white, minHeight: 30 },

  // Save
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accent, borderRadius: BorderRadius.button, paddingVertical: Spacing.md, gap: Spacing.sm, minHeight: 48, marginTop: Spacing.xl, marginBottom: Spacing.base },
  saveButtonText: { ...Typography.headline, color: Colors.white },
});
