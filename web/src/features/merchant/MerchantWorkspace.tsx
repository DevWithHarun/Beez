import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, MapPin, Mic, Pencil, Plus, Store, Trash2, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { getZones } from "@/features/discover/api";
import MerchantVoiceProducts from "./MerchantVoiceProducts";
import MerchantAvailability from "./MerchantAvailability";
import {
  archiveMerchantProduct,
  createMerchantProduct,
  getMerchantProducts,
  getMerchantShop,
  MerchantProductInput,
  MerchantShopInput,
  saveMerchantShop,
  updateMerchantProduct,
} from "./api";

export default function MerchantWorkspace({
  initialName,
  initialArea,
  initialSection = "catalogue",
}: {
  initialName: string;
  initialArea: string;
  initialSection?: "catalogue" | "voice";
}) {
  const queryClient = useQueryClient();
  const shopQuery = useQuery({
    queryKey: ["merchant", "shop"],
    queryFn: getMerchantShop,
    retry: false,
  });
  const zonesQuery = useQuery({
    queryKey: ["discover", "zones"],
    queryFn: () => getZones(),
    staleTime: 60_000,
    retry: false,
  });
  const productsQuery = useQuery({
    queryKey: ["merchant", "products"],
    queryFn: getMerchantProducts,
    enabled: Boolean(shopQuery.data),
    retry: false,
  });

  const [businessName, setBusinessName] = useState(initialName);
  const [category, setCategory] = useState("General");
  const [zoneId, setZoneId] = useState("");
  const [locationText, setLocationText] = useState(initialArea);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [payoutPhone, setPayoutPhone] = useState("");
  const [editingShop, setEditingShop] = useState(false);
  const [section, setSection] = useState(initialSection);
  const [productName, setProductName] = useState("");
  const [productUnit, setProductUnit] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingProductName, setEditingProductName] = useState("");
  const [editingProductUnit, setEditingProductUnit] = useState("");
  const [editingProductPrice, setEditingProductPrice] = useState("");
  const [error, setError] = useState("");

  const saveShopMutation = useMutation({
    mutationFn: (input: MerchantShopInput) => saveMerchantShop(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["merchant", "shop"] }),
        queryClient.invalidateQueries({ queryKey: ["merchant", "products"] }),
      ]);
      setError("");
      setEditingShop(false);
    },
    onError: (cause: Error) => setError(cause.message),
  });
  const saveProductMutation = useMutation({
    mutationFn: (input: MerchantProductInput) => createMerchantProduct(input),
    onSuccess: async () => {
      setProductName("");
      setProductUnit("");
      setProductPrice("");
      setError("");
      await queryClient.invalidateQueries({ queryKey: ["merchant", "products"] });
    },
    onError: (cause: Error) => setError(cause.message),
  });
  const editProductMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: MerchantProductInput }) =>
      updateMerchantProduct(id, input),
    onSuccess: async () => {
      setError("");
      await queryClient.invalidateQueries({ queryKey: ["merchant", "products"] });
    },
    onError: (cause: Error) => setError(cause.message),
  });
  const archiveProductMutation = useMutation({
    mutationFn: (id: string) => archiveMerchantProduct(id),
    onSuccess: async () => {
      setError("");
      await queryClient.invalidateQueries({ queryKey: ["merchant", "products"] });
    },
    onError: (cause: Error) => setError(cause.message),
  });

  function submitShop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    saveShopMutation.mutate({
      businessName: businessName.trim(),
      category: category.trim(),
      zoneId,
      locationText: locationText.trim(),
      lat: Number(lat),
      lng: Number(lng),
      ...(payoutPhone.trim() ? { payoutPhone: payoutPhone.trim() } : {}),
    });
  }

  function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    saveProductMutation.mutate({
      name: productName.trim(),
      unit: productUnit.trim() || null,
      priceKes: Number(productPrice),
      inStock: true,
    });
  }

  function selectLocation() {
    setError("");
    if (!navigator.geolocation) {
      setError("Location is not available on this device. Enter your shop coordinates manually.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude.toFixed(6));
        setLng(position.coords.longitude.toFixed(6));
      },
      () => setError("We couldn’t get your location. Allow access or enter coordinates manually."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  if (shopQuery.isPending || zonesQuery.isPending) {
    return (
      <p className="discover-status" role="status">
        Loading your shop workspace…
      </p>
    );
  }
  if (shopQuery.isError || zonesQuery.isError) {
    return (
      <div className="discover-error" role="alert">
        <div>
          <strong>Your shop workspace could not be loaded</strong>
          <p>{shopQuery.error?.message ?? zonesQuery.error?.message}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            void shopQuery.refetch();
            void zonesQuery.refetch();
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  const shop = shopQuery.data;
  const zones = zonesQuery.data.items;

  if (shop && section === "voice") {
    return (
      <section className="merchant-workspace">
        <button className="cart-clear-button" type="button" onClick={() => setSection("catalogue")}>
          <Store size={15} aria-hidden="true" />
          Back to Shop
        </button>
        <MerchantVoiceProducts onManualEntry={() => setSection("catalogue")} />
      </section>
    );
  }

  return (
    <section className="merchant-workspace" aria-labelledby="merchant-workspace-title">
      <div className="merchant-workspace-heading">
        <span className="launch-guest-icon">
          <Store size={23} aria-hidden="true" />
        </span>
        <div>
          <span className="discover-kicker">MERCHANT SPACE</span>
          <h2 id="merchant-workspace-title">{shop ? shop.businessName : "Set up your shop"}</h2>
        </div>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!shop && zones.length === 0 && (
        <div className="discover-empty" role="status">
          <h3>No active service areas yet</h3>
          <p>Your shop can be set up as soon as Beez opens an area in your market.</p>
        </div>
      )}
      {shop && (
        <>
          <p className="merchant-review-note">
            Shop status: <strong>{shop.status.replaceAll("_", " ").toLowerCase()}</strong>. Products
            become visible to customers only after Beez approves your shop.
          </p>
          <div className="merchant-shop-actions">
            {shop.status === "ACTIVE" && (
              <Link className="merchant-public-link" to="/m/$slug" params={{ slug: shop.slug }}>
                View public shop <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            )}
            <button className="cart-clear-button" type="button" onClick={() => setSection("voice")}>
              <Mic size={15} aria-hidden="true" />
              Add products by voice
            </button>
            <button
              className="cart-clear-button"
              type="button"
              onClick={() => {
                setError("");
                setBusinessName(shop.businessName);
                setCategory(shop.category);
                setZoneId(shop.zoneId);
                setLocationText(shop.locationText);
                setLat(String(shop.lat));
                setLng(String(shop.lng));
                setPayoutPhone(shop.payoutPhone ?? "");
                setEditingShop(true);
              }}
            >
              <Pencil size={15} aria-hidden="true" />
              Edit shop details
            </button>
          </div>
          {shop.status === "ACTIVE" && <MerchantAvailability shop={shop} />}
        </>
      )}
      {(!shop || editingShop) && zones.length > 0 && (
        <form className="merchant-form" onSubmit={submitShop}>
          <h3>{shop ? "Edit shop details" : "Set up your shop"}</h3>
          <label>
            Shop name
            <input
              required
              maxLength={120}
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
            />
          </label>
          <label>
            Category
            <input
              required
              maxLength={40}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            />
          </label>
          <label>
            Service area
            <select required value={zoneId} onChange={(event) => setZoneId(event.target.value)}>
              <option value="">Choose an active area</option>
              {shop && !zones.some((zone) => zone.id === shop.zoneId) && (
                <option value={shop.zoneId}>{shop.zoneName} (current area)</option>
              )}
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Shop location or directions
            <input
              required
              maxLength={200}
              value={locationText}
              onChange={(event) => setLocationText(event.target.value)}
            />
          </label>
          <div className="merchant-coordinate-fields">
            <label>
              Latitude
              <input
                required
                type="number"
                step="any"
                min="-90"
                max="90"
                value={lat}
                onChange={(event) => setLat(event.target.value)}
              />
            </label>
            <label>
              Longitude
              <input
                required
                type="number"
                step="any"
                min="-180"
                max="180"
                value={lng}
                onChange={(event) => setLng(event.target.value)}
              />
            </label>
          </div>
          <button className="location-button" type="button" onClick={selectLocation}>
            <MapPin size={17} aria-hidden="true" /> Use my shop location
          </button>
          <label>
            M-Pesa payout number (optional)
            <input
              type="tel"
              placeholder="07… or +254…"
              value={payoutPhone}
              onChange={(event) => setPayoutPhone(event.target.value)}
            />
          </label>
          <div className="merchant-shop-form-actions">
            <button className="checkout-submit" type="submit" disabled={saveShopMutation.isPending}>
              {saveShopMutation.isPending
                ? "Saving shop…"
                : shop
                  ? "Save shop details"
                  : "Submit shop for review"}
            </button>
            {shop && (
              <button
                className="cart-clear-button"
                type="button"
                disabled={saveShopMutation.isPending}
                onClick={() => setEditingShop(false)}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {shop && (
        <>
          {productsQuery.isPending && (
            <p className="discover-status" role="status">
              Loading products…
            </p>
          )}
          {productsQuery.isError && (
            <div className="discover-error" role="alert">
              <p>{productsQuery.error.message}</p>
              <button type="button" onClick={() => void productsQuery.refetch()}>
                Try again
              </button>
            </div>
          )}
          {productsQuery.data && (
            <>
              <form className="merchant-form merchant-product-form" onSubmit={submitProduct}>
                <h3>Add a product</h3>
                <label>
                  Product name
                  <input
                    required
                    maxLength={120}
                    value={productName}
                    onChange={(event) => setProductName(event.target.value)}
                  />
                </label>
                <div className="merchant-coordinate-fields">
                  <label>
                    Unit (optional)
                    <input
                      maxLength={40}
                      placeholder="e.g. kg, pack"
                      value={productUnit}
                      onChange={(event) => setProductUnit(event.target.value)}
                    />
                  </label>
                  <label>
                    Price in KES
                    <input
                      required
                      type="number"
                      min="0"
                      max="100000000"
                      step="1"
                      value={productPrice}
                      onChange={(event) => setProductPrice(event.target.value)}
                    />
                  </label>
                </div>
                <button
                  className="checkout-submit"
                  type="submit"
                  disabled={saveProductMutation.isPending}
                >
                  <Plus size={17} aria-hidden="true" />
                  {saveProductMutation.isPending ? "Saving product…" : "Add product"}
                </button>
              </form>
              <div className="merchant-product-heading">
                <h3>Your products</h3>
                <span>{productsQuery.data.length}</span>
              </div>
              {productsQuery.data.length ? (
                <ul className="shop-product-list">
                  {productsQuery.data.map((product) => (
                    <li className="shop-product merchant-product" key={product.id}>
                      <span className="shop-product-info">
                        <strong>{product.name}</strong>
                        <small>
                          KES {product.priceKes.toLocaleString("en-KE")}
                          {product.unit ? ` / ${product.unit}` : ""}
                          {product.inStock ? " · In stock" : " · Unavailable"}
                        </small>
                      </span>
                      <button
                        className="cart-clear-button"
                        type="button"
                        disabled={editProductMutation.isPending}
                        onClick={() => {
                          setError("");
                          setEditingProductId(product.id);
                          setEditingProductName(product.name);
                          setEditingProductUnit(product.unit ?? "");
                          setEditingProductPrice(String(product.priceKes));
                        }}
                      >
                        <Pencil size={15} aria-hidden="true" />
                        Edit
                      </button>
                      <button
                        className="cart-clear-button"
                        type="button"
                        disabled={editProductMutation.isPending}
                        onClick={() =>
                          editProductMutation.mutate({
                            id: product.id,
                            input: {
                              name: product.name,
                              unit: product.unit,
                              priceKes: product.priceKes,
                              inStock: !product.inStock,
                            },
                          })
                        }
                      >
                        {product.inStock ? "Mark unavailable" : "Mark in stock"}
                      </button>
                      <button
                        className="merchant-archive-button"
                        type="button"
                        aria-label={`Archive ${product.name}`}
                        disabled={archiveProductMutation.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Archive ${product.name}? Customers will no longer see it.`,
                            )
                          ) {
                            archiveProductMutation.mutate(product.id);
                          }
                        }}
                      >
                        <Trash2 size={17} aria-hidden="true" />
                      </button>
                      {editingProductId === product.id && (
                        <form
                          className="merchant-product-edit"
                          aria-label={`Edit ${product.name}`}
                          onSubmit={(event) => {
                            event.preventDefault();
                            setError("");
                            editProductMutation.mutate(
                              {
                                id: product.id,
                                input: {
                                  name: editingProductName.trim(),
                                  unit: editingProductUnit.trim() || null,
                                  priceKes: Number(editingProductPrice),
                                  inStock: product.inStock,
                                },
                              },
                              {
                                onSuccess: () => setEditingProductId(null),
                              },
                            );
                          }}
                        >
                          <label>
                            Product name
                            <input
                              required
                              maxLength={120}
                              value={editingProductName}
                              onChange={(event) => setEditingProductName(event.target.value)}
                            />
                          </label>
                          <label>
                            Unit (optional)
                            <input
                              maxLength={40}
                              placeholder="e.g. kg, pack"
                              value={editingProductUnit}
                              onChange={(event) => setEditingProductUnit(event.target.value)}
                            />
                          </label>
                          <label>
                            Price in KES
                            <input
                              required
                              type="number"
                              min="0"
                              max="100000000"
                              step="1"
                              value={editingProductPrice}
                              onChange={(event) => setEditingProductPrice(event.target.value)}
                            />
                          </label>
                          <div>
                            <button
                              className="checkout-submit"
                              type="submit"
                              disabled={editProductMutation.isPending}
                            >
                              {editProductMutation.isPending ? "Saving…" : "Save changes"}
                            </button>
                            <button
                              className="cart-clear-button"
                              type="button"
                              disabled={editProductMutation.isPending}
                              onClick={() => setEditingProductId(null)}
                            >
                              <X size={15} aria-hidden="true" />
                              Cancel
                            </button>
                          </div>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="cart-zone-note">Add your first product to get started.</p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
