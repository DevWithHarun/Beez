import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Minus, Plus, ShoppingBag, Store } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  createBasket,
  createGuestIdempotencyKey,
  DiscoverApiError,
  getShop,
  startBasketPayment,
} from "./api";
import { addCartProduct, CartLine, clearCart, readCart, updateCartQuantity } from "./cart";
import { clearDeliveryCode, saveDeliveryCode, saveTrackingToken } from "./tracking";

export default function ShopPage({ slug }: { slug: string }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartNotice, setCartNotice] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [landmark, setLandmark] = useState("");
  const [deliveryPoint, setDeliveryPoint] = useState<{ lat: number; lng: number }>();
  const [deliveryLat, setDeliveryLat] = useState("");
  const [deliveryLng, setDeliveryLng] = useState("");
  const [locationError, setLocationError] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [basket, setBasket] = useState<Awaited<ReturnType<typeof createBasket>>>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStartingPayment, setIsStartingPayment] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [deliveryCode, setDeliveryCode] = useState<string | null>(null);
  const checkoutAttempt = useRef<{ fingerprint: string; key: string } | null>(null);

  useEffect(() => {
    const refreshCart = () => setCart(readCart());
    refreshCart();
    window.addEventListener("beez-cart-change", refreshCart);
    window.addEventListener("storage", refreshCart);
    return () => {
      window.removeEventListener("beez-cart-change", refreshCart);
      window.removeEventListener("storage", refreshCart);
    };
  }, []);

  const shopQuery = useQuery({
    queryKey: ["discover", "shop", slug],
    queryFn: () => getShop(slug),
    staleTime: 30_000,
    retry: false,
  });

  if (shopQuery.isPending) {
    return (
      <main className="discover-page shop-page">
        <p className="discover-status" role="status">
          Loading shop…
        </p>
      </main>
    );
  }

  if (shopQuery.isError) {
    return (
      <main className="discover-page shop-page">
        <Link className="shop-back" to="/discover">
          <ArrowLeft size={17} aria-hidden="true" /> Browse shops
        </Link>
        <div className="discover-error" role="alert">
          <div>
            <strong>We couldn’t load this shop</strong>
            <p>{shopQuery.error.message || "Please try again in a moment."}</p>
          </div>
          <button type="button" onClick={() => void shopQuery.refetch()}>
            Try again
          </button>
        </div>
      </main>
    );
  }

  const shop = shopQuery.data;
  const availableProducts = shop.products.filter((product) => product.inStock && shop.isOpen);

  function addProduct(productId: string, productName: string, unit: string | null) {
    if (!shop.isOpen) {
      setCartNotice("This shop is closed and cannot accept orders right now.");
      return;
    }
    const result = addCartProduct({
      productId,
      name: productName,
      unit,
      zoneId: shop.zoneId,
      zoneName: shop.zoneName,
      shopName: shop.name,
      shopSlug: shop.slug,
    });
    setCart(readCart());
    setBasket(undefined);
    setCartNotice(
      result === "different-zone"
        ? "Your basket already has items from another area. Finish or clear it before switching areas."
        : result === "cart-full"
          ? "Your basket has reached the maximum of 100 different products."
          : `${productName} added to your basket.`,
    );
  }

  function setQuantity(productId: string, qty: number) {
    setCart(updateCartQuantity(productId, qty));
    setBasket(undefined);
  }

  function chooseDeliveryLocation() {
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError("Location is not available on this device. You can still browse the shop.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        setDeliveryLat(String(lat));
        setDeliveryLng(String(lng));
        setDeliveryPoint({ lat, lng });
      },
      () => setLocationError("We couldn’t get your location. Allow access or try again."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  function updateDeliveryCoordinate(axis: "lat" | "lng", value: string) {
    const lat = axis === "lat" ? value : deliveryLat;
    const lng = axis === "lng" ? value : deliveryLng;
    if (axis === "lat") setDeliveryLat(value);
    else setDeliveryLng(value);
    if (!lat || !lng || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
      setDeliveryPoint(undefined);
      return;
    }
    setDeliveryPoint({ lat: Number(lat), lng: Number(lng) });
  }

  async function submitCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const firstCartLine = cart[0];
    if (!deliveryPoint || !firstCartLine) {
      setCheckoutError("Choose a delivery point and add items before checkout.");
      return;
    }
    setIsSubmitting(true);
    setCheckoutError("");
    const input = {
      zoneId: firstCartLine.zoneId,
      lines: cart.map(({ productId, qty }) => ({ productId, qty })),
      customer: { name: name.trim(), phone: phone.trim() },
      delivery: { ...deliveryPoint, landmark: landmark.trim() },
    };
    const fingerprint = JSON.stringify(input);
    const key =
      checkoutAttempt.current?.fingerprint === fingerprint
        ? checkoutAttempt.current.key
        : createGuestIdempotencyKey();
    checkoutAttempt.current = { fingerprint, key };
    try {
      const created = await createBasket(input, key);
      checkoutAttempt.current = null;
      clearDeliveryCode();
      setDeliveryCode(null);
      setPaymentMessage("");
      setBasket(created);
      const tokenSaved = saveTrackingToken(created.trackingToken);
      clearCart();
      setCart([]);
      if (!tokenSaved) {
        setCheckoutError(
          "Basket created, but this browser couldn’t save its tracking capability. Keep this page open to check payment status.",
        );
      }
    } catch (error) {
      setCheckoutError(
        error instanceof Error
          ? error.message
          : "We couldn’t create your basket. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function payForBasket() {
    if (!basket) return;
    setIsStartingPayment(true);
    setCheckoutError("");
    try {
      const payment = await startBasketPayment(basket.trackingToken);
      setPaymentMessage(payment.message);
      if (payment.deliveryCode) {
        setDeliveryCode(payment.deliveryCode);
        if (!saveDeliveryCode(basket.trackingToken, payment.deliveryCode)) {
          setCheckoutError(
            "Keep this page open and write down the delivery code; this browser could not save it.",
          );
        }
      }
    } catch (error) {
      setCheckoutError(
        error instanceof DiscoverApiError
          ? error.message
          : "We couldn’t start payment. Your basket has not been charged.",
      );
    } finally {
      setIsStartingPayment(false);
    }
  }

  return (
    <main className="discover-page shop-page">
      <Link className="shop-back" to="/discover">
        <ArrowLeft size={17} aria-hidden="true" /> Browse shops
      </Link>
      <header className="shop-page-header">
        <span className="discover-shop-mark shop-page-mark" aria-hidden="true">
          {shop.name.slice(0, 1).toLocaleUpperCase()}
        </span>
        <div>
          <span className="discover-shop-category">{shop.category}</span>
          <h1>{shop.name}</h1>
          <p className={shop.isOpen ? "shop-open-status" : "shop-closed-status"}>
            {shop.isOpen ? "Open for orders" : "Closed — not accepting orders"}
          </p>
          <p>
            <MapPin size={16} aria-hidden="true" />
            {shop.locationText ?? shop.zoneName}
          </p>
        </div>
      </header>

      <section className="shop-products" aria-labelledby="shop-products-title">
        <div className="shop-products-heading">
          <div>
            <span className="discover-kicker">FROM THIS SHOP</span>
            <h2 id="shop-products-title">Products</h2>
          </div>
          <span>{availableProducts.length} available</span>
        </div>
        {shop.products.length ? (
          <ul className="shop-product-list">
            {shop.products.map((product) => (
              <li className="shop-product" key={product.id}>
                <span className="shop-product-mark" aria-hidden="true">
                  <Store size={20} />
                </span>
                <span className="shop-product-info">
                  <strong>{product.name}</strong>
                  <small>
                    {product.inStock ? (product.unit ?? "Available") : "Currently unavailable"}
                  </small>
                </span>
                <span className="shop-product-price">
                  KES {product.priceKes.toLocaleString("en-KE")}
                  {product.unit ? <small> / {product.unit}</small> : null}
                </span>
                {product.inStock && shop.isOpen && (
                  <button
                    className="shop-add-button"
                    type="button"
                    onClick={() => addProduct(product.id, product.name, product.unit)}
                    aria-label={`Add ${product.name} to basket`}
                  >
                    <Plus size={17} aria-hidden="true" />
                    <span>Add</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="discover-empty shop-no-products">
            <h2>No products listed yet</h2>
            <p>This shop hasn’t added products yet. Check back soon.</p>
          </div>
        )}
        {shop.products.length > 0 && !shop.isOpen && (
          <p className="shop-unavailable-note">This shop is closed and cannot accept orders.</p>
        )}
        {shop.products.length > 0 && shop.isOpen && availableProducts.length === 0 && (
          <p className="shop-unavailable-note">
            All products from this shop are currently unavailable.
          </p>
        )}
        {cartNotice && (
          <p className="cart-notice" role="status">
            {cartNotice}
          </p>
        )}
        {cart.length > 0 && (
          <section className="guest-cart" aria-labelledby="guest-cart-title">
            <div className="shop-products-heading">
              <div>
                <span className="discover-kicker">GUEST CHECKOUT</span>
                <h2 id="guest-cart-title">
                  <ShoppingBag size={20} aria-hidden="true" /> Your basket
                </h2>
              </div>
              <button
                type="button"
                className="cart-clear-button"
                onClick={() => {
                  clearCart();
                  setCart([]);
                  setBasket(undefined);
                }}
              >
                Clear basket
              </button>
            </div>
            <p className="cart-zone-note">Delivery area: {cart[0]?.zoneName ?? "—"}</p>
            <ul className="guest-cart-lines">
              {cart.map((line) => (
                <li key={line.productId}>
                  <span>
                    <strong>{line.name}</strong>
                    <small>
                      {line.shopName}
                      {line.unit ? ` · ${line.unit}` : ""}
                    </small>
                  </span>
                  <span className="cart-quantity">
                    <button
                      type="button"
                      aria-label={`Remove one ${line.name}`}
                      onClick={() => setQuantity(line.productId, line.qty - 1)}
                    >
                      <Minus size={15} aria-hidden="true" />
                    </button>
                    <span>{line.qty}</span>
                    <button
                      type="button"
                      aria-label={`Add one ${line.name}`}
                      onClick={() => setQuantity(line.productId, line.qty + 1)}
                    >
                      <Plus size={15} aria-hidden="true" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            {!basket ? (
              <form className="guest-checkout-form" onSubmit={submitCheckout}>
                <h3>Delivery details</h3>
                <label>
                  Your name
                  <input
                    autoComplete="name"
                    required
                    maxLength={120}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
                <label>
                  M-Pesa phone number
                  <input
                    autoComplete="tel"
                    type="tel"
                    required
                    placeholder="07… or +254…"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                  />
                </label>
                <button className="location-button" type="button" onClick={chooseDeliveryLocation}>
                  <MapPin size={17} aria-hidden="true" />
                  {deliveryPoint ? "Delivery location selected" : "Use my delivery location"}
                </button>
                {locationError && (
                  <p className="form-error" role="alert">
                    {locationError}
                  </p>
                )}
                <div className="guest-delivery-coordinates">
                  <label>
                    Delivery latitude
                    <input
                      required
                      type="number"
                      step="any"
                      min="-90"
                      max="90"
                      value={deliveryLat}
                      onChange={(event) => updateDeliveryCoordinate("lat", event.target.value)}
                    />
                  </label>
                  <label>
                    Delivery longitude
                    <input
                      required
                      type="number"
                      step="any"
                      min="-180"
                      max="180"
                      value={deliveryLng}
                      onChange={(event) => updateDeliveryCoordinate("lng", event.target.value)}
                    />
                  </label>
                </div>
                <label>
                  Nearby landmark or delivery instructions
                  <input
                    required
                    maxLength={200}
                    value={landmark}
                    onChange={(event) => setLandmark(event.target.value)}
                  />
                </label>
                {checkoutError && (
                  <p className="form-error" role="alert">
                    {checkoutError}
                  </p>
                )}
                {paymentMessage && (
                  <p className="merchant-orders-success" role="status">
                    {paymentMessage}
                  </p>
                )}
                {deliveryCode && (
                  <div className="guest-delivery-code-receipt" role="status">
                    <strong>Your delivery code: {deliveryCode}</strong>
                    <p>
                      Keep this code private and give it to your rider only when your order arrives.
                    </p>
                  </div>
                )}
                <p className="shop-order-note">
                  Beez checks current prices and delivery charges before creating your basket.
                  Browsing and ordering do not require an account.
                </p>
                <button className="checkout-submit" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Preparing your basket…" : "Get server quote"}
                </button>
              </form>
            ) : (
              <div className="basket-confirmation" aria-live="polite">
                <h3>Basket {basket.basketNo}</h3>
                <p>Prices and delivery are confirmed by Beez.</p>
                <dl>
                  <div>
                    <dt>Items</dt>
                    <dd>KES {basket.itemsTotalKes.toLocaleString("en-KE")}</dd>
                  </div>
                  <div>
                    <dt>Delivery</dt>
                    <dd>KES {basket.deliveryFeeKes.toLocaleString("en-KE")}</dd>
                  </div>
                  <div className="basket-total">
                    <dt>Total</dt>
                    <dd>KES {basket.totalKes.toLocaleString("en-KE")}</dd>
                  </div>
                </dl>
                {checkoutError && (
                  <p className="form-error" role="alert">
                    {checkoutError}
                  </p>
                )}
                <button
                  className="checkout-submit"
                  type="button"
                  onClick={() => void payForBasket()}
                  disabled={isStartingPayment}
                >
                  {isStartingPayment ? "Connecting to M-Pesa…" : "Pay with M-Pesa"}
                </button>
                <p className="shop-order-note">
                  Payment is not complete until Beez verifies it. This basket expires{" "}
                  {new Date(basket.expiresAt).toLocaleTimeString()}.
                </p>
                <Link className="merchant-public-link" to="/track">
                  Track this basket
                </Link>
              </div>
            )}
          </section>
        )}
      </section>
    </main>
  );
}
