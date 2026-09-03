import { computed, inject, Injectable, InjectionToken, signal } from '@angular/core';
import { Account, accountBalance, createDemoData, DemoData, demoUsers, Movement } from './demo-data';

export interface DataProvider { load(): DemoData }
export const DATA_PROVIDER = new InjectionToken<DataProvider>('DataProvider', { providedIn: 'root', factory: () => ({ load: createDemoData }) });
export interface CapabilitiesProvider { allows(capability: string): boolean }
export const CAPABILITIES = new InjectionToken<CapabilitiesProvider>('Capabilities', { providedIn: 'root', factory: () => {
  const store = inject(DemoStore); return { allows: (capability) => store.user() !== null && (store.user()?.id === demoUsers[0].id || !!store.user()?.capabilities.includes(capability)) };
} });
export const FEATURES = new InjectionToken<{ enabled(key: string): boolean }>('FeatureFlags', { providedIn: 'root', factory: () => ({ enabled: () => true }) });
export interface Preferences { theme: 'light' | 'dark'; accent: string; font: string; locale: string }
export const PREFERENCES = new InjectionToken('Preferences', { providedIn:'root', factory: () => signal<Preferences>({theme:'light', accent:'#087f68', font:'Inter, system-ui, sans-serif',locale:'es-CO'}) });

export const navigation = [
  { path:'dashboard', label:'Dashboard', icon:'◈', group:'PANORAMA', capability:'read' },
  { path:'movements', label:'Movimientos', icon:'⇄', group:'MI DINERO', capability:'read' },
  { path:'calendar', label:'Calendario', icon:'▦', group:'MI DINERO', capability:'read' },
  { path:'accounts', label:'Cuentas y tarjetas', icon:'▣', group:'MI DINERO', capability:'read' },
  { path:'people', label:'Personas y deudas', icon:'♧', group:'MI DINERO', capability:'read' },
  { path:'portfolio', label:'Patrimonio', icon:'◇', group:'MI DINERO', capability:'read' },
  { path:'planning', label:'Planificación', icon:'↗', group:'ANÁLISIS', capability:'read' },
  { path:'reports', label:'Reportes', icon:'▥', group:'ANÁLISIS', capability:'read' },
  { path:'notifications', label:'Notificaciones', icon:'◎', group:'ESPACIO', capability:'read' },
  { path:'admin', label:'Administración', icon:'⚙', group:'ESPACIO', capability:'admin' },
  { path:'settings', label:'Preferencias', icon:'☷', group:'ESPACIO', capability:'read' },
];

@Injectable({ providedIn:'root' })
export class DemoStore {
  private provider = inject(DATA_PROVIDER);
  readonly data = signal(this.provider.load());
  readonly users = demoUsers;
  readonly user = signal<(typeof demoUsers)[number] | null>(null);
  readonly preferences = inject(PREFERENCES);
  readonly query = signal('');
  readonly period = signal('all');
  readonly accountFilter = signal('all');
  readonly toast = signal('');
  readonly form = signal<{ kind:string; accountId?:string; movement?:Movement; notificationId?:string } | null>(null);
  readonly inspector = signal<{ type:string; id:string; previous?:{type:string;id:string} } | null>(null);
  readonly movements = computed(() => this.data().movements.filter(m =>
    (this.period() === 'all' || m.date.startsWith(this.period())) &&
    (this.accountFilter() === 'all' || m.accountId === this.accountFilter()) &&
    `${m.description} ${m.category} ${m.person ?? ''}`.toLocaleLowerCase().includes(this.query().toLocaleLowerCase())
  ).sort((a,b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)));
  readonly income = computed(() => this.movements().filter(m => m.kind === 'income').reduce((s,m)=>s+m.amount,0));
  readonly expense = computed(() => -this.movements().filter(m => m.kind === 'expense').reduce((s,m)=>s+m.amount,0));
  readonly unread = computed(() => this.data().notifications.filter(n=>!n.read).length);
  readonly history = signal<{date:string; action:string}[]>([{date:'2026-08-31',action:'Conjunto de demostración anual cargado'}]);
  readonly debt = computed(() => this.data().accounts.filter(a=>a.type==='credit').reduce((s,a)=>s+Math.max(0,-this.balance(a)),0));
  readonly available = computed(() => this.data().accounts.filter(a=>a.type!=='credit').reduce((s,a)=>s+this.balance(a),0));
  money(value:number, currency='COP') { return new Intl.NumberFormat(this.preferences().locale,{style:'currency',currency,maximumFractionDigits:0}).format(value); }
  account(id:string) { return this.data().accounts.find(a=>a.id===id); }
  balance(account:Account) { return accountBalance(account,this.data().movements); }
  open(kind='expense',accountId?:string,movement?:Movement,notificationId?:string) { this.form.set({kind,accountId,movement,notificationId}); }
  inspect(type:string,id:string) { const old=this.inspector(); this.inspector.set({type,id,previous:old?{type:old.type,id:old.id}:undefined}); }
  reset() { this.data.set(this.provider.load()); this.query.set(''); this.period.set('all'); this.accountFilter.set('all'); this.toast.set('Datos demo restaurados. No se ha modificado información real.'); }
  log(action:string) { this.history.update(h=>[{date:new Date().toISOString().slice(0,10),action},...h]); this.toast.set(action+' · Solo en esta sesión demo'); }
  save(input:{kind:string; date:string; description:string; accountId:string; targetId?:string; amount:number; category:string; person?:string; id?:string; notificationId?:string}) {
    if (!Number.isFinite(input.amount) || input.amount<=0) throw new Error('Introduce un importe positivo.');
    if (!this.account(input.accountId)) throw new Error('Selecciona una cuenta válida.');
    if ((input.kind==='payment'||input.kind==='transfer') && (!input.targetId || input.targetId===input.accountId || !this.account(input.targetId))) throw new Error('Selecciona una cuenta destino diferente.');
    const id=input.id ?? crypto.randomUUID();
    const kind=input.kind as Movement['kind'];
    const movement:Movement={id,date:input.date,description:input.description,accountId:input.accountId,category:input.category,kind,amount:kind==='income'?input.amount:-input.amount,status:'confirmed',person:input.person};
    this.data.update(d=>({...d,movements:[...d.movements.filter(m=>m.id!==id),movement,...((kind==='payment'||kind==='transfer')?[{...movement,id:id+'-to',accountId:input.targetId!,amount:input.amount}]:[])],notifications:d.notifications.map(n=>n.id===input.notificationId?{...n,read:true}:n)}));
    this.form.set(null); this.log(input.id?'Movimiento corregido; acción registrada':'Movimiento registrado');
  }
  createAccount(name:string,type:Account['type'],opening:number) {
    const id=crypto.randomUUID();
    const account:Account={id,name,type,currency:'COP',openingBalance:0,lastFour:'0000',color:'#087f68',...(type==='credit'?{limit:5000000,cutDay:20,dueDay:5}:{})};
    this.data.update(d=>({...d,accounts:[...d.accounts,account],movements:opening===0?d.movements:[...d.movements,{id:crypto.randomUUID(),date:'2026-08-31',description:'Saldo de apertura · '+name,accountId:id,category:'Apertura',kind:opening>0?'income':'expense',amount:opening,status:'confirmed'}]}));
    this.form.set(null);this.log('Cuenta creada');
  }
}
