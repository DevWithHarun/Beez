import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, MarketHeader, Photo, Shell, Stepper } from "@/components/marketplace/shared";
import { useMarketplace } from "@/components/marketplace/store";
import { subtotal } from "@/lib/marketplace";
import { useCatalog } from "@/lib/shop-data";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your Cart | Beez" },
      { name: "description", content: "Review items before checkout." },
      { property: "og:title", content: "Your Cart | Beez" },
      { property: "og:description", content: "Review your basket." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { cart, prices, change, acceptPrice, clear, delivery, ready, syncing, syncError } =
    useMarketplace();
  const queryClient = useQueryClient();
  const catalog = useCatalog();
  const products = catalog.data ?? [];
  const items = products.filter((product) => (cart[product.id] ?? 0) > 0);
  const missingIds = Object.keys(cart).filter(
    (id) => !products.some((product) => product.id === id),
  );
  const itemCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  const sub = subtotal(cart, products);
  const fee = delivery ? 50 : 0;
  const hasUnavailable =
    missingIds.length > 0 || items.some((product) => product.stock < (cart[product.id] ?? 0));
  const total = sub + fee;

  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: ["catalog"] });
  }, [queryClient]);

  return (
    <Shell
      showNav={false}
      landing
      bottomBar={
        itemCount > 0 && !catalog.isError ? (
          <div className="market-cart-footer">
            {hasUnavailable ? (
              <Button className="market-cta !mt-0" disabled>
                Review unavailable items
              </Button>
            ) : (
              <Button asChild className="market-cta !mt-0">
                <Link to="/checkout">Checkout · KSh {total.toLocaleString()}</Link>
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      <MarketHeader title="Your Cart" cart>
        {itemCount > 0 && (
          <Button variant="link" onClick={clear}>
            Clear All
          </Button>
        )}
      </MarketHeader>
      {syncError && (
        <p role="alert" className="market-error">
          {syncError}
        </p>
      )}
      {!syncError && syncing && (
        <p role="status" className="text-center text-xs text-muted-foreground">
          Saving your cart…
        </p>
      )}
      {catalog.isPending || !ready ? (
        <p className="py-12 text-center text-muted-foreground">Loading your cart…</p>
      ) : catalog.isError ? (
        <p role="alert" className="py-12 text-center text-destructive">
          Your cart could not be refreshed. Please try again.
        </p>
      ) : itemCount === 0 ? (
        <Empty title="Your cart is empty">
          <Button asChild className="market-cta">
            <Link to="/groceries">Continue shopping</Link>
          </Button>
        </Empty>
      ) : (
        <>
          {missingIds.map((id) => (
            <div key={id} role="alert" className="market-line-item">
              <div className="min-w-0 flex-1">
                <h2>Item no longer available</h2>
                <p>Please remove it before checkout.</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove unavailable item"
                onClick={() => change(id, -(cart[id] ?? 0))}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          {items.map((product) => {
            const quantity = cart[product.id] ?? 0;
            const oldPrice = prices[product.id];
            const changedPrice = oldPrice !== undefined && oldPrice !== product.price;
            const unavailable = product.stock === 0;
            return (
              <div key={product.id} className="market-line-item">
                <Photo product={product} />
                <div className="min-w-0 flex-1">
                  <h2>{product.name}</h2>
                  <p>KSh {product.price.toLocaleString()} each</p>
                  {changedPrice && (
                    <div role="status" className="mt-1 text-xs text-amber-700">
                      Price changed from KSh {oldPrice.toLocaleString()} to KSh{" "}
                      {product.price.toLocaleString()}.
                      <button
                        type="button"
                        className="ml-1 font-bold underline"
                        onClick={() => acceptPrice(product.id, product.price)}
                      >
                        Accept price
                      </button>
                    </div>
                  )}
                  {unavailable && (
                    <p role="alert" className="text-destructive">
                      Sold out. Remove this item to continue.
                    </p>
                  )}
                  {!unavailable && quantity > product.stock && (
                    <p role="alert" className="text-destructive">
                      Only {product.stock} available. Reduce the quantity to continue.
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <Stepper
                      value={quantity}
                      max={Math.min(product.stock, 99)}
                      onChange={(delta) => change(product.id, delta, product.price)}
                    />
                    <b>KSh {(product.price * quantity).toLocaleString()}</b>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${product.name}`}
                  onClick={() => change(product.id, -quantity)}
                >
                  <Trash2 />
                </Button>
              </div>
            );
          })}
          <div className="market-totals">
            <div>
              <span>Subtotal</span>
              <span>KSh {sub.toLocaleString()}</span>
            </div>
            <div>
              <span>Delivery Fee</span>
              <span>KSh {fee.toLocaleString()}</span>
            </div>
            <div>
              <span>Total</span>
              <span>KSh {total.toLocaleString()}</span>
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}
