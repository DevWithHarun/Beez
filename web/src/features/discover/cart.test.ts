import { afterEach, describe, expect, it } from "vitest";
import { addCartProduct, clearCart, readCart, updateCartQuantity } from "./cart";

describe("guest cart", () => {
  afterEach(() => {
    clearCart();
  });

  it("keeps products from different shops in the selected area", () => {
    expect(addCartProduct(product("rice", "zone-1", "Shop One"))).toBe("added");
    expect(addCartProduct(product("milk", "zone-1", "Shop Two"))).toBe("added");
    expect(readCart()).toMatchObject([
      { productId: "rice", zoneId: "zone-1", qty: 1 },
      { productId: "milk", zoneId: "zone-1", qty: 1 },
    ]);
  });

  it("rejects mixing service areas and caps quantities", () => {
    addCartProduct(product("rice", "zone-1", "Shop One"));
    expect(addCartProduct(product("milk", "zone-2", "Shop Two"))).toBe("different-zone");
    expect(updateCartQuantity("rice", 1001)[0]?.qty).toBe(1000);
  });

  it("removes an item when its quantity reaches zero", () => {
    addCartProduct(product("rice", "zone-1", "Shop One"));
    expect(updateCartQuantity("rice", 0)).toEqual([]);
  });
});

function product(productId: string, zoneId: string, shopName: string) {
  return {
    productId,
    name: productId,
    unit: null,
    zoneId,
    zoneName: zoneId,
    shopName,
    shopSlug: shopName.toLowerCase().replace(" ", "-"),
  };
}
