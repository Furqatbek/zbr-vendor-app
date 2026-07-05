import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ActivityIndicator, Modal, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { previewRestosMenu, importRestosMenu, fetchMenuCategories } from '../../services/api';
import Card from '../../components/Card';
import { useT } from '../../i18n';
import type { RestosPreviewCategory, RestosImportResult } from '../../types';
import { isSafeExternalUrl } from '../../utils/urlSafety';

const normalizeName = (s: string | undefined | null) => (s ?? '').trim().toLowerCase();

const STORAGE_KEY = 'restos_integration_config';

interface RestosConfig {
  baseUrl: string;
  externalRestaurantId: string;
  apiKey: string;
  hasImported: boolean;
}

type ErrorKind =
  | 'no-restaurant'
  | 'multiple-restaurants'
  | 'unreachable'
  | 'restos-error'
  | 'forbidden'
  | 'generic';

function classifyError(message: string): ErrorKind {
  const m = message.toLowerCase();
  if (m.includes("don't have any restaurants") || m.includes('no restaurants')) return 'no-restaurant';
  if (m.includes('multiple restaurants')) return 'multiple-restaurants';
  if (m.includes('failed to connect to restos')) return 'unreachable';
  if (m.includes('restos api returned error')) return 'restos-error';
  if (m.includes('forbidden') || m.includes('only restaurant owners')) return 'forbidden';
  return 'generic';
}

export default function RestaurantIntegrationScreen() {
  const router = useRouter();
  const t = useT();
  const restaurant = useAuthStore((s) => s.restaurant);
  const restaurants = useAuthStore((s) => s.restaurants);

  const [baseUrl, setBaseUrl] = useState('');
  const [externalRestaurantId, setExternalRestaurantId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [localRestaurantId, setLocalRestaurantId] = useState<number | undefined>(undefined);
  const [hasImported, setHasImported] = useState(false);

  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingImport, setLoadingImport] = useState(false);

  const [preview, setPreview] = useState<RestosPreviewCategory[] | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [existingProductNames, setExistingProductNames] = useState<Set<string>>(new Set());
  const [existingCategoryNames, setExistingCategoryNames] = useState<Set<string>>(new Set());

  const [importResult, setImportResult] = useState<RestosImportResult | null>(null);
  const [showResult, setShowResult] = useState(false);

  const [showRestaurantPicker, setShowRestaurantPicker] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const cfg: RestosConfig = JSON.parse(raw);
          setBaseUrl(cfg.baseUrl ?? '');
          setExternalRestaurantId(cfg.externalRestaurantId ?? '');
          setApiKey(cfg.apiKey ?? '');
          setHasImported(!!cfg.hasImported);
        }
      } catch {
        // Non-fatal
      }
    })();
  }, []);

  const persistConfig = async (imported: boolean) => {
    const cfg: RestosConfig = { baseUrl, externalRestaurantId, apiKey, hasImported: imported };
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    } catch {
      // Non-fatal
    }
  };

  const validateInputs = (): boolean => {
    if (!baseUrl.trim()) {
      Alert.alert(t('integration.validationTitle'), t('integration.errBaseUrlRequired'));
      return false;
    }
    if (!isSafeExternalUrl(baseUrl)) {
      // Reject non-http(s) schemes and internal/metadata hosts before the
      // backend fetches the URL server-side (SSRF defense-in-depth).
      Alert.alert(t('integration.validationTitle'), t('integration.errBaseUrlInvalid'));
      return false;
    }
    const parsed = externalRestaurantId.trim();
    if (!parsed || isNaN(Number(parsed))) {
      Alert.alert(t('integration.validationTitle'), t('integration.errExternalIdRequired'));
      return false;
    }
    return true;
  };

  const buildRequestBase = () => ({
    baseUrl: baseUrl.trim(),
    externalRestaurantId: Number(externalRestaurantId.trim()),
    apiKey: apiKey.trim() || undefined,
  });

  const handleApiError = (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    const kind = classifyError(message);

    switch (kind) {
      case 'no-restaurant':
        Alert.alert(t('integration.errorTitle'), t('integration.errNoRestaurant'));
        break;
      case 'multiple-restaurants':
        setShowRestaurantPicker(true);
        break;
      case 'unreachable':
        Alert.alert(t('integration.errorTitle'), t('integration.errUnreachable'));
        break;
      case 'forbidden':
        Alert.alert(t('integration.errorTitle'), t('integration.errForbidden'));
        break;
      case 'restos-error':
      case 'generic':
      default:
        Alert.alert(t('integration.errorTitle'), message || t('integration.errGeneric'));
        break;
    }
  };

  const loadExistingMenu = async () => {
    const targetId = localRestaurantId ?? restaurant?.id;
    if (!targetId) {
      setExistingProductNames(new Set());
      setExistingCategoryNames(new Set());
      return;
    }
    try {
      const res = await fetchMenuCategories(targetId);
      const cats = res.data ?? [];
      const productNames = new Set<string>();
      const categoryNames = new Set<string>();
      for (const c of cats) {
        const cn = normalizeName(c.name);
        if (cn) categoryNames.add(cn);
        for (const it of c.items ?? []) {
          const pn = normalizeName(it.name);
          if (pn) productNames.add(pn);
        }
      }
      setExistingProductNames(productNames);
      setExistingCategoryNames(categoryNames);
    } catch {
      setExistingProductNames(new Set());
      setExistingCategoryNames(new Set());
    }
  };

  const handlePreview = async () => {
    if (!validateInputs()) return;
    setLoadingPreview(true);
    try {
      const [res] = await Promise.all([
        previewRestosMenu(buildRequestBase()),
        loadExistingMenu(),
      ]);
      setPreview(res.data ?? []);
      setShowPreview(true);
      persistConfig(hasImported);
    } catch (err) {
      handleApiError(err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const runImport = async (overwrite: boolean) => {
    if (!validateInputs()) return;
    if (showPreview && totalProducts > 0 && newProducts === 0 && !overwrite) {
      Alert.alert(t('integration.errorTitle'), t('integration.errAllDuplicates'));
      return;
    }
    setLoadingImport(true);
    try {
      const res = await importRestosMenu({
        ...buildRequestBase(),
        localRestaurantId: localRestaurantId ?? (restaurants.length > 1 ? restaurant?.id : undefined),
        overwriteExisting: overwrite,
      });
      setImportResult(res.data);
      setShowResult(true);
      setShowPreview(false);
      setHasImported(true);
      persistConfig(true);
      loadExistingMenu();
    } catch (err) {
      handleApiError(err);
    } finally {
      setLoadingImport(false);
    }
  };

  const handleImport = () => runImport(false);
  const handleSync = () => runImport(true);

  const totalProducts = preview?.reduce((sum, c) => sum + (c.products?.length ?? 0), 0) ?? 0;
  const duplicateProducts = preview?.reduce(
    (sum, c) => sum + (c.products ?? []).filter((p) => existingProductNames.has(normalizeName(p.name))).length,
    0,
  ) ?? 0;
  const newProducts = totalProducts - duplicateProducts;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionTitle}>{t('integration.connectTitle')}</Text>
        <Text style={styles.sectionSubtitle}>{t('integration.connectSubtitle')}</Text>

        <Card style={styles.fieldsCard}>
          <View style={styles.fieldRow}>
            <View style={styles.fieldIcon}><Ionicons name="globe-outline" size={20} color={Colors.accent} /></View>
            <View style={styles.fieldContent}>
              <Text style={styles.fieldLabel}>{t('integration.baseUrlLabel')}</Text>
              <TextInput
                style={styles.fieldInput}
                value={baseUrl}
                onChangeText={setBaseUrl}
                placeholder="https://restos.example.com"
                placeholderTextColor={Colors.gray300}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </View>
          </View>
          <View style={[styles.fieldRow, styles.fieldBorderTop]}>
            <View style={styles.fieldIcon}><Ionicons name="barcode-outline" size={20} color={Colors.accent} /></View>
            <View style={styles.fieldContent}>
              <Text style={styles.fieldLabel}>{t('integration.externalIdLabel')}</Text>
              <TextInput
                style={styles.fieldInput}
                value={externalRestaurantId}
                onChangeText={setExternalRestaurantId}
                placeholder="42"
                placeholderTextColor={Colors.gray300}
                keyboardType="numeric"
              />
            </View>
          </View>
          <View style={[styles.fieldRow, styles.fieldBorderTop]}>
            <View style={styles.fieldIcon}><Ionicons name="key-outline" size={20} color={Colors.accent} /></View>
            <View style={styles.fieldContent}>
              <Text style={styles.fieldLabel}>{t('integration.apiKeyLabel')}</Text>
              <View style={styles.apiKeyRow}>
                <TextInput
                  style={[styles.fieldInput, styles.flex]}
                  value={apiKey}
                  onChangeText={setApiKey}
                  placeholder="sk-abc123"
                  placeholderTextColor={Colors.gray300}
                  secureTextEntry={!showApiKey}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setShowApiKey((v) => !v)} hitSlop={8}>
                  <Ionicons name={showApiKey ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.gray500} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Card>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton, loadingPreview && styles.buttonDisabled]}
            onPress={handlePreview}
            disabled={loadingPreview || loadingImport}
            activeOpacity={0.8}
          >
            {loadingPreview ? (
              <ActivityIndicator size="small" color={Colors.accent} />
            ) : (
              <>
                <Ionicons name="eye-outline" size={18} color={Colors.accent} />
                <Text style={styles.secondaryButtonText}>{t('integration.previewMenu')}</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton, loadingImport && styles.buttonDisabled]}
            onPress={handleImport}
            disabled={loadingPreview || loadingImport}
            activeOpacity={0.8}
          >
            {loadingImport ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Ionicons name="cloud-download-outline" size={18} color={Colors.white} />
                <Text style={styles.primaryButtonText}>{t('integration.importMenu')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {hasImported && (
          <>
            <Text style={styles.sectionTitle}>{t('integration.maintenance')}</Text>
            <TouchableOpacity
              style={[styles.button, styles.syncButton, loadingImport && styles.buttonDisabled]}
              onPress={handleSync}
              disabled={loadingPreview || loadingImport}
              activeOpacity={0.8}
            >
              {loadingImport ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <>
                  <Ionicons name="sync-outline" size={18} color={Colors.white} />
                  <Text style={styles.primaryButtonText}>{t('integration.syncMenu')}</Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.helperText}>{t('integration.syncHelper')}</Text>
          </>
        )}
      </ScrollView>

      {/* Preview Modal */}
      <Modal visible={showPreview} animationType="slide" transparent={false} onRequestClose={() => setShowPreview(false)}>
        <View style={styles.modalScreen}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowPreview(false)} hitSlop={8}>
              <Ionicons name="close" size={26} color={Colors.black} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('integration.previewTitle')}</Text>
            <View style={{ width: 26 }} />
          </View>

          <View style={styles.previewSummary}>
            <Text style={styles.previewSummaryText}>
              {t('integration.previewSummary', { categories: preview?.length ?? 0, products: totalProducts })}
            </Text>
            {duplicateProducts > 0 && (
              <Text style={styles.previewDuplicateText}>
                {t('integration.previewDuplicateSummary', { duplicates: duplicateProducts, newCount: newProducts })}
              </Text>
            )}
          </View>

          <ScrollView style={styles.flex} contentContainerStyle={styles.modalBody}>
            {(preview ?? []).map((cat, ci) => {
              const categoryExists = existingCategoryNames.has(normalizeName(cat.name));
              return (
                <Card key={`cat-${ci}`} style={styles.previewCategoryCard}>
                  <View style={styles.previewCategoryHeader}>
                    <Text style={styles.previewCategoryName}>{cat.name}</Text>
                    {categoryExists && (
                      <View style={styles.duplicateBadge}>
                        <Text style={styles.duplicateBadgeText}>{t('integration.alreadyImported')}</Text>
                      </View>
                    )}
                  </View>
                  {cat.description ? (
                    <Text style={styles.previewCategoryDesc}>{cat.description}</Text>
                  ) : null}
                  {(cat.products ?? []).map((p, pi) => {
                    const productExists = existingProductNames.has(normalizeName(p.name));
                    return (
                      <View
                        key={`p-${ci}-${pi}`}
                        style={[
                          styles.previewProductRow,
                          pi > 0 && styles.productBorder,
                          productExists && styles.previewProductRowDuplicate,
                        ]}
                      >
                        <View style={styles.flex}>
                          <Text style={[styles.previewProductName, productExists && styles.previewProductNameDuplicate]}>
                            {p.name}
                          </Text>
                          {productExists && (
                            <Text style={styles.duplicateInlineLabel}>{t('integration.alreadyImported')}</Text>
                          )}
                          {p.description ? <Text style={styles.previewProductDesc} numberOfLines={2}>{p.description}</Text> : null}
                        </View>
                        {typeof p.price === 'number' && (
                          <Text style={styles.previewProductPrice}>
                            {t('common.currency', { amount: p.price.toFixed(2) })}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                  {(cat.products?.length ?? 0) === 0 && (
                    <Text style={styles.previewEmpty}>{t('integration.emptyCategory')}</Text>
                  )}
                </Card>
              );
            })}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={() => setShowPreview(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton, loadingImport && styles.buttonDisabled]}
              onPress={handleImport}
              disabled={loadingImport}
              activeOpacity={0.8}
            >
              {loadingImport ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>{t('integration.confirmImport')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Import Result Modal */}
      <Modal visible={showResult} animationType="fade" transparent onRequestClose={() => setShowResult(false)}>
        <View style={styles.overlay}>
          <View style={styles.resultCard}>
            <View style={styles.resultIconWrap}>
              <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
            </View>
            <Text style={styles.resultTitle}>{t('integration.resultTitle')}</Text>

            {importResult && (
              <View style={styles.resultStats}>
                <ResultStat label={t('integration.categoriesCreated')} value={importResult.categoriesCreated} />
                {importResult.categoriesUpdated > 0 && (
                  <ResultStat label={t('integration.categoriesUpdated')} value={importResult.categoriesUpdated} />
                )}
                <ResultStat label={t('integration.productsCreated')} value={importResult.productsCreated} />
                {importResult.productsUpdated > 0 && (
                  <ResultStat label={t('integration.productsUpdated')} value={importResult.productsUpdated} />
                )}
                {importResult.productsSkipped > 0 && (
                  <ResultStat label={t('integration.productsSkipped')} value={importResult.productsSkipped} />
                )}
              </View>
            )}

            {importResult && importResult.warnings.length > 0 && (
              <View style={styles.warningsBox}>
                <Text style={styles.warningsTitle}>{t('integration.warnings')}</Text>
                {importResult.warnings.map((w, i) => (
                  <Text key={i} style={styles.warningItem}>• {w}</Text>
                ))}
              </View>
            )}

            {importResult && importResult.errors.length > 0 && (
              <View style={styles.errorsBox}>
                <Text style={styles.errorsTitle}>{t('integration.errorsLabel')}</Text>
                {importResult.errors.map((e, i) => (
                  <Text key={i} style={styles.errorItem}>• {e}</Text>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, styles.primaryButton, styles.resultButton]}
              onPress={() => { setShowResult(false); router.push('/(tabs)/menu'); }}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>{t('integration.viewMyMenu')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowResult(false)} hitSlop={8} style={styles.resultClose}>
              <Text style={styles.resultCloseText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Restaurant Picker Modal (for multiple-restaurants error) */}
      <Modal visible={showRestaurantPicker} animationType="fade" transparent onRequestClose={() => setShowRestaurantPicker(false)}>
        <View style={styles.overlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>{t('integration.pickRestaurantTitle')}</Text>
            <Text style={styles.pickerSubtitle}>{t('integration.pickRestaurantSubtitle')}</Text>
            <ScrollView style={styles.pickerList}>
              {restaurants.map((r) => {
                const selected = localRestaurantId === r.id;
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.pickerItem, selected && styles.pickerItemSelected]}
                    onPress={() => setLocalRestaurantId(r.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={selected ? Colors.accent : Colors.gray400}
                    />
                    <View style={styles.pickerItemInfo}>
                      <Text style={styles.pickerItemName}>{r.name}</Text>
                      <Text style={styles.pickerItemSub}>{r.addressLine1}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={styles.pickerButtons}>
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={() => setShowRestaurantPicker(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton, !localRestaurantId && styles.buttonDisabled]}
                onPress={() => { setShowRestaurantPicker(false); handleImport(); }}
                disabled={!localRestaurantId}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>{t('integration.confirmImport')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function ResultStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: Colors.gray50 },
  content: { padding: Spacing.base, paddingBottom: Spacing['2xl'] },

  sectionTitle: { ...Typography.headline, color: Colors.black, marginBottom: Spacing.xs },
  sectionSubtitle: { ...Typography.caption1, color: Colors.gray500, marginBottom: Spacing.base },

  fieldsCard: { padding: 0, marginBottom: Spacing.base },
  fieldRow: { flexDirection: 'row', alignItems: 'flex-start', padding: Spacing.base, minHeight: 56 },
  fieldBorderTop: { borderTopWidth: 1, borderTopColor: Colors.gray100 },
  fieldIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.accentLight, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md, marginTop: 2 },
  fieldContent: { flex: 1 },
  fieldLabel: { ...Typography.caption1, color: Colors.gray500, marginBottom: 4 },
  fieldInput: { ...Typography.body, color: Colors.black, padding: 0, margin: 0, minHeight: 24 },
  apiKeyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },

  buttonRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl },
  button: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.button, paddingVertical: Spacing.md, gap: Spacing.sm, minHeight: 48 },
  primaryButton: { backgroundColor: Colors.accent },
  primaryButtonText: { ...Typography.headline, color: Colors.white },
  secondaryButton: { backgroundColor: Colors.accentLight, borderWidth: 1, borderColor: Colors.accent },
  secondaryButtonText: { ...Typography.headline, color: Colors.accent },
  syncButton: { backgroundColor: Colors.accent, marginBottom: Spacing.xs },
  buttonDisabled: { opacity: 0.5 },
  helperText: { ...Typography.caption1, color: Colors.gray500, textAlign: 'center' },

  // Preview modal
  modalScreen: { flex: 1, backgroundColor: Colors.gray50 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.base, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.gray100, paddingTop: Platform.OS === 'ios' ? 52 : Spacing.base },
  modalTitle: { ...Typography.title3, color: Colors.black },
  modalBody: { padding: Spacing.base, paddingBottom: Spacing['2xl'] },
  modalFooter: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.base, borderTopWidth: 1, borderTopColor: Colors.gray100, backgroundColor: Colors.white },

  previewSummary: { padding: Spacing.base, backgroundColor: Colors.accentLight },
  previewSummaryText: { ...Typography.subhead, color: Colors.accent, textAlign: 'center' },
  previewDuplicateText: { ...Typography.caption1, color: Colors.warning, textAlign: 'center', marginTop: 4 },

  previewCategoryCard: { marginBottom: Spacing.md, padding: Spacing.base },
  previewCategoryHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 },
  previewCategoryName: { ...Typography.headline, color: Colors.black, flex: 1 },
  duplicateBadge: { backgroundColor: Colors.warningLight, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.chip },
  duplicateBadgeText: { ...Typography.caption2, color: Colors.warning, fontWeight: '600' as const },
  duplicateInlineLabel: { ...Typography.caption2, color: Colors.warning, marginTop: 2, fontWeight: '600' as const },
  previewProductRowDuplicate: { opacity: 0.55 },
  previewProductNameDuplicate: { textDecorationLine: 'line-through' },
  previewCategoryDesc: { ...Typography.caption1, color: Colors.gray500, marginBottom: Spacing.sm },
  previewProductRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, gap: Spacing.sm },
  productBorder: { borderTopWidth: 1, borderTopColor: Colors.gray100 },
  previewProductName: { ...Typography.body, color: Colors.black },
  previewProductDesc: { ...Typography.caption1, color: Colors.gray500, marginTop: 2 },
  previewProductPrice: { ...Typography.headline, color: Colors.accent },
  previewEmpty: { ...Typography.caption1, color: Colors.gray400, fontStyle: 'italic', paddingVertical: Spacing.sm },

  // Result modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: Spacing.base },
  resultCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.card, padding: Spacing.xl, width: '100%', maxWidth: 420, alignItems: 'stretch' },
  resultIconWrap: { alignSelf: 'center', marginBottom: Spacing.md },
  resultTitle: { ...Typography.title3, color: Colors.black, textAlign: 'center', marginBottom: Spacing.base },
  resultStats: { gap: Spacing.xs, marginBottom: Spacing.base },
  statRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm, paddingVertical: 4 },
  statValue: { ...Typography.title3, color: Colors.accent, minWidth: 40 },
  statLabel: { ...Typography.body, color: Colors.gray700 },
  warningsBox: { backgroundColor: Colors.warningLight, padding: Spacing.md, borderRadius: BorderRadius.chip, marginBottom: Spacing.sm },
  warningsTitle: { ...Typography.subhead, color: Colors.warning, marginBottom: 4, fontWeight: '600' as const },
  warningItem: { ...Typography.caption1, color: Colors.gray700, marginTop: 2 },
  errorsBox: { backgroundColor: Colors.dangerLight, padding: Spacing.md, borderRadius: BorderRadius.chip, marginBottom: Spacing.sm },
  errorsTitle: { ...Typography.subhead, color: Colors.danger, marginBottom: 4, fontWeight: '600' as const },
  errorItem: { ...Typography.caption1, color: Colors.gray700, marginTop: 2 },
  resultButton: { marginTop: Spacing.sm },
  resultClose: { alignSelf: 'center', paddingVertical: Spacing.md },
  resultCloseText: { ...Typography.subhead, color: Colors.gray500 },

  // Restaurant picker
  pickerCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.card, padding: Spacing.xl, width: '100%', maxWidth: 420 },
  pickerTitle: { ...Typography.title3, color: Colors.black, marginBottom: Spacing.xs },
  pickerSubtitle: { ...Typography.caption1, color: Colors.gray500, marginBottom: Spacing.base },
  pickerList: { maxHeight: 320, marginBottom: Spacing.base },
  pickerItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: BorderRadius.chip },
  pickerItemSelected: { backgroundColor: Colors.accentLight },
  pickerItemInfo: { flex: 1 },
  pickerItemName: { ...Typography.body, color: Colors.black },
  pickerItemSub: { ...Typography.caption1, color: Colors.gray500, marginTop: 2 },
  pickerButtons: { flexDirection: 'row', gap: Spacing.sm },
});
