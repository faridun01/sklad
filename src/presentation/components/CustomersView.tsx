import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { 
  Search, Plus, Phone, MapPin, Edit3, Trash2, 
  Package, X, CalendarClock, ChevronRight, LayoutGrid, Info, CreditCard,
  AlertTriangle, RefreshCw, User
} from 'lucide-react';
import { buildApiHeaders } from '../../infrastructure/api';
import { useDebounce } from '../../lib/useDebounce';

type CustomerRecord = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  creditLimit?: number;
  totalDebt: number;
  invoiceCount: number;
};

type CustomerInvoiceSummary = {
  id: string;
  invoiceNo: string;
  createdAt: string;
  totalAmount: number;
  paymentStatus: string;
  paymentType: string;
};

type CustomerReceivable = {
  id: string;
  originalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  dueDate: string | null;
  createdAt: string;
};

type CustomerPayment = {
  id: string;
  amount: number;
  method: string;
  paymentDate: string;
  direction: string;
  comment?: string | null;
};

type CustomerOverview = {
  invoices: CustomerInvoiceSummary[];
  receivables: CustomerReceivable[];
  payments: CustomerPayment[];
};

type CustomerForm = {
  name: string;
  phone: string;
  email: string;
  address: string;
};

const INITIAL_FORM: CustomerForm = {
  name: '',
  phone: '',
  email: '',
  address: '',
};

const formatMoney = (value: number) => `${Number(value || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TJS`;

export const CustomersView: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [customerStats, setCustomerStats] = useState<Record<string, CustomerOverview>>({});
  const [openCustomerId, setOpenCustomerId] = useState<string | null>(null);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [initialLoadPending, setInitialLoadPending] = useState(true);
  const [detailLoading, setDetailLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState<CustomerForm>(INITIAL_FORM);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 250);

  const request = useCallback(async (url: string, init?: RequestInit) => {
    const response = await fetch(url, {
      ...init,
      headers: {
        ...(await buildApiHeaders()),
        ...(init?.headers || {}),
      },
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || payload?.message || 'Ошибка запроса');
    }
    return payload;
  }, []);

  const loadCustomers = useCallback(async () => {
    setInitialLoadPending(true);
    try {
      const data = await request('/api/customers?limit=100');
      if (data && Array.isArray(data.items)) {
        setCustomers(data.items);
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки клиентов');
    } finally {
      setInitialLoadPending(false);
    }
  }, [request]);

  const loadCustomerDetails = useCallback(async (customerId: string, force = false) => {
    if (!force && customerStats[customerId]?.invoices) return;
    setDetailLoading(customerId);
    try {
      const details = await request(`/api/customers/${customerId}`);
      setCustomerStats((prev) => ({ ...prev, [customerId]: details }));
    } catch (err: any) {
      console.error('Failed to load customer details:', err);
    } finally {
      setDetailLoading(null);
    }
  }, [request, customerStats]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  useEffect(() => {
    if (openCustomerId) {
      void loadCustomerDetails(openCustomerId);
    }
  }, [openCustomerId, loadCustomerDetails]);

  const filteredCustomers = useMemo(() => customers.filter((customer) => {
    const query = debouncedSearchTerm.trim().toLocaleLowerCase('ru-RU');
    if (!query) return true;
    return [customer.name, customer.phone, customer.address, customer.email]
      .some((value) => String(value || '').toLocaleLowerCase('ru-RU').includes(query));
  }), [customers, debouncedSearchTerm]);

  const selectedCustomer = openCustomerId ? customers.find((s) => s.id === openCustomerId) || null : null;
  const selectedStats = openCustomerId ? customerStats[openCustomerId] : null;

  const totalDebt = customers.reduce((sum, c) => sum + (c.totalDebt || 0), 0);
  const totalInvoices = customers.reduce((sum, c) => sum + (c.invoiceCount || 0), 0);

  const saveCustomer = async () => {
    if (!form.name.trim()) return setError('Имя клиента обязательно');
    setSubmitting(true);
    try {
      await request(editingCustomerId ? `/api/customers/${editingCustomerId}` : '/api/customers', {
        method: editingCustomerId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          address: form.address.trim() || null,
        }),
      });
      await loadCustomers();
      setIsAddOpen(false);
    } catch (err: any) {
      setError(err.message || 'Ошибка сохранения клиента');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteCustomer = async (customerId: string) => {
    setSubmitting(true);
    try {
      await request(`/api/customers/${customerId}`, { method: 'DELETE' });
      setCustomerStats((p) => { const n = {...p}; delete n[customerId]; return n; });
      if (openCustomerId === customerId) setOpenCustomerId(null);
      await loadCustomers();
    } catch (err: any) {
      setError(err.message || 'Ошибка удаления клиента');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-400 mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
      {/* Header Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Всего клиентов', val: customers.length, sub: 'Активных', color: 'text-[#5A5A40]' },
          { label: 'Общий долг', val: formatMoney(totalDebt), sub: 'По всем клиентам', color: 'text-red-500' },
          { label: 'Кол-во продаж', val: totalInvoices, sub: 'Привязанных чеков', color: 'text-[#5A5A40]' },
        ].map((card, idx) => (
          <div key={idx} className="bg-white/40 border border-[#5A5A40]/5 rounded-4xl p-6 shadow-sm hover:shadow-xl hover:shadow-[#5A5A40]/5 transition-all group">
            <p className="text-[10px] font-normal text-[#5A5A40]/40 uppercase tracking-[0.2em] mb-1">{card.label}</p>
            <p className={`text-2xl font-normal ${card.color} tracking-tight group-hover:tracking-tighter transition-all`}>{card.val}</p>
            <p className="text-[10px] font-normal text-[#5A5A40]/30 mt-2 italic">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-white/80 backdrop-blur-md rounded-[2.5rem] border border-white/70 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-2xl bg-[#5A5A40]/5 flex items-center justify-center text-[#5A5A40]/40">
            <User size={20} />
          </div>
          <div>
            <h4 className="text-sm font-normal text-[#151619]">База клиентов</h4>
            <p className="text-[10px] text-[#5A5A40]/50 uppercase tracking-widest">Управление покупателями</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5A5A40]/30 group-focus-within:text-[#5A5A40] transition-colors" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Поиск клиентов..."
              className="w-full sm:w-72 pl-11 pr-4 py-3 bg-white/50 border border-[#5A5A40]/10 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-[#5A5A40]/10 focus:bg-white transition-all font-normal placeholder:text-[#5A5A40]/30"
            />
          </div>
          <button onClick={() => { setForm(INITIAL_FORM); setEditingCustomerId(null); setIsAddOpen(true); }} className="bg-[#5A5A40] text-white px-6 py-3 rounded-2xl font-normal shadow-lg shadow-[#5A5A40]/10 hover:bg-[#4A4A30] active:scale-95 transition-all flex items-center justify-center gap-2">
            <Plus size={18} />
            <span>Новый клиент</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-xs flex items-center gap-3">
          <Info size={14} /> {error}
        </div>
      )}

      {/* Grid of Customer Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {initialLoadPending ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 bg-white/40 border border-[#5A5A40]/5 rounded-4xl animate-pulse" />
          ))
        ) : filteredCustomers.length === 0 ? (
          <div className="col-span-full py-24 text-center">
            <div className="w-20 h-20 bg-[#5A5A40]/5 rounded-4xl mx-auto flex items-center justify-center text-[#5A5A40]/20 mb-4">
              <User size={40} />
            </div>
            <p className="text-sm text-[#5A5A40]/40 font-normal italic">Список пуст</p>
          </div>
        ) : (
          filteredCustomers.map((s) => {
            const hasDebt = (s.totalDebt || 0) > 0;
            return (
              <div
                key={s.id}
                onClick={() => setOpenCustomerId(s.id)}
                className="group bg-white/40 hover:bg-white border border-[#5A5A40]/5 rounded-4xl p-6 transition-all hover:shadow-2xl hover:shadow-[#5A5A40]/5 cursor-pointer flex flex-col h-full"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 rounded-3xl bg-[#f5f5f0] flex items-center justify-center text-[#5A5A40]/30 group-hover:bg-[#5A5A40] group-hover:text-white transition-all shadow-inner">
                    <User size={28} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); setForm({ name: s.name, phone: s.phone || '', email: s.email || '', address: s.address || '' }); setEditingCustomerId(s.id); setIsAddOpen(true); }}
                      className="p-2.5 text-[#5A5A40]/30 hover:text-[#5A5A40] hover:bg-[#f5f5f0] rounded-xl transition-all"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: s.id, name: s.name }); }}
                      className="p-2.5 text-[#5A5A40]/30 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex-1">
                  <h3 className="text-lg font-normal text-[#151619] tracking-tight group-hover:text-[#5A5A40] transition-colors">{s.name}</h3>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <MapPin size={12} className="text-[#5A5A40]/30" />
                    <p className="text-[10px] text-[#5A5A40]/50 font-normal truncate uppercase tracking-widest">
                      {s.address || 'Адрес не указан'}
                    </p>
                  </div>

                  <div className="mt-6 space-y-2.5">
                    <div className="flex items-center gap-3 p-2.5 bg-white/50 rounded-2xl border border-[#5A5A40]/5 group-hover:border-[#5A5A40]/10 transition-all font-normal">
                      <Phone size={14} className="text-[#5A5A40]/20" />
                      <span className="text-xs text-[#5A5A40]/70">{s.phone || '—'}</span>
                    </div>

                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-[#5A5A40]/5 grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[9px] uppercase tracking-widest text-[#5A5A40]/30 font-normal">Чеков</p>
                    <p className="text-sm font-normal text-[#151619]">{s.invoiceCount || 0}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-[9px] uppercase tracking-widest text-[#5A5A40]/30 font-normal">Долг</p>
                    <p className={`text-sm font-normal ${hasDebt ? 'text-red-500' : 'text-emerald-600'}`}>
                      {formatMoney(s.totalDebt || 0)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Details Modal */}
      {openCustomerId && selectedCustomer && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-[#151619]/60 backdrop-blur-xl p-4 animate-in fade-in zoom-in duration-300">
          <div className="bg-[#f8f7f2] rounded-[3rem] shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden border border-white/20 relative">
            
            {/* Modal Header */}
            <div className="p-8 pb-4 flex items-center justify-between z-20">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-4xl bg-[#5A5A40] text-white flex items-center justify-center shadow-lg shadow-[#5A5A40]/20 transition-transform active:scale-95 cursor-pointer" onClick={() => void loadCustomerDetails(openCustomerId, true)}>
                  {detailLoading ? <RefreshCw size={28} className="animate-spin" /> : <User size={32} />}
                </div>
                <div>
                  <h3 className="text-2xl font-normal text-[#151619] tracking-tight">{selectedCustomer.name}</h3>
                  <p className="text-[10px] uppercase tracking-widest text-[#5A5A40]/50 mt-1 font-normal">Карточка клиента</p>
                </div>
              </div>
              <button onClick={() => setOpenCustomerId(null)} className="w-12 h-12 rounded-full border border-[#5A5A40]/10 flex items-center justify-center text-[#5A5A40]/40 hover:bg-white hover:text-[#5A5A40] transition-all">
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-8 pt-4 space-y-10 relative z-10 custom-scrollbar">
              
              {/* Internal Loader overlay */}
              {detailLoading && !selectedStats?.invoices && (
                <div className="absolute inset-0 bg-[#f8f7f2]/50 backdrop-blur-[2px] z-30 flex flex-col items-center justify-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#5A5A40]/30 mb-4" />
                  <p className="text-[10px] uppercase tracking-[0.3em] text-[#5A5A40]/40 font-normal">Синхронизация данных...</p>
                </div>
              )}

              {/* Stats Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Покупок', val: selectedCustomer.invoiceCount, icon: <Package size={16}/>, color: 'text-[#5A5A40]' },
                  { label: 'Текущий долг', val: formatMoney(selectedCustomer.totalDebt), icon: <CreditCard size={16}/>, color: 'text-red-500' },
                ].map((s, i) => (
                  <div key={i} className="bg-white border border-[#5A5A40]/5 rounded-4xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-3 opacity-30">
                      {s.icon} <span className="text-[9px] uppercase tracking-widest font-normal">{s.label}</span>
                    </div>
                    <p className={`text-xl font-normal ${s.color} tracking-tight`}>{s.val}</p>
                  </div>
                ))}
              </div>

              {/* Invoices Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h4 className="text-sm font-normal text-[#151619] tracking-tight">История покупок (чеки)</h4>
                  <span className="text-[9px] uppercase tracking-widest text-[#5A5A40]/30 font-normal italic">Последние 20 записей</span>
                </div>
                <div className="bg-white rounded-4xl border border-[#5A5A40]/10 overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#f5f5f0]/50 text-[10px] uppercase tracking-widest text-[#5A5A40]/40 border-b border-[#5A5A40]/5">
                        <th className="px-6 py-4 text-left font-normal">Номер</th>
                        <th className="px-6 py-4 text-left font-normal">Дата</th>
                        <th className="px-6 py-4 text-left font-normal">Оплата</th>
                        <th className="px-6 py-4 text-right font-normal">Сумма</th>
                        <th className="px-6 py-4 text-center font-normal">Статус</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#5A5A40]/5">
                      {(selectedStats?.invoices || []).map((inv) => (
                          <tr key={inv.id} className="hover:bg-[#f5f5f0]/30 transition-all">
                            <td className="px-6 py-5 font-normal text-[#151619]">
                              <div className="flex items-center gap-3">
                                <span>{inv.invoiceNo}</span>
                              </div>
                            </td>
                            <td className="px-6 py-5 text-[#5A5A40]/60 font-normal">{new Date(inv.createdAt).toLocaleString('ru-RU')}</td>
                            <td className="px-6 py-5 text-[#5A5A40]/60 font-normal text-xs">{inv.paymentType}</td>
                            <td className="px-6 py-5 text-right font-normal">{formatMoney(inv.totalAmount)}</td>
                            <td className="px-6 py-5 text-center">
                              <span className={`px-2.5 py-1 rounded-full text-[9px] uppercase tracking-widest font-normal border ${inv.paymentStatus === 'PAID' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                {inv.paymentStatus === 'PAID' ? 'Оплачен' : 'Долг'}
                              </span>
                            </td>
                          </tr>
                      ))}
                      {(!selectedStats?.invoices || selectedStats.invoices.length === 0) && (
                        <tr><td colSpan={5} className="py-12 text-center text-[#5A5A40]/30 font-normal italic uppercase tracking-tighter">Накопленных покупок нет</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-[#151619]/60 backdrop-blur-xl p-4 animate-in fade-in zoom-in duration-300">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden border border-[#5A5A40]/10">
            <div className="p-8 border-b border-[#5A5A40]/5 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-normal text-[#151619] tracking-tight">{editingCustomerId ? 'Обновление данных' : 'Новый клиент'}</h3>
                <p className="text-[10px] uppercase tracking-widest text-[#5A5A40]/50 mt-1 font-normal">Заполнение профиля</p>
              </div>
              <button onClick={() => setIsAddOpen(false)} className="w-10 h-10 rounded-full border border-[#5A5A40]/10 flex items-center justify-center text-[#5A5A40]/40 hover:bg-[#f5f5f0] transition-all">
                <X size={18} />
              </button>
            </div>
            <div className="p-8 space-y-5">
              {[
                { label: 'Имя клиента', val: form.name, key: 'name' },
                { label: 'Телефон', val: form.phone, key: 'phone' },
                { label: 'Email', val: form.email, key: 'email' },
                { label: 'Адрес', val: form.address, key: 'address' },
              ].map((f) => (
                <div key={f.key} className="space-y-1.5 focus-within:translate-x-1 transition-transform">
                  <label className="text-[9px] uppercase tracking-widest text-[#5A5A40]/40 font-normal px-1">{f.label}</label>
                  <input
                    className="w-full px-4 py-3.5 bg-[#f8f7f2] border border-transparent rounded-2xl text-sm font-normal outline-none focus:bg-white focus:border-[#5A5A40]/20 transition-all"
                    value={f.val}
                    onChange={(e) => setForm({...form, [f.key as keyof CustomerForm]: e.target.value})}
                  />
                </div>
              ))}
              {error && <p className="text-[10px] text-red-500 font-normal px-1">{error}</p>}
            </div>
            <div className="p-8 pt-0 flex gap-3">
              <button onClick={() => setIsAddOpen(false)} className="flex-1 py-4 border border-[#5A5A40]/10 rounded-2xl text-sm font-normal text-[#5A5A40]/40 hover:bg-[#f5f5f0] transition-all">Отмена</button>
              <button onClick={saveCustomer} disabled={submitting} className="flex-2 py-4 bg-[#5A5A40] text-white rounded-2xl text-sm font-normal hover:bg-[#4A4A30] active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-[#5A5A40]/20">{submitting ? '...' : 'Сохранить изменения'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-80 flex items-center justify-center bg-[#151619]/40 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-4xl shadow-2xl w-full max-w-sm overflow-hidden border border-red-50">
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-500 mx-auto mb-2 animate-bounce"><Trash2 size={30} /></div>
              <h3 className="text-xl font-normal text-[#151619] tracking-tight">Удалить клиента?</h3>
              <p className="text-xs text-[#5A5A40]/60 font-normal leading-relaxed">Вы уверены, что хотите удалить <span className="text-[#151619] font-normal underline decoration-red-200 underline-offset-4">{deleteTarget.name}</span>?</p>
              <div className="flex gap-3 pt-4 font-normal">
                <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3 text-sm text-[#5A5A40]/50 hover:bg-[#f5f5f0] rounded-2xl transition-all">Отмена</button>
                <button onClick={async () => { await deleteCustomer(deleteTarget.id); setDeleteTarget(null); }} className="flex-1 py-3 bg-red-500 text-white text-sm rounded-2xl hover:bg-red-600 transition-all shadow-lg shadow-red-200">Удалить</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomersView;
