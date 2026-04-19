import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Product, User, Invoice, Supplier } from '../core/domain';
import { TransactionDTO } from '../application/services';
import { ApiProductRepository, ApiInvoiceRepository, ApiSupplierRepository, buildApiHeaders } from '../infrastructure/api';
import { ConsoleLogger } from '../infrastructure/persistence';
import { clearStoredAuthSession, getStoredAuthUser, loginWithPassword } from '../lib/authSession';
import { runRefreshTasks } from '../lib/utils';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface PharmacyContextType {
  products: Product[];
  invoices: Invoice[];
  suppliers: Supplier[];
  customers: any[];
  refreshCustomers: (force?: boolean) => Promise<void>;
  createCustomer: (payload: { name: string; phone?: string; email?: string; }) => Promise<any>;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (login: string, password: string) => Promise<void>;
  logout: () => void;
  refreshProducts: () => Promise<void>;
  refreshInvoices: () => Promise<void>;
  refreshSuppliers: (force?: boolean) => Promise<void>;
  processTransaction: (transaction: TransactionDTO) => Promise<Invoice>;
  restockInventory: (payload: {
    productId: string;
    batchNumber: string;
    quantity: number;
    unit: string;
    costBasis: number;
    supplierId?: string;
    manufacturedDate: Date;
    expiryDate: Date;
  }) => Promise<void>;
  importPurchaseInvoice: (payload: {
    supplierId: string;
    invoiceNumber: string;
    invoiceDate: string;
    discountAmount?: number;
    taxAmount?: number;
    status?: 'DRAFT' | 'POSTED';
    items: Array<{
      productId: string;
      batchNumber: string;
      quantity: number;
      unitsInPack: number;
      totalUnits: number;
      packPrice: number;
      unitPrice: number;
      total: number;
      unit: string;
      costBasis: number;
      manufacturedDate: Date;
      expiryDate: Date;
    }>;
  }) => Promise<void>;
  createProduct: (payload: Omit<Product, 'batches' | 'totalStock' | 'status'> & { minStock?: number }) => Promise<Product>;
  updateProduct: (payload: Product) => Promise<Product>;
  deleteProduct: (productId: string) => Promise<void>;
}

const PharmacyContext = createContext<PharmacyContextType | undefined>(undefined);

const bootstrapLoads = new Map<string, Promise<void>>();

const getBootstrapLoadKey = (user: User | null) => {
  const token = window.sessionStorage.getItem('sklad_token') || localStorage.getItem('sklad_token') || 'guest';
  return user ? `auth:${user.id}:${token}` : `guest:${token}`;
};

export const PharmacyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [user, setUser] = useState<User | null>(() => getStoredAuthUser());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cacheRef = React.useRef<{
    suppliers: CacheEntry<Supplier[]> | null;
  }>({
    suppliers: null,
  });

  const CACHE_TTL = 30 * 60 * 1000;

  const productRepository = new ApiProductRepository();
  const invoiceRepository = new ApiInvoiceRepository();
  const supplierRepository = new ApiSupplierRepository();
  const logger = new ConsoleLogger();

  const login = async (login: string, password: string) => {
    setError(null);
    try {
      const authSession = await loginWithPassword(login, password);
      setUser(authSession.user);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const logout = () => {
    clearStoredAuthSession();
    setUser(null);
  };

  const refreshProducts = async () => {
    try {
      const result = await productRepository.getAll();
      const data = Array.isArray(result) ? result : (result?.items || []);
      setProducts(data);
    } catch (err: any) {
      logger.error('Failed to fetch products', err);
    }
  };

  const refreshInvoices = async () => {
    try {
      const result = await invoiceRepository.getAll();
      const data = Array.isArray(result) ? result : (result?.items || []);
      setInvoices(data);
    } catch (err: any) {
      logger.error('Failed to fetch invoices', err);
    }
  };

  const refreshSuppliers = async (force: boolean = false) => {
    try {
      const now = Date.now();
      const cached = cacheRef.current.suppliers;

      if (!force && cached && (now - cached.timestamp) < CACHE_TTL) {
        setSuppliers(cached.data);
        return;
      }

      const data = await supplierRepository.getAll();
      const safeData = Array.isArray(data) ? data : ((data as any)?.items || []);
      cacheRef.current.suppliers = { data: safeData, timestamp: now };
      setSuppliers(safeData);
    } catch (err: any) {
      logger.error('Failed to fetch suppliers', err);
    }
  };

  const refreshCustomers = async (_force: boolean = false) => {
    try {
      const response = await fetch('/api/customers', { headers: await buildApiHeaders() });
      const data = await response.json();
      setCustomers(Array.isArray(data.items) ? data.items : []);
    } catch {
      setCustomers([]);
    }
  };

  const createCustomer = async (payload: { name: string; phone?: string; email?: string; }) => {
    const response = await fetch('/api/customers', {
      method: 'POST',
      headers: await buildApiHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Ошибка создания клиента');
    await refreshCustomers(true);
    return data;
  };

  const processTransaction = async (transaction: TransactionDTO) => {
    try {
      const response = await fetch('/api/sales/complete', {
        method: 'POST',
        headers: await buildApiHeaders(),
        body: JSON.stringify(transaction),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || 'Transaction failed');
      }

      const invoice: Invoice = {
        ...body,
        createdAt: new Date(body.createdAt),
      };

      await runRefreshTasks(refreshProducts, refreshInvoices);
      return invoice;
    } catch (err) {
      logger.error('Transaction failed', err);
      throw err;
    }
  };

  const restockInventory = async (payload: {
    productId: string;
    batchNumber: string;
    quantity: number;
    unit: string;
    costBasis: number;
    supplierId?: string;
    manufacturedDate: Date;
    expiryDate: Date;
  }) => {
    const response = await fetch('/api/inventory/restock', {
      method: 'POST',
      headers: await buildApiHeaders(),
      body: JSON.stringify(payload),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || 'Failed to restock inventory');
    }
  };

  const importPurchaseInvoice = async (payload: {
    supplierId: string;
    invoiceNumber: string;
    invoiceDate: string;
    discountAmount?: number;
    taxAmount?: number;
    status?: 'DRAFT' | 'POSTED';
    items: Array<{
      productId: string;
      batchNumber: string;
      quantity: number;
      unitsInPack: number;
      totalUnits: number;
      packPrice: number;
      unitPrice: number;
      total: number;
      unit: string;
      costBasis: number;
      manufacturedDate: Date;
      expiryDate: Date;
    }>;
  }) => {
    const response = await fetch('/api/inventory/purchase-invoices', {
      method: 'POST',
      headers: await buildApiHeaders(),
      body: JSON.stringify(payload),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || 'Failed to import purchase invoice');
    }
  };

  const createProduct = async (payload: Omit<Product, 'batches' | 'totalStock' | 'status'> & { minStock?: number; batchData?: any }) => {
    const batchData = (payload as any).batchData;

    const productToCreate: any = {
      name: payload.name,
      sku: payload.sku,
      barcode: payload.barcode || undefined,
      category: payload.category || 'Uncategorized',
      manufacturer: payload.manufacturer || 'Unknown',
      countryOfOrigin: payload.countryOfOrigin || undefined,
      minStock: payload.minStock ?? 10,
      costPrice: payload.costPrice,
      sellingPrice: payload.sellingPrice,
      status: 'ACTIVE',
      image: payload.image || '',
      prescription: payload.prescription,
      markingRequired: payload.markingRequired,
      analogs: payload.analogs,
    };

    if (batchData && batchData.expiryDate) {
      productToCreate.batches = [
        {
          batchNumber: batchData.batchNumber || `#B-${Date.now()}`,
          quantity: batchData.initialQuantity || 0,
          initialQty: batchData.initialQuantity || 0,
          currentQty: batchData.initialQuantity || 0,
          availableQty: batchData.initialQuantity || 0,
          reservedQty: 0,
          unit: 'шт.',
          costBasis: payload.costPrice,
          manufacturedDate: new Date().toISOString(),
          expiryDate: batchData.expiryDate,
          status: 'STABLE',
          movements: [],
        },
      ];
    }

    const created = await productRepository.save(productToCreate);
    await refreshProducts();
    return created;
  };

  const updateProduct = async (payload: Product) => {
    await productRepository.update(payload);
    await refreshProducts();
    const updated = await productRepository.getById(payload.id);
    if (!updated) {
      throw new Error('Updated product could not be reloaded');
    }
    return updated;
  };

  const deleteProduct = async (productId: string) => {
    await productRepository.delete(productId);
    await refreshProducts();
  };

  useEffect(() => {
    const loadKey = getBootstrapLoadKey(user);
    let isActive = true;

    const init = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      const applyTheme = (theme: string) => {
        document.documentElement.dataset.theme = theme;
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      };

      void fetch('/api/system/me/preferences', { headers: await buildApiHeaders(false) })
        .then((res) => res.json())
        .then((prefs) => {
          if (prefs?.appearance?.theme) {
            applyTheme(prefs.appearance.theme);
          }
        })
        .catch(() => {});

      setIsLoading(false);

      let bootstrapPromise = bootstrapLoads.get(loadKey);
      if (!bootstrapPromise) {
        bootstrapPromise = runRefreshTasks(
          refreshProducts,
          refreshInvoices,
          refreshSuppliers,
        ).catch((err) => {
          bootstrapLoads.delete(loadKey);
          throw err;
        });
        bootstrapLoads.set(loadKey, bootstrapPromise);
      }

      void bootstrapPromise.finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });
    };

    void init();

    return () => {
      isActive = false;
    };
  }, [user]);

  return (
    <PharmacyContext.Provider value={{
      products,
      invoices,
      suppliers,
      customers,
      refreshCustomers,
      createCustomer,
      user,
      isLoading,
      error,
      login,
      logout,
      refreshProducts,
      refreshInvoices,
      refreshSuppliers,
      processTransaction,
      restockInventory,
      importPurchaseInvoice,
      createProduct,
      updateProduct,
      deleteProduct,
    }}
    >
      {children}
    </PharmacyContext.Provider>
  );
};

export const usePharmacy = () => {
  const context = useContext(PharmacyContext);
  if (!context) {
    throw new Error('usePharmacy must be used within a PharmacyProvider');
  }
  return context;
};
