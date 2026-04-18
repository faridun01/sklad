import { prisma } from '../infrastructure/prisma';

const PRIMARY_SUPPLIER_NAME = 'Основной поставщик';

export const ensurePrimarySupplier = async () => {
  const existing = await prisma.supplier.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  if (existing) {
    return existing;
  }

  return prisma.supplier.create({
    data: {
      name: PRIMARY_SUPPLIER_NAME,
      isActive: true,
    },
  });
};

export const findPrimarySupplier = async () => {
  return prisma.supplier.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });
};
