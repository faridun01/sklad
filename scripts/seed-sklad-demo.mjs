import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const demoProducts = [
  { sku: 'POW-ARIEL-6KG', barcode: '4780010000011', name: 'Стиральный порошок Ariel 6 кг', category: 'Стиральные порошки', manufacturer: 'P&G', costPrice: 89000, sellingPrice: 112000, quantity: 60 },
  { sku: 'POW-PERSIL-3KG', barcode: '4780010000012', name: 'Стиральный порошок Persil 3 кг', category: 'Стиральные порошки', manufacturer: 'Henkel', costPrice: 54000, sellingPrice: 69000, quantity: 80 },
  { sku: 'DISH-FAIRY-900', barcode: '4780010000013', name: 'Гель для посуды Fairy 900 мл', category: 'Гели для посуды', manufacturer: 'P&G', costPrice: 18500, sellingPrice: 25000, quantity: 140 },
  { sku: 'DISH-SORTI-1L', barcode: '4780010000014', name: 'Гель для посуды Sorti 1 л', category: 'Гели для посуды', manufacturer: 'Невская косметика', costPrice: 12000, sellingPrice: 17500, quantity: 120 },
];

const demoCustomers = [
  { code: 'CL-001', name: 'Мунира Исломова', phone: '+998901111111', address: 'Ташкент, Юнусабад', creditLimit: 1200000, defaultDiscount: 0, paymentTermDays: 14 },
  { code: 'CL-002', name: 'Азиз Сафаров', phone: '+998902222222', address: 'Ташкент, Чиланзар', creditLimit: 900000, defaultDiscount: 3, paymentTermDays: 10 },
  { code: 'CL-003', name: 'Магазин "Чистый Дом"', legalName: 'ООО Чистый Дом', phone: '+998903333333', address: 'Ташкент, Сергели', creditLimit: 5000000, defaultDiscount: 5, paymentTermDays: 21 },
];

async function upsertLookup(modelDelegate, where, createData) {
  const existing = await modelDelegate.findFirst({ where });
  if (existing) {
    return modelDelegate.update({ where: { id: existing.id }, data: createData });
  }
  return modelDelegate.create({ data: createData });
}

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 10);

  const owner = await prisma.user.upsert({
    where: { email: 'admin@sklad.local' },
    update: { name: 'Администратор склада', role: 'ADMIN', isActive: true, username: 'admin' },
    create: {
      email: 'admin@sklad.local',
      username: 'admin',
      password: passwordHash,
      name: 'Администратор склада',
      role: 'ADMIN',
      isActive: true,
    },
  });

  const warehouse = await prisma.warehouse.upsert({
    where: { code: 'MAIN' },
    update: { name: 'Основной склад', isDefault: true, isActive: true, address: 'Ташкент, основной склад', type: 'STORE' },
    create: { code: 'MAIN', name: 'Основной склад', isDefault: true, isActive: true, address: 'Ташкент, основной склад', type: 'STORE' },
  });

  const existingSupplier = await prisma.supplier.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
  const supplier = existingSupplier
    ? await prisma.supplier.update({
        where: { id: existingSupplier.id },
        data: {
          name: 'Основной поставщик',
          contact: '+998900000000',
          email: 'supplier@sklad.local',
          address: 'Ташкент, склад поставщика',
          contractNumber: 'SKLAD-SUP-2026-01',
          contractDate: new Date('2026-01-10'),
          paymentTermDays: 15,
          isActive: true,
        },
      })
    : await prisma.supplier.create({
        data: {
          name: 'Основной поставщик',
          contact: '+998900000000',
          email: 'supplier@sklad.local',
          address: 'Ташкент, склад поставщика',
          contractNumber: 'SKLAD-SUP-2026-01',
          contractDate: new Date('2026-01-10'),
          paymentTermDays: 15,
          isActive: true,
        },
      });

  await prisma.supplier.updateMany({
    where: { isActive: true, NOT: { id: supplier.id } },
    data: { isActive: false },
  });

  const createdProducts = [];

  for (const item of demoProducts) {
    const category = await upsertLookup(prisma.productCategory, { name: item.category }, { name: item.category });
    const manufacturer = await upsertLookup(prisma.manufacturer, { name: item.manufacturer }, { name: item.manufacturer, isActive: true });
    const packageType = await upsertLookup(prisma.packageType, { name: 'Упаковка' }, { name: 'Упаковка' });

    const product = await prisma.product.upsert({
      where: { sku: item.sku },
      update: {
        name: item.name,
        barcode: item.barcode,
        category: item.category,
        categoryId: category.id,
        manufacturer: item.manufacturer,
        manufacturerId: manufacturer.id,
        packageTypeId: packageType.id,
        minStock: 10,
        costPrice: item.costPrice,
        sellingPrice: item.sellingPrice,
        isActive: true,
        status: 'ACTIVE',
        prescription: false,
        markingRequired: false,
      },
      create: {
        sku: item.sku,
        barcode: item.barcode,
        name: item.name,
        category: item.category,
        categoryId: category.id,
        manufacturer: item.manufacturer,
        manufacturerId: manufacturer.id,
        packageTypeId: packageType.id,
        minStock: 10,
        totalStock: item.quantity,
        costPrice: item.costPrice,
        sellingPrice: item.sellingPrice,
        isActive: true,
        status: 'ACTIVE',
        prescription: false,
        markingRequired: false,
      },
    });

    await prisma.batch.upsert({
      where: { id: `${item.sku}-demo-batch` },
      update: {
        quantity: item.quantity,
        initialQty: item.quantity,
        currentQty: item.quantity,
        availableQty: item.quantity,
        reservedQty: 0,
        costBasis: item.costPrice,
        purchasePrice: item.costPrice,
        retailPrice: item.sellingPrice,
        warehouseId: warehouse.id,
        supplierId: supplier.id,
        manufacturedDate: new Date('2026-01-01'),
        receivedAt: new Date('2026-04-01'),
        expiryDate: new Date('2028-12-31'),
      },
      create: {
        id: `${item.sku}-demo-batch`,
        productId: product.id,
        warehouseId: warehouse.id,
        supplierId: supplier.id,
        batchNumber: `${item.sku}-DEMO`,
        quantity: item.quantity,
        initialQty: item.quantity,
        currentQty: item.quantity,
        reservedQty: 0,
        availableQty: item.quantity,
        unit: 'шт',
        costBasis: item.costPrice,
        purchasePrice: item.costPrice,
        retailPrice: item.sellingPrice,
        manufacturedDate: new Date('2026-01-01'),
        receivedAt: new Date('2026-04-01'),
        expiryDate: new Date('2028-12-31'),
        status: 'STABLE',
      },
    });

    await prisma.warehouseStock.upsert({
      where: { warehouseId_productId: { warehouseId: warehouse.id, productId: product.id } },
      update: { quantity: item.quantity },
      create: { warehouseId: warehouse.id, productId: product.id, quantity: item.quantity },
    });

    await prisma.product.update({ where: { id: product.id }, data: { totalStock: item.quantity } });
    createdProducts.push({ ...product, ...item });
  }

  for (const customer of demoCustomers) {
    await prisma.customer.upsert({
      where: { code: customer.code },
      update: {
        name: customer.name,
        legalName: customer.legalName || null,
        phone: customer.phone || null,
        address: customer.address || null,
        creditLimit: customer.creditLimit,
        defaultDiscount: customer.defaultDiscount,
        paymentTermDays: customer.paymentTermDays,
        isActive: true,
      },
      create: {
        code: customer.code,
        name: customer.name,
        legalName: customer.legalName || null,
        phone: customer.phone || null,
        address: customer.address || null,
        creditLimit: customer.creditLimit,
        defaultDiscount: customer.defaultDiscount,
        paymentTermDays: customer.paymentTermDays,
        isActive: true,
      },
    });
  }

  const purchaseInvoice = await prisma.purchaseInvoice.upsert({
    where: { invoiceNumber: 'SK-PINV-0001' },
    update: {
      supplierId: supplier.id,
      warehouseId: warehouse.id,
      status: 'POSTED',
      paymentStatus: 'PARTIALLY_PAID',
      totalAmount: createdProducts.reduce((sum, item) => sum + item.costPrice * 20, 0),
      createdById: owner.id,
    },
    create: {
      invoiceNumber: 'SK-PINV-0001',
      supplierId: supplier.id,
      warehouseId: warehouse.id,
      invoiceDate: new Date('2026-04-01'),
      status: 'POSTED',
      paymentStatus: 'PARTIALLY_PAID',
      totalAmount: createdProducts.reduce((sum, item) => sum + item.costPrice * 20, 0),
      createdById: owner.id,
    },
  });

  for (const [index, product] of createdProducts.entries()) {
    await prisma.purchaseInvoiceItem.upsert({
      where: { id: `sklad-purchase-item-${index + 1}` },
      update: {
        purchaseInvoiceId: purchaseInvoice.id,
        productId: product.id,
        quantity: 20,
        purchasePrice: product.costPrice,
        retailPrice: product.sellingPrice,
        lineTotal: product.costPrice * 20,
      },
      create: {
        id: `sklad-purchase-item-${index + 1}`,
        purchaseInvoiceId: purchaseInvoice.id,
        productId: product.id,
        batchNumber: `${product.sku}-PINV-${index + 1}`,
        manufacturedDate: new Date('2026-01-01'),
        expiryDate: new Date('2028-12-31'),
        quantity: 20,
        purchasePrice: product.costPrice,
        retailPrice: product.sellingPrice,
        lineTotal: product.costPrice * 20,
      },
    });
  }

  const customer = await prisma.customer.findUnique({ where: { code: 'CL-003' } });
  if (customer) {
    await prisma.receivable.upsert({
      where: { id: 'sklad-receivable-001' },
      update: {
        customerId: customer.id,
        customerName: customer.name,
        originalAmount: 1750000,
        paidAmount: 450000,
        remainingAmount: 1300000,
        dueDate: new Date('2026-04-28'),
        status: 'PARTIAL',
      },
      create: {
        id: 'sklad-receivable-001',
        customerId: customer.id,
        customerName: customer.name,
        originalAmount: 1750000,
        paidAmount: 450000,
        remainingAmount: 1300000,
        dueDate: new Date('2026-04-28'),
        status: 'PARTIAL',
      },
    });

    await prisma.payment.upsert({
      where: { id: 'sklad-payment-in-001' },
      update: {
        direction: 'IN',
        counterpartyType: 'CUSTOMER',
        customerId: customer.id,
        method: 'BANK_TRANSFER',
        amount: 450000,
        paymentDate: new Date('2026-04-08'),
        status: 'PAID',
        referenceNumber: 'SK-PAY-IN-001',
        createdById: owner.id,
        comment: 'Частичная оплата клиента по долгу',
      },
      create: {
        id: 'sklad-payment-in-001',
        direction: 'IN',
        counterpartyType: 'CUSTOMER',
        customerId: customer.id,
        method: 'BANK_TRANSFER',
        amount: 450000,
        paymentDate: new Date('2026-04-08'),
        status: 'PAID',
        referenceNumber: 'SK-PAY-IN-001',
        createdById: owner.id,
        comment: 'Частичная оплата клиента по долгу',
      },
    });
  }

  await prisma.payable.upsert({
    where: { id: 'sklad-payable-001' },
    update: {
      supplierId: supplier.id,
      purchaseInvoiceId: purchaseInvoice.id,
      originalAmount: purchaseInvoice.totalAmount,
      paidAmount: purchaseInvoice.totalAmount / 2,
      remainingAmount: purchaseInvoice.totalAmount / 2,
      dueDate: new Date('2026-04-25'),
      status: 'PARTIAL',
    },
    create: {
      id: 'sklad-payable-001',
      supplierId: supplier.id,
      purchaseInvoiceId: purchaseInvoice.id,
      originalAmount: purchaseInvoice.totalAmount,
      paidAmount: purchaseInvoice.totalAmount / 2,
      remainingAmount: purchaseInvoice.totalAmount / 2,
      dueDate: new Date('2026-04-25'),
      status: 'PARTIAL',
    },
  });

  await prisma.payment.upsert({
    where: { id: 'sklad-payment-out-001' },
    update: {
      direction: 'OUT',
      counterpartyType: 'SUPPLIER',
      supplierId: supplier.id,
      purchaseInvoiceId: purchaseInvoice.id,
      method: 'BANK_TRANSFER',
      amount: purchaseInvoice.totalAmount / 2,
      paymentDate: new Date('2026-04-09'),
      status: 'PAID',
      referenceNumber: 'SK-PAY-OUT-001',
      createdById: owner.id,
      comment: 'Частичная оплата поставщику',
    },
    create: {
      id: 'sklad-payment-out-001',
      direction: 'OUT',
      counterpartyType: 'SUPPLIER',
      supplierId: supplier.id,
      purchaseInvoiceId: purchaseInvoice.id,
      method: 'BANK_TRANSFER',
      amount: purchaseInvoice.totalAmount / 2,
      paymentDate: new Date('2026-04-09'),
      status: 'PAID',
      referenceNumber: 'SK-PAY-OUT-001',
      createdById: owner.id,
      comment: 'Частичная оплата поставщику',
    },
  });

  console.log(JSON.stringify({
    ok: true,
    userEmail: owner.email,
    warehouseCode: warehouse.code,
    supplierId: supplier.id,
    products: createdProducts.length,
    customers: demoCustomers.length,
    purchaseInvoice: purchaseInvoice.invoiceNumber,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
