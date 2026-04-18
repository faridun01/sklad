import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePharmacy } from '../context';
import { buildApiHeaders } from '../../infrastructure/api';
import { saveLatestClosedShiftNotice } from '../../lib/shiftCloseNotice';
import { CloseShiftModal, OpenShiftModal } from './ShiftView';
import {
  AlertCircle,
  Barcode,
  CheckCircle2,
  CircleAlert,
  CreditCard,
  Minus,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
  User,
  Wallet,
} from 'lucide-react';
import { Product } from '../../core/domain';

type CartItem = Product & {
  quantity: number;
  batchId?: string;
  batchNumber?: string;
  discountAmount?: number;
  prescriptionPresented?: boolean;
  expiryDate?: string;
};

type ActiveShift = {
  id: string;
  shiftNo: string;
  status: 'OPEN' | 'CLOSED';
  openAt: string;
};

type ClosedShiftSummary = {
  shiftId: string;
  shiftNo?: string;
  grossProfit: number;
  finalAmount: number;
  netSales: number;
};

const formatUnitQuantity = (quantity: number) => {
  const safeQuantity = Math.max(0, Math.floor(Number(quantity) || 0));
  return `${safeQuantity} ед.`;
};

const ProductCatalog = memo(({
  filteredProducts,
  onAddToCart,
}: {
  filteredProducts: Product[];
  onAddToCart: (product: Product) => void;
}) => {
  if (filteredProducts.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="rounded-2xl border border-dashed border-[#5A5A40]/15 bg-[#f5f5f0]/40 px-5 py-8 text-center text-sm text-[#5A5A40]/55 font-normal">
          Товары не найдены
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar [direction:rtl]">
      <div className="space-y-1.5 [direction:ltr]">
        {filteredProducts.map((product, index) => {
          const stockLabel = formatUnitQuantity(product.totalStock);
          const lowStock = product.totalStock < (product.minStock || 10);

          // Expiry Analysis
          const now = new Date();
          const soonDays = 90;
          const criticalDays = 30;
          
          let expiryStatus: 'EXPIRED' | 'CRITICAL' | 'SOON' | 'OK' = 'OK';
          let minDays = Infinity;

          if (product.batches && product.batches.length > 0) {
            for (const b of product.batches) {
              if (b.quantity <= 0) continue;
              const exp = new Date(b.expiryDate);
              const diffTime = exp.getTime() - now.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              
              if (diffDays < minDays) minDays = diffDays;
              
              if (diffDays <= 0) expiryStatus = 'EXPIRED';
              else if (diffDays <= criticalDays && expiryStatus !== 'EXPIRED') expiryStatus = 'CRITICAL';
              else if (diffDays <= soonDays && expiryStatus === 'OK') expiryStatus = 'SOON';
            }
          }

          return (
            <button
              key={product.id}
              onClick={() => onAddToCart(product)}
              className="w-full bg-white px-3 py-2 rounded-xl shadow-sm border border-[#5A5A40]/5 hover:shadow-md transition-all text-left group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 bg-[#f5f5f0] rounded-lg flex items-center justify-center text-[#5A5A40]/30 group-hover:bg-[#5A5A40] group-hover:text-white transition-colors shrink-0 text-[10px] font-normal">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                       <h3 className="text-[14px] font-normal text-[#151619] truncate leading-tight">{product.name}</h3>
                       {product.countryOfOrigin && (
                          <span className="shrink-0 px-1.5 py-0.5 bg-[#5A5A40]/5 text-[#5A5A40]/60 text-[8px] uppercase tracking-wider rounded-md border border-[#5A5A40]/10 font-bold">
                            {product.countryOfOrigin}
                          </span>
                       )}
                       {expiryStatus === 'EXPIRED' && <span className="shrink-0 scale-75 px-1.5 py-0.5 bg-red-600 text-white text-[8px] uppercase tracking-tighter rounded-md font-bold">Просрочено</span>}
                       {expiryStatus === 'CRITICAL' && <span className="shrink-0 scale-75 px-1.5 py-0.5 bg-orange-500 text-white text-[8px] uppercase tracking-tighter rounded-md font-bold">Срок!</span>}
                    </div>
                    <div className="flex items-center gap-2.5 mt-0.5">
                      <span className="text-[9px] text-[#5A5A40]/40 uppercase tracking-widest">{product.sku}</span>
                      <span className="text-[9px] text-[#5A5A40]/30 italic truncate max-w-30">{product.manufacturer}</span>
                      <span className={`text-[9px] font-normal px-1.5 py-0.5 rounded-md ${lowStock ? 'bg-red-50 text-red-600' : 'bg-[#f5f5f0] text-[#5A5A40]/50'}`}>
                        {stockLabel}
                      </span>
                      {expiryStatus !== 'OK' && expiryStatus !== 'EXPIRED' && (
                         <span className={`text-[9px] font-normal px-1.5 py-0.5 rounded-md flex items-center gap-1 ${expiryStatus === 'CRITICAL' ? 'text-orange-600 bg-orange-50' : 'text-amber-600 bg-amber-50'}`}>
                            <AlertCircle size={8} /> {minDays <= 0 ? 'Истек' : `${minDays} дн.`}
                         </span>
                      )}
                    </div>
                  </div>
                  <p className="text-[15px] font-normal text-[#5A5A40] tabular-nums whitespace-nowrap">
                    {product.sellingPrice.toFixed(2)} <span className="text-[10px] opacity-40">TJS</span>
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});

ProductCatalog.displayName = 'ProductCatalog';

export const POSView: React.FC = () => {
  const { products, refreshProducts, processTransaction, user, customers, refreshCustomers, createCustomer } = usePharmacy();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [paymentType, setPaymentType] = useState<'CASH' | 'CARD' | 'CREDIT'>('CASH');
  const [customerId, setCustomerId] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeShift, setActiveShift] = useState<ActiveShift | null>(null);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [shiftError, setShiftError] = useState<string | null>(null);
  const [isOpenShiftModal, setIsOpenShiftModal] = useState(false);
  const [isCloseShiftModal, setIsCloseShiftModal] = useState(false);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [closedShiftSummary, setClosedShiftSummary] = useState<ClosedShiftSummary | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [barcodeScanning, setBarcodeScanning] = useState(false);

  useEffect(() => { if (customers.length === 0) void refreshCustomers(); }, [customers.length, refreshCustomers]);

  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const cartProductIds = useMemo(() => new Set(cart.map((item) => item.id)), [cart]);

  const filteredProducts = useMemo(() => products.filter((product) => {
    if (product.totalStock <= 0) return false;
    if (cartProductIds.has(product.id)) return false;
    const matchesSearch = (
      product.name.toLowerCase().includes(normalizedSearchTerm) ||
      product.sku.toLowerCase().includes(normalizedSearchTerm) ||
      String(product.barcode || '').toLowerCase().includes(normalizedSearchTerm)
    );
    if (selectedLetter) {
      return matchesSearch && product.name.toUpperCase().startsWith(selectedLetter);
    }
    return matchesSearch;
  }), [products, normalizedSearchTerm, cartProductIds, selectedLetter]);

  const getCartItemKey = useCallback((item: Pick<CartItem, 'id' | 'batchId'>) => `${item.id}:${item.batchId || 'default'}`, []);
  const addToCart = useCallback((product: Product) => {
    if (product.totalStock <= 0) {
      setError('Товар закончился на складе');
      window.setTimeout(() => setError(null), 2000);
      return;
    }
    setCart((currentCart) => {
      const existing = currentCart.find((item) => item.id === product.id);
      if (existing) {
        return currentCart.map((item) => {
          if (item.id !== product.id) return item;
          return { ...item, quantity: Math.min(item.totalStock, item.quantity + 1) };
        });
      }
      return [
        ...currentCart,
        {
          ...product,
          quantity: 1,
          batchId: undefined, 
          batchNumber: 'FIFO Авто',
          expiryDate: new Date().toISOString(),
          prescriptionPresented: !product.prescription,
        }
      ];
    });
  }, []);

  const subtotal = useMemo(() => cart.reduce((acc, item) => acc + (item.sellingPrice * item.quantity), 0), [cart]);
  const total = subtotal;

  useEffect(() => { barcodeInputRef.current?.focus(); }, []);

  const loadActiveShift = useCallback(async () => {
    setShiftLoading(true);
    try {
      const response = await fetch('/api/shifts/active', { headers: await buildApiHeaders() });
      const body = await response.json().catch(() => null);
      if (response.ok) setActiveShift(body);
      else throw new Error('Shift load failed');
    } catch {
      setActiveShift(null);
    } finally {
      setShiftLoading(false);
    }
  }, []);

  const loadRecentSales = useCallback(async () => {
    try {
      const res = await fetch('/api/sales/invoices?limit=10', { headers: await buildApiHeaders() });
      const data = await res.json();
      setRecentSales(data.items || []);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { loadActiveShift(); loadRecentSales(); }, [loadActiveShift, loadRecentSales]);

  useEffect(() => { if (products.length === 0) void refreshProducts(); }, [products.length, refreshProducts]);

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && filteredProducts[0]) addToCart(filteredProducts[0]);
  };

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    if (!val) setSelectedLetter(null);
  };

  const removeFromCart = useCallback((cartItemKey: string) => {
    setCart((currentCart) => currentCart.filter((item) => getCartItemKey(item) !== cartItemKey));
  }, [getCartItemKey]);

  const updateQuantity = useCallback((cartItemKey: string, delta: number) => {
    setCart((curr) => curr.map((item) => getCartItemKey(item) === cartItemKey ? { ...item, quantity: Math.max(1, Math.min(item.totalStock, item.quantity + delta)) } : item));
  }, [getCartItemKey]);

  const togglePrescription = (cartItemKey: string) => {
    setCart(curr => curr.map(item => getCartItemKey(item) === cartItemKey ? { ...item, prescriptionPresented: !item.prescriptionPresented } : item));
  };

  const handleComplete = async () => {
    if (cart.length === 0) return;
    const rxMissing = cart.find(it => it.prescription && !it.prescriptionPresented);
    if (rxMissing) return setError(`Для "${rxMissing.name}" нужен рецепт`);
    if (paymentType === 'CREDIT' && !customerId) return setError('Выберите клиента');
    if (!activeShift) return setError('Откройте смену');

    setProcessing(true);
    try {
      await processTransaction({
        items: cart.map((item) => ({ 
          productId: item.id, 
          batchId: item.batchId,
          quantity: item.quantity, 
          sellingPrice: item.sellingPrice,
          prescriptionPresented: item.prescriptionPresented,
        })),
        discountAmount: 0,
        taxAmount: 0,
        total,
        paymentType,
        customerName: paymentType === 'CREDIT' ? getCustomerNameById(customerId) : undefined,
        paidAmount: paymentType === 'CREDIT' ? Number(paidAmount) : total,
        userId: user?.id || '',
        date: new Date(),
      });
      setSuccess(true);
      setCart([]);
      setCustomerId('');
      setPaidAmount(0);
    } catch (err: any) {
      setError(err.message || 'Ошибка');
    } finally {
      setProcessing(false);
    }
  };

  // Для поиска имени клиента по id
  const getCustomerNameById = (id: string) => customers.find(c => c.id === id)?.name || '';

  return (
    <>
      <div className="grid w-full grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4 h-[calc(100vh-12rem)] animate-in fade-in duration-500 font-normal">
        <div className="bg-white rounded-3xl shadow-xl border border-[#5A5A40]/5 flex flex-col overflow-hidden min-w-0 h-full">
          <div className="p-5 border-b border-[#5A5A40]/5 flex flex-col gap-4 shrink-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5A5A40]/30 group-focus-within:text-[#5A5A40] transition-colors" size={18} />
                <input ref={searchInputRef} type="text" value={searchTerm} onChange={(e) => handleSearchChange(e.target.value)} onKeyDown={handleSearchKeyDown} placeholder="Поиск товара..." className="w-full pl-12 pr-4 py-3 bg-[#f5f5f0]/50 border-none rounded-2xl focus:ring-2 focus:ring-[#5A5A40]/20 transition-all text-sm outline-none" />
              </div>
            </div>

            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] text-[#5A5A40]/30 uppercase tracking-[0.2em]">Найдено: {filteredProducts.length}</span>
            </div>
          </div>
          <ProductCatalog filteredProducts={filteredProducts} onAddToCart={addToCart} />
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-[#5A5A40]/5 flex flex-col overflow-hidden min-w-0">
          <div className="p-4 border-b border-[#5A5A40]/5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <ShoppingCart size={17} className="text-[#5A5A40]/40" />
              <h3 className="text-sm font-normal text-[#151619]">Заказ</h3>
            </div>
            <span className="bg-[#f5f5f0] text-[#5A5A40]/40 text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wider">{cart.length} поз.</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
            {cart.length > 0 ? (
              cart.map((item) => {
                const cartItemKey = getCartItemKey(item);
                return (
                  <div key={cartItemKey} className="p-2.5 bg-[#f5f5f0]/50 rounded-2xl border border-[#5A5A40]/5 group space-y-1.5">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                           <h4 className="text-[12px] font-normal text-[#151619] truncate leading-tight">{item.name}</h4>
                           {item.batches?.some(b => new Date(b.expiryDate).getTime() < Date.now()) && (
                              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" title="В составе есть просроченные партии!" />
                           )}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.countryOfOrigin && (
                             <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-[#5A5A40]/5 text-[#5A5A40]/40 border border-[#5A5A40]/10 uppercase tracking-widest font-normal">{item.countryOfOrigin}</span>
                          )}
                          {item.prescription && (
                             <button onClick={() => togglePrescription(cartItemKey)} className={`text-[8px] px-1.5 py-0.5 rounded-full uppercase tracking-tighter border transition-colors ${item.prescriptionPresented ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-red-50 border-red-100 text-red-500'}`}>{item.prescriptionPresented ? 'Рецепт OK' : 'Нужен рецепт'}</button>
                          )}
                          {item.batches?.some(b => {
                             const days = Math.ceil((new Date(b.expiryDate).getTime() - Date.now()) / (1000*60*60*24));
                             return days > 0 && days <= 30;
                          }) && (
                             <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-100 uppercase tracking-tighter font-bold">Срок поджимает</span>
                          )}
                        </div>
                        <p className="text-[10px] text-[#5A5A40]/40 mt-1">{item.sellingPrice.toFixed(2)} TJS</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <p className="text-[12px] font-normal text-[#151619] tabular-nums">{(item.sellingPrice * item.quantity).toFixed(2)}</p>
                        <button onClick={() => removeFromCart(cartItemKey)} className="p-1 text-[#5A5A40]/20 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQuantity(cartItemKey, -1)} className="w-5 h-5 bg-white rounded-md flex items-center justify-center text-[#5A5A40]/40 hover:bg-[#5A5A40] hover:text-white transition-all shadow-sm"><Minus size={11} /></button>
                      <span className="text-[11px] font-normal tabular-nums min-w-8 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(cartItemKey, 1)} className="w-5 h-5 bg-white rounded-md flex items-center justify-center text-[#5A5A40]/40 hover:bg-[#5A5A40] hover:text-white transition-all shadow-sm"><Plus size={11} /></button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-[#5A5A40]/20 text-center p-6 italic">
                <ShoppingCart size={32} className="mb-2" />
                <p className="text-[12px]">Пусто</p>
              </div>
            )}
          </div>

          <div className="p-4 bg-[#f5f5f0]/50 border-t border-[#5A5A40]/5 space-y-3 shrink-0">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-[#5A5A40]/40">
                <span>Итог</span>
                <span className="tabular-nums">{subtotal.toFixed(2)} TJS</span>
              </div>
              <div className="flex justify-between text-xl font-normal text-[#151619] pt-1.5 border-t border-[#5A5A40]/5">
                <span className="tracking-tight text-sm text-[#5A5A40]/40">К оплате</span>
                <span className="tabular-nums">{total.toFixed(2)} TJS</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setPaymentType('CASH')} className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] transition-all uppercase tracking-widest ${paymentType === 'CASH' ? 'bg-[#5A5A40] text-white' : 'bg-white text-[#5A5A40]/40 border border-[#5A5A40]/10'}`}><Wallet size={12} /> Нал</button>
              <button onClick={() => setPaymentType('CARD')} className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] transition-all uppercase tracking-widest ${paymentType === 'CARD' ? 'bg-[#5A5A40] text-white' : 'bg-white text-[#5A5A40]/40 border border-[#5A5A40]/10'}`}><CreditCard size={12} /> Карта</button>
              <button onClick={() => setPaymentType('CREDIT')} className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] transition-all uppercase tracking-widest shadow-sm ${paymentType === 'CREDIT' ? 'bg-amber-600 text-white' : 'bg-white text-amber-600 border border-amber-100'}`}><User size={12} /> Долг</button>
            </div>

            {paymentType === 'CREDIT' && (
              <div className="space-y-2.5 animate-in fade-in zoom-in duration-300">
                <div className="flex gap-2">
                  <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-[#5A5A40]/10 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#5A5A40]/5">
                    <option value="">Выберите клиента...</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button type="button" onClick={() => setShowAddCustomer(true)} className="px-3 py-2 text-xs rounded-xl bg-[#5A5A40] text-white">+</button>
                </div>
                <input type="number" value={paidAmount || ''} onChange={(e) => setPaidAmount(Number(e.target.value))} placeholder="Внесено (0.00)" className="w-full px-4 py-3 bg-[#f5f5f0]/30 border border-[#5A5A40]/10 rounded-xl text-sm font-normal text-[#151619] outline-none tabular-nums" />
                {showAddCustomer && (
                  <div className="mt-2 p-3 bg-[#f5f5f0]/80 rounded-xl border border-[#5A5A40]/10">
                    <input type="text" value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} placeholder="Имя нового клиента" className="w-full px-3 py-2 rounded-lg border border-[#5A5A40]/20 text-xs mb-2" />
                    <div className="flex gap-2">
                      <button type="button" onClick={async () => {
                        if (!newCustomerName.trim()) return;
                        try {
                          const created = await createCustomer({ name: newCustomerName });
                          setCustomerId(created.id);
                          setShowAddCustomer(false);
                          setNewCustomerName('');
                        } catch (err) {
                          setError('Ошибка создания клиента');
                        }
                      }} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs">Сохранить</button>
                      <button type="button" onClick={() => { setShowAddCustomer(false); setNewCustomerName(''); }} className="px-3 py-2 rounded-xl bg-[#5A5A40]/10 text-[#5A5A40] text-xs">Отмена</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && <div className="p-3 bg-red-50 text-red-500 text-[10px] rounded-xl border border-red-100 leading-tight">{error}</div>}
            {success && <div className="p-3 bg-emerald-50 text-emerald-600 text-[10px] rounded-xl border border-emerald-100">Успешно!</div>}

            <button onClick={handleComplete} disabled={cart.length === 0 || processing || !activeShift} className="w-full bg-[#5A5A40] text-white py-3.5 rounded-2xl text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-[#4A4A30] active:scale-[0.98] transition-all disabled:opacity-30 disabled:grayscale">
              {processing ? '...' : 'Оплатить'}
            </button>
          </div>
        </div>
      </div>

      <OpenShiftModal open={isOpenShiftModal} onClose={() => setIsOpenShiftModal(false)} onOpened={() => void loadActiveShift()} />
      {activeShift && <CloseShiftModal shiftId={activeShift.id} open={isCloseShiftModal} onClose={() => setIsCloseShiftModal(false)} onClosed={(r) => { if (r) { saveLatestClosedShiftNotice(r); setClosedShiftSummary(r); } void loadActiveShift(); }} />}
    </>
  );
};

export default POSView;
