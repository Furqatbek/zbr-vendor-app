import type { CreateMenuItemRequest, MenuItem } from '../types';
import { numberToText, parseDecimal, parseInteger } from './numericInput';

/**
 * The menu-item form's own state, and the conversion to the request body.
 *
 * Every field the user types a number into is held as TEXT here, not as a
 * number. See utils/numericInput.ts for why: a number in state fights the
 * keyboard and, on a comma-separator keyboard, silently turned a price into 0.
 *
 * The conversion to CreateMenuItemRequest happens once, on submit, and can
 * fail — which is the point. The previous code had no failure mode: an
 * unparseable price became 0 and was sent as 0.
 */

export interface ItemFormVariant {
  name: string;
  priceDelta: string;
  sortOrder?: number;
}

export interface ItemFormOption {
  groupName: string;
  name: string;
  priceDelta: string;
  isDefault: boolean;
  maxSelections: string;
  required: boolean;
}

export interface ItemFormState {
  categoryId: number;
  name: string;
  description: string;
  price: string;
  originalPrice: string;
  prepTimeMinutes: string;
  calories: string;
  allergens: string;
  vegetarian: boolean;
  vegan: boolean;
  glutenFree: boolean;
  spicy: boolean;
  featured: boolean;
  sortOrder?: number;
  /**
   * Carried through untouched so a full-replace PUT cannot null the image that
   * the separate upload/delete endpoints manage.
   */
  imageUrl?: string;
  /**
   * Whether this item's real variants and options have been loaded.
   *
   * The backend reads three different intentions in the request body, so the
   * difference between "this item has none" and "we have not loaded them yet"
   * has to survive all the way into the JSON:
   *
   *   key absent   leave whatever the item has alone
   *   []           remove them all, said deliberately
   *   [...]        this is the complete set
   *
   * Sending [] because a detail fetch failed would delete a vendor's sizes.
   * While this is false the keys are omitted instead.
   */
  variantsKnown: boolean;
  variants: ItemFormVariant[];
  options: ItemFormOption[];
}

export function emptyItemForm(categoryId: number, sortOrder: number): ItemFormState {
  return {
    categoryId,
    name: '',
    description: '',
    price: '',
    originalPrice: '',
    prepTimeMinutes: '',
    calories: '',
    allergens: '',
    vegetarian: false,
    vegan: false,
    glutenFree: false,
    spicy: false,
    featured: false,
    sortOrder,
    // A new item has no variants to preserve, so [] is the honest answer.
    variantsKnown: true,
    variants: [],
    options: [],
  };
}

/**
 * A server item as editable form state.
 *
 * variantsKnown must be false when `item` came from the menu listing, which
 * does not carry variants and options — only the detail endpoint does. The
 * arrays are then held empty and omitted from the request rather than sent as
 * [], which the backend would read as "delete them all".
 */
export function itemToFormState(item: MenuItem, variantsKnown: boolean): ItemFormState {
  return {
    categoryId: item.categoryId,
    name: item.name,
    description: item.description ?? '',
    price: numberToText(item.price),
    originalPrice: numberToText(item.originalPrice),
    prepTimeMinutes: numberToText(item.prepTimeMinutes),
    calories: numberToText(item.calories),
    allergens: item.allergens ?? '',
    vegetarian: item.vegetarian ?? false,
    vegan: item.vegan ?? false,
    glutenFree: item.glutenFree ?? false,
    spicy: item.spicy ?? false,
    featured: item.featured ?? false,
    sortOrder: item.sortOrder,
    imageUrl: item.imageUrl,
    variantsKnown,
    variants: variantsKnown
      ? (item.variants ?? []).map((v) => ({
          name: v.name,
          priceDelta: numberToText(v.priceDelta),
          sortOrder: v.sortOrder,
        }))
      : [],
    options: variantsKnown
      ? (item.options ?? []).map((o) => ({
          groupName: o.groupName,
          name: o.name,
          priceDelta: numberToText(o.priceDelta),
          isDefault: o.isDefault ?? false,
          maxSelections: numberToText(o.maxSelections),
          required: o.required ?? false,
        }))
      : [],
  };
}

export type ItemFormError = 'name' | 'price' | 'category';

export type ItemFormResult =
  | { ok: true; request: CreateMenuItemRequest }
  | { ok: false; error: ItemFormError };

/**
 * Validate the form and build the request body.
 *
 * Rules that exist because their absence caused a real problem:
 *   - price must parse AND be above zero. An empty or mistyped price is a
 *     validation failure the user sees, not a zero sent to the server.
 *   - optional numbers that do not parse are OMITTED, not sent as NaN, which
 *     JSON.stringify turns into null.
 *   - blank variant and option rows are dropped rather than sent as entries
 *     with an empty name.
 *   - categoryId 0 is caught here. Adding an item from the "all items" view
 *     leaves no category selected, and 0 is not an id — the request could only
 *     ever fail.
 */
export function toItemRequest(form: ItemFormState): ItemFormResult {
  const name = form.name.trim();
  if (!name) return { ok: false, error: 'name' };

  if (!form.categoryId) return { ok: false, error: 'category' };

  const price = parseDecimal(form.price);
  if (price === null || price <= 0) return { ok: false, error: 'price' };

  const originalPrice = parseDecimal(form.originalPrice);
  const prepTimeMinutes = parseInteger(form.prepTimeMinutes);
  const calories = parseInteger(form.calories);
  const allergens = form.allergens.trim();
  const description = form.description.trim();

  const request: CreateMenuItemRequest = {
    categoryId: form.categoryId,
    name,
    price,
    vegetarian: form.vegetarian,
    vegan: form.vegan,
    glutenFree: form.glutenFree,
    spicy: form.spicy,
    featured: form.featured,
  };

  // Omitted while unknown, so an item's sizes survive an edit made before the
  // detail endpoint answered. See ItemFormState.variantsKnown.
  if (form.variantsKnown) {
    request.variants = form.variants
      .filter((v) => v.name.trim() !== '')
      .map((v, idx) => ({
        name: v.name.trim(),
        priceDelta: parseDecimal(v.priceDelta) ?? 0,
        sortOrder: v.sortOrder ?? idx,
      }));
    request.options = form.options
      .filter((o) => o.groupName.trim() !== '' && o.name.trim() !== '')
      .map((o) => ({
        groupName: o.groupName.trim(),
        name: o.name.trim(),
        priceDelta: parseDecimal(o.priceDelta) ?? 0,
        isDefault: o.isDefault,
        maxSelections: parseInteger(o.maxSelections) ?? 1,
        required: o.required,
      }));
  }

  if (description) request.description = description;
  if (allergens) request.allergens = allergens;
  if (originalPrice !== null) request.originalPrice = originalPrice;
  if (prepTimeMinutes !== null) request.prepTimeMinutes = prepTimeMinutes;
  if (calories !== null) request.calories = calories;
  if (form.sortOrder !== undefined) request.sortOrder = form.sortOrder;
  if (form.imageUrl) request.imageUrl = form.imageUrl;

  return { ok: true, request };
}
