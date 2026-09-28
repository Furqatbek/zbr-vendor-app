import type { MenuItem } from '../types';
import { emptyItemForm, itemToFormState, toItemRequest } from '../utils/menuItemForm';

const serverItem: MenuItem = {
  id: 7,
  categoryId: 3,
  name: 'Lavash',
  description: 'Beef lavash',
  price: 35000,
  originalPrice: 40000,
  prepTimeMinutes: 15,
  calories: 600,
  allergens: 'gluten',
  vegetarian: false,
  vegan: false,
  glutenFree: false,
  spicy: true,
  featured: true,
  sortOrder: 2,
  inStock: true,
  imageUrl: 'https://cdn.example.com/lavash.jpg',
  variants: [
    { id: 1, name: 'Large', priceDelta: 5000, totalPrice: 40000, inStock: true, sortOrder: 0 },
  ],
  options: [
    { id: 9, groupName: 'Sauce', name: 'Garlic', priceDelta: 0, isDefault: true, maxSelections: 2, required: false, inStock: true },
  ],
};

describe('itemToFormState', () => {
  it('renders every numeric field as editable text', () => {
    const form = itemToFormState(serverItem, true);
    expect(form.price).toBe('35000');
    expect(form.originalPrice).toBe('40000');
    expect(form.prepTimeMinutes).toBe('15');
    expect(form.calories).toBe('600');
    expect(form.variants[0]?.priceDelta).toBe('5000');
    expect(form.options[0]?.maxSelections).toBe('2');
  });

  it('shows a zero price delta as "0" instead of blanking the field', () => {
    const form = itemToFormState(serverItem, true);
    expect(form.options[0]?.priceDelta).toBe('0');
  });

  it('carries the image url through, so a save cannot null it', () => {
    expect(itemToFormState(serverItem, true).imageUrl).toBe('https://cdn.example.com/lavash.jpg');
  });

  it('round-trips unchanged back to the same values', () => {
    const built = toItemRequest(itemToFormState(serverItem, true));
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.request).toMatchObject({
      categoryId: 3,
      name: 'Lavash',
      description: 'Beef lavash',
      price: 35000,
      originalPrice: 40000,
      prepTimeMinutes: 15,
      calories: 600,
      allergens: 'gluten',
      spicy: true,
      featured: true,
      sortOrder: 2,
      imageUrl: 'https://cdn.example.com/lavash.jpg',
    });
    expect(built.request.variants).toEqual([{ name: 'Large', priceDelta: 5000, sortOrder: 0 }]);
    expect(built.request.options).toEqual([
      { groupName: 'Sauce', name: 'Garlic', priceDelta: 0, isDefault: true, maxSelections: 2, required: false },
    ]);
  });
});

describe('toItemRequest — price', () => {
  const withPrice = (price: string) => toItemRequest({ ...itemToFormState(serverItem, true), price });

  it('accepts a comma as the decimal separator', () => {
    const built = withPrice('12,5');
    expect(built.ok).toBe(true);
    if (built.ok) expect(built.request.price).toBe(12.5);
  });

  it('accepts a decimal typed with a dot', () => {
    const built = withPrice('12.5');
    expect(built.ok && built.request.price).toBe(12.5);
  });

  it('rejects an empty price instead of sending 0', () => {
    expect(withPrice('')).toEqual({ ok: false, error: 'price' });
  });

  it('rejects zero', () => {
    expect(withPrice('0')).toEqual({ ok: false, error: 'price' });
  });

  it('rejects a half-typed separator on its own', () => {
    expect(withPrice('.')).toEqual({ ok: false, error: 'price' });
  });
});

describe('toItemRequest — name', () => {
  it('trims the name before sending it', () => {
    const built = toItemRequest({ ...itemToFormState(serverItem, true), name: '  Lavash  ' });
    expect(built.ok && built.request.name).toBe('Lavash');
  });

  it('rejects a name that is only whitespace', () => {
    expect(toItemRequest({ ...itemToFormState(serverItem, true), name: '   ' })).toEqual({
      ok: false,
      error: 'name',
    });
  });
});

describe('toItemRequest — optional numbers', () => {
  it('omits an empty optional field rather than sending null', () => {
    const built = toItemRequest({
      ...itemToFormState(serverItem, true),
      originalPrice: '',
      prepTimeMinutes: '',
      calories: '',
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect('originalPrice' in built.request).toBe(false);
    expect('prepTimeMinutes' in built.request).toBe(false);
    expect('calories' in built.request).toBe(false);
  });

  it('omits empty text fields rather than sending an empty string', () => {
    const built = toItemRequest({ ...itemToFormState(serverItem, true), description: '  ', allergens: '' });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect('description' in built.request).toBe(false);
    expect('allergens' in built.request).toBe(false);
  });

  it('never sends NaN, whatever is in the field', () => {
    const built = toItemRequest({ ...itemToFormState(serverItem, true), calories: 'abc' });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(JSON.stringify(built.request)).not.toContain('null');
  });
});

describe('toItemRequest — variants and options', () => {
  it('drops a blank row the user added and never filled in', () => {
    const form = itemToFormState(serverItem, true);
    const built = toItemRequest({
      ...form,
      variants: [...form.variants, { name: '   ', priceDelta: '' }],
      options: [...form.options, { groupName: '', name: '', priceDelta: '', isDefault: false, maxSelections: '1', required: false }],
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.request.variants).toHaveLength(1);
    expect(built.request.options).toHaveLength(1);
  });

  it('defaults an empty price delta to 0 and an empty max selections to 1', () => {
    const built = toItemRequest({
      ...itemToFormState(serverItem, true),
      variants: [{ name: 'Small', priceDelta: '' }],
      options: [{ groupName: 'Sauce', name: 'Chili', priceDelta: '', isDefault: false, maxSelections: '', required: true }],
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.request.variants?.[0]).toEqual({ name: 'Small', priceDelta: 0, sortOrder: 0 });
    expect(built.request.options?.[0]?.maxSelections).toBe(1);
  });

  it('sends an empty array when the item genuinely has none', () => {
    const built = toItemRequest({ ...emptyItemForm(3, 0), name: 'Tea', price: '5000' });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.request.variants).toEqual([]);
    expect(built.request.options).toEqual([]);
  });
});

describe('toItemRequest — category', () => {
  it('refuses categoryId 0, which the "all items" view leaves behind', () => {
    // 0 is not an id: adding an item with no category selected could only ever
    // be rejected by the server, and previously that rejection was invisible.
    expect(toItemRequest({ ...emptyItemForm(0, 0), name: 'Tea', price: '5000' })).toEqual({
      ok: false,
      error: 'category',
    });
  });
});

describe('toItemRequest — the three meanings of the variants key', () => {
  // The backend reads absent / [] / [...] as three different instructions, so
  // the app has to be deliberate about which one it sends.

  it('OMITS variants and options while they are not loaded, leaving them alone', () => {
    // itemToFormState(item, false) is the state right after a menu row is
    // tapped: the listing carries no variants, and the detail call is in
    // flight or failed. Sending [] here would delete the item's real sizes.
    const built = toItemRequest({ ...itemToFormState(serverItem, false), price: '36000' });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect('variants' in built.request).toBe(false);
    expect('options' in built.request).toBe(false);
    expect(built.request.price).toBe(36000);
  });

  it('sends [] only once they are known to be empty, which deletes them', () => {
    const built = toItemRequest({ ...itemToFormState(serverItem, true), variants: [], options: [] });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.request.variants).toEqual([]);
    expect(built.request.options).toEqual([]);
  });

  it('sends the complete set once loaded', () => {
    const built = toItemRequest(itemToFormState(serverItem, true));
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.request.variants).toHaveLength(1);
    expect(built.request.options).toHaveLength(1);
  });

  it('holds no rows at all while unknown, so nothing can be shown as loaded', () => {
    const form = itemToFormState(serverItem, false);
    expect(form.variantsKnown).toBe(false);
    expect(form.variants).toEqual([]);
    expect(form.options).toEqual([]);
  });

  it('treats a brand new item as known-empty, since it has nothing to preserve', () => {
    expect(emptyItemForm(3, 0).variantsKnown).toBe(true);
  });
});
