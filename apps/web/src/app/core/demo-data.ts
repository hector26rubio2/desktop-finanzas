/** All amounts are signed COP values. Fixtures never touch a remote service. */
export interface Movement {
  id: string;
  date: string;
  description: string;
  accountId: string;
  category: string;
  kind: 'income' | 'expense' | 'transfer' | 'payment';
  amount: number;
  status: 'confirmed' | 'pending';
  person?: string;
}

export interface Account {
  id: string;
  name: string;
  type: 'savings' | 'credit' | 'cash';
  currency: string;
  openingBalance: number;
  limit?: number;
  lastFour: string;
  color: string;
  cutDay?: number;
  dueDay?: number;
}

export interface Person { id: string; name: string; owed: number; owing: number }
export interface Investment { id: string; name: string; type: string; value: number; cost: number }
export interface DemoNotification { id: string; title: string; detail: string; read: boolean }
export interface DemoData {
  movements: Movement[];
  accounts: Account[];
  people: Person[];
  investments: Investment[];
  notifications: DemoNotification[];
}

export const demoUsers = [
  { id: 'demo-owner', name: 'Valentina Torres', email: 'valentina@example.test', capabilities: ['dashboard', 'movements', 'accounts', 'calendar', 'people', 'portfolio', 'planning', 'reports', 'notifications', 'administration', 'settings', 'movement.create', 'account.create', 'theme.customize'] },
  { id: 'demo-reviewer', name: 'Daniel Ríos', email: 'daniel@example.test', capabilities: ['dashboard', 'movements', 'accounts', 'calendar', 'reports', 'notifications', 'settings'] },
];

/** Pending authorizations are visible but do not change the posted balance. */
export function accountBalance(account: Account, movements: Movement[]): number {
  return account.openingBalance + movements.reduce((total, movement) =>
    total + (movement.accountId === account.id && movement.status === 'confirmed' ? movement.amount : 0), 0);
}

/** Twelve full calendar months, with repeatable values and balanced transfer/payment legs. */
export function createDemoData(): DemoData {
  const accounts: Account[] = [
    { id: 'savings-main', name: 'Ahorros principal', type: 'savings', currency: 'COP', openingBalance: 5200000, lastFour: '2048', color: '#0f766e' },
    { id: 'savings-goals', name: 'Ahorros para metas', type: 'savings', currency: 'COP', openingBalance: 2800000, lastFour: '9012', color: '#2563eb' },
    { id: 'credit-emerald', name: 'Visa Esmeralda', type: 'credit', currency: 'COP', openingBalance: -1450000, limit: 8000000, lastFour: '4821', color: '#047857', cutDay: 15, dueDay: 5 },
    { id: 'credit-indigo', name: 'Mastercard Índigo', type: 'credit', currency: 'COP', openingBalance: -780000, limit: 5000000, lastFour: '7506', color: '#4338ca', cutDay: 22, dueDay: 12 },
    { id: 'credit-copper', name: 'Visa Cobre', type: 'credit', currency: 'COP', openingBalance: -320000, limit: 3000000, lastFour: '1639', color: '#b45309', cutDay: 28, dueDay: 18 },
    { id: 'cash', name: 'Efectivo', type: 'cash', currency: 'COP', openingBalance: 240000, lastFour: '0000', color: '#64748b' },
  ];
  const movements: Movement[] = [];
  const add = (month: number, day: number, accountId: string, description: string, category: string, kind: Movement['kind'], amount: number, person?: string, status: Movement['status'] = 'confirmed') => {
    const date = new Date(Date.UTC(2025, 8 + month, day)).toISOString().slice(0, 10);
    movements.push({ id: `mov-${String(movements.length + 1).padStart(4, '0')}`, date, accountId, description, category, kind, amount, status, ...(person ? { person } : {}) });
  };
  for (let month = 0; month < 12; month++) {
    add(month, 1, 'savings-main', 'Nómina mensual', 'Salario', 'income', 6800000);
    add(month, 2, 'savings-main', 'Arriendo apartamento', 'Vivienda', 'expense', -1650000);
    add(month, 3, 'savings-main', 'Servicios e internet', 'Servicios', 'expense', -(245000 + month * 1500));
    add(month, 4, 'savings-main', 'Aporte a vacaciones', 'Transferencias', 'transfer', -450000);
    add(month, 4, 'savings-goals', 'Aporte a vacaciones', 'Transferencias', 'transfer', 450000);
    add(month, 5, 'savings-main', 'Retiro para efectivo', 'Transferencias', 'transfer', -180000);
    add(month, 5, 'cash', 'Retiro para efectivo', 'Transferencias', 'transfer', 180000);
    for (let week = 0; week < 4; week++) {
      const day = 6 + week * 6;
      add(month, day, 'credit-emerald', 'Mercado semanal', 'Alimentación', 'expense', -(135000 + ((month + week) % 5) * 7500));
      add(month, day, 'credit-indigo', 'Transporte y movilidad', 'Transporte', 'expense', -(42000 + week * 3000));
      add(month, day, 'cash', 'Café y almuerzo', 'Alimentación', 'expense', -(26000 + week * 1000));
      add(month, day + 1, 'savings-main', 'Compras del hogar', 'Hogar', 'expense', -(54000 + month * 1000));
    }
    add(month, 10, 'credit-copper', 'Suscripción música', 'Suscripciones', 'expense', -24900);
    add(month, 10, 'credit-copper', 'Suscripción almacenamiento', 'Suscripciones', 'expense', -12900);
    add(month, 12, 'credit-indigo', 'Compra compartida · Ana', 'Compras prestadas', 'expense', -95000, 'Ana Martínez');
    add(month, 14, 'savings-main', 'Reembolso compra · Ana', 'Reembolsos', 'income', 95000, 'Ana Martínez');
    add(month, 18, 'savings-main', 'Abono préstamo · Carlos', 'Préstamos', 'income', 100000, 'Carlos Gómez');
    for (const [card, day, amount] of [['credit-emerald', 20, 610000], ['credit-indigo', 23, 260000], ['credit-copper', 25, 37800]] as const) {
      add(month, day, 'savings-main', `Abono ${card}`, 'Pago de tarjeta', 'payment', -amount);
      add(month, day, card, `Abono ${card}`, 'Pago de tarjeta', 'payment', amount);
    }
    if (month % 3 === 0) add(month, 27, 'savings-main', 'Proyecto independiente', 'Honorarios', 'income', 920000);
  }
  add(0, 8, 'savings-main', 'Préstamo otorgado · Carlos', 'Préstamos', 'expense', -2000000, 'Carlos Gómez');
  add(4, 16, 'credit-emerald', 'Computador portátil · compra en cuotas', 'Tecnología', 'expense', -1800000);
  add(5, 17, 'credit-emerald', 'Devolución parcial de accesorio', 'Devoluciones', 'income', 120000);
  add(6, 9, 'savings-main', 'Constitución CDT', 'Inversiones', 'expense', -3000000);
  add(7, 11, 'savings-main', 'Aporte a fondo de inversión', 'Inversiones', 'expense', -1500000);
  add(11, 28, 'credit-indigo', 'Reserva hotel · pendiente de confirmación', 'Viajes', 'expense', -420000, undefined, 'pending');
  add(11, 29, 'credit-copper', 'Compra prestada · Laura', 'Compras prestadas', 'expense', -185000, 'Laura Méndez');
  return {
    accounts,
    movements: movements.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    people: [
      { id: 'carlos', name: 'Carlos Gómez', owed: 800000, owing: 0 },
      { id: 'ana', name: 'Ana Martínez', owed: 0, owing: 0 },
      { id: 'laura', name: 'Laura Méndez', owed: 185000, owing: 0 },
    ],
    investments: [
      { id: 'cdt', name: 'CDT · ahorro a plazo', type: 'CDT', cost: 3000000, value: 3120000 },
      { id: 'fund', name: 'Fondo conservador', type: 'Fondo', cost: 1500000, value: 1538000 },
    ],
    notifications: [
      { id: 'notice-purchase', title: 'Compra detectada para revisar', detail: 'Demostración: reserva de hotel por $420.000. Revisa antes de confirmar; no se ha conectado Gmail.', read: false },
      { id: 'notice-cut', title: 'Revisa tu próximo corte', detail: 'Visa Esmeralda: consulta movimientos y simula un abono.', read: false },
      { id: 'notice-review', title: 'Revisión de agosto disponible', detail: 'Doce meses de datos ficticios listos para explorar.', read: true },
    ],
  };
}
