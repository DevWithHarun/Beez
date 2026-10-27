import { useMemo, useState, type FormEvent } from "react";
import { PageTitle } from "@/components/admin/AdminShell";
import {
  deleteAdminProduct,
  exportCsv,
  kes,
  saveAdminProduct,
  updateAdminProduct,
  useTable,
  type AdminProductInput,
  type Merchant,
  type Product,
} from "@/lib/admin-data";

type ProductDraft = {
  name: string;
  category: string;
  price_kes: string;
  stock: string;
  merchant_id: string;
  active: boolean;
};

const EMPTY_DRAFT: ProductDraft = {
  name: "",
  category: "",
  price_kes: "",
  stock: "",
  merchant_id: "",
  active: true,
};

type ProductStatusFilter = "all" | "active" | "inactive";

export function ProductsPage() {
  const { rows: products, loaded, error, reload } = useTable<Product>("products");
  const { rows: merchants, error: merchantError } = useTable<Merchant>("merchants");
  const [draft, setDraft] = useState<ProductDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProductStatusFilter>("all");
  const [merchantFilter, setMerchantFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return products.filter((product) => {
      const merchantName =
        merchants.find((merchant) => merchant.id === product.merchant_id)?.name ?? "";
      const matchesQuery =
        !query ||
        [product.name, product.category, merchantName].some((value) =>
          value.toLocaleLowerCase().includes(query),
        );
      const matchesStatus =
        statusFilter === "all" || (statusFilter === "active" ? product.active : !product.active);
      const matchesMerchant = !merchantFilter || product.merchant_id === merchantFilter;
      return matchesQuery && matchesStatus && matchesMerchant;
    });
  }, [products, merchants, search, statusFilter, merchantFilter]);

  const resetForm = () => {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError("");
    setMessage("");
    const price = Number(draft.price_kes);
    const stock = Number(draft.stock);
    if (!Number.isSafeInteger(price) || price < 0 || !Number.isSafeInteger(stock) || stock < 0) {
      setActionError("Price and stock must be whole numbers greater than or equal to zero.");
      return;
    }

    const values: AdminProductInput = {
      name: draft.name.trim(),
      category: draft.category.trim(),
      price_kes: price,
      stock,
      merchant_id: draft.merchant_id || null,
      active: draft.active,
    };
    if (!values.name) {
      setActionError("Product name is required.");
      return;
    }

    setBusy(true);
    try {
      await saveAdminProduct(editingId, values);
      resetForm();
      setMessage(editingId ? "Product changes saved." : "Product added.");
      await reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The product could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const runProductAction = async (
    product: Product,
    action: () => Promise<void>,
    success: string,
  ) => {
    setBusyProductId(product.id);
    setActionError("");
    setMessage("");
    try {
      await action();
      setMessage(success);
      await reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The product could not be updated.");
    } finally {
      setBusyProductId(null);
    }
  };

  const startEditing = (product: Product) => {
    setEditingId(product.id);
    setDraft({
      name: product.name,
      category: product.category,
      price_kes: String(product.price_kes),
      stock: String(product.stock),
      merchant_id: product.merchant_id ?? "",
      active: product.active,
    });
    setMessage("");
    setActionError("");
  };

  const exportProducts = () => {
    exportCsv(
      "products.csv",
      filteredProducts.map((product) => ({
        name: product.name,
        category: product.category,
        merchant: merchants.find((merchant) => merchant.id === product.merchant_id)?.name ?? "",
        price_kes: product.price_kes,
        stock: product.stock,
        active: product.active,
        created_at: product.created_at,
      })),
    );
  };

  const activeCount = products.filter((product) => product.active).length;
  const outOfStockCount = products.filter((product) => product.stock === 0).length;

  return (
    <div className="ad-page">
      <PageTitle
        title="Products"
        sub={`${products.length} products · ${activeCount} active · ${outOfStockCount} out of stock`}
        action={
          <button className="ad-btn ghost" onClick={() => void reload()} disabled={!loaded}>
            Refresh
          </button>
        }
      />

      {actionError && (
        <p className="ad-msg" role="alert">
          {actionError}
        </p>
      )}
      {message && (
        <p className="ad-msg" role="status">
          {message}
        </p>
      )}
      {merchantError && (
        <p className="ad-msg" role="alert">
          Merchant options could not be loaded: {merchantError}
        </p>
      )}

      <form className="ad-card ad-form" onSubmit={(event) => void submit(event)}>
        <h2>{editingId ? "Edit product" : "Add product"}</h2>
        <label>
          Name
          <input
            className="ad-input"
            required
            maxLength={120}
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </label>
        <label>
          Category
          <input
            className="ad-input"
            maxLength={100}
            value={draft.category}
            onChange={(event) => setDraft({ ...draft, category: event.target.value })}
          />
        </label>
        <label>
          Price (KES)
          <input
            className="ad-input"
            type="number"
            min="0"
            step="1"
            required
            value={draft.price_kes}
            onChange={(event) => setDraft({ ...draft, price_kes: event.target.value })}
          />
        </label>
        <label>
          Stock
          <input
            className="ad-input"
            type="number"
            min="0"
            step="1"
            required
            value={draft.stock}
            onChange={(event) => setDraft({ ...draft, stock: event.target.value })}
          />
        </label>
        <label>
          Merchant
          <select
            className="ad-input"
            value={draft.merchant_id}
            onChange={(event) => setDraft({ ...draft, merchant_id: event.target.value })}
          >
            <option value="">No merchant</option>
            {merchants.map((merchant) => (
              <option key={merchant.id} value={merchant.id}>
                {merchant.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
          />{" "}
          Available to customers
        </label>
        <button className="ad-btn" disabled={busy || Boolean(merchantError)}>
          {busy ? "Saving…" : editingId ? "Save changes" : "Add product"}
        </button>
        {editingId && (
          <button type="button" className="ad-btn ghost" onClick={resetForm} disabled={busy}>
            Cancel edit
          </button>
        )}
      </form>

      <section className="ad-card" aria-label="Product catalog">
        <div className="ad-form">
          <label>
            Search products
            <input
              className="ad-input"
              type="search"
              aria-label="Search products"
              placeholder="Name, category, or merchant"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label>
            Availability
            <select
              className="ad-input"
              aria-label="Filter by availability"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as ProductStatusFilter)}
            >
              <option value="all">All products</option>
              <option value="active">Available</option>
              <option value="inactive">Unavailable</option>
            </select>
          </label>
          <label>
            Merchant
            <select
              className="ad-input"
              aria-label="Filter by merchant"
              value={merchantFilter}
              onChange={(event) => setMerchantFilter(event.target.value)}
            >
              <option value="">All merchants</option>
              {merchants.map((merchant) => (
                <option key={merchant.id} value={merchant.id}>
                  {merchant.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="ad-btn ghost"
            onClick={exportProducts}
            disabled={!filteredProducts.length}
          >
            Export CSV
          </button>
        </div>

        {error && (
          <p className="ad-msg" role="alert">
            {error}
          </p>
        )}
        {!loaded && <p className="ad-muted">Loading products…</p>}
        {loaded && !error && filteredProducts.length === 0 && (
          <p className="ad-muted">
            {products.length ? "No products match these filters." : "No products yet."}
          </p>
        )}
        {filteredProducts.length > 0 && (
          <table className="ad-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Merchant</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Availability</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => {
                const merchantName =
                  merchants.find((merchant) => merchant.id === product.merchant_id)?.name ?? "—";
                const rowBusy = busyProductId === product.id;
                return (
                  <tr key={product.id}>
                    <td>{product.name}</td>
                    <td>{product.category || "—"}</td>
                    <td>{merchantName}</td>
                    <td>{kes(product.price_kes)}</td>
                    <td>
                      <button
                        className="ad-btn ghost sm"
                        aria-label={`Decrease stock for ${product.name}`}
                        disabled={rowBusy || product.stock <= 0}
                        onClick={() =>
                          void runProductAction(
                            product,
                            () => updateAdminProduct(product.id, { stock: product.stock - 1 }),
                            `${product.name} stock decreased.`,
                          )
                        }
                      >
                        −
                      </button>{" "}
                      {product.stock}{" "}
                      <button
                        className="ad-btn ghost sm"
                        aria-label={`Increase stock for ${product.name}`}
                        disabled={rowBusy || product.stock >= 2147483647}
                        onClick={() =>
                          void runProductAction(
                            product,
                            () => updateAdminProduct(product.id, { stock: product.stock + 1 }),
                            `${product.name} stock increased.`,
                          )
                        }
                      >
                        +
                      </button>
                    </td>
                    <td>{product.active ? "Available" : "Unavailable"}</td>
                    <td>
                      <button
                        className="ad-btn ghost sm"
                        onClick={() => startEditing(product)}
                        disabled={busy || Boolean(busyProductId)}
                      >
                        Edit
                      </button>{" "}
                      <button
                        className="ad-btn ghost sm"
                        disabled={rowBusy || busy}
                        onClick={() =>
                          void runProductAction(
                            product,
                            () => updateAdminProduct(product.id, { active: !product.active }),
                            `${product.name} is now ${product.active ? "unavailable" : "available"}.`,
                          )
                        }
                      >
                        {product.active ? "Make unavailable" : "Make available"}
                      </button>{" "}
                      <button
                        className="ad-btn ghost sm"
                        disabled={rowBusy || busy}
                        onClick={() => {
                          if (
                            window.confirm(`Delete ${product.name}? Order history will be kept.`)
                          ) {
                            void runProductAction(
                              product,
                              () => deleteAdminProduct(product.id),
                              `${product.name} deleted.`,
                            );
                          }
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
