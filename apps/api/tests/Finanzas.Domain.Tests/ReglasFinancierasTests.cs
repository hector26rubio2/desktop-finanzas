using Finanzas.Domain.Common;
using Finanzas.Domain.Identifiers;
using Finanzas.Domain.Investments;
using Finanzas.Domain.Ledger;
using Finanzas.Domain.Obligations;
using Finanzas.Domain.Purchases;
using Finanzas.Domain.Settlements;
using Finanzas.Domain.ValueObjects;

namespace Finanzas.Domain.Tests;

/// <summary>
/// Una prueba por cada una de las diez reglas financieras vinculantes del
/// handoff (`apps/api/HANDOFF.md` §4). Si una de estas pruebas se cae, se está
/// rompiendo un acuerdo, no un detalle de implementación.
/// </summary>
public class ReglasFinancierasTests
{
    private static readonly AccountId Cuenta = AccountId.New();
    private static readonly CardId Tarjeta = CardId.New();
    private static readonly CounterpartyId Persona = CounterpartyId.New();

    // ----------------------------------------------------------------------
    // Regla 1 — Movimiento es el ledger central; los saldos se derivan de él.
    // ----------------------------------------------------------------------
    [Fact]
    public void Regla01_el_saldo_de_la_cuenta_se_deriva_del_ledger()
    {
        var movimientos = new List<Movement>
        {
            Given.Income(3_000_000m, Cuenta, new DateOnly(2026, 3, 1)),
            Given.Expense(1_200_000m, Cuenta, new DateOnly(2026, 3, 5)),
            Given.Expense(300_000m, Cuenta, new DateOnly(2026, 3, 9)),
        };

        Assert.Equal(
            Given.Money(1_500_000m),
            LedgerProjections.AccountBalance(movimientos, Cuenta, Given.Cop));
    }

    [Fact]
    public void Regla01_la_deuda_de_la_tarjeta_se_deriva_del_ledger()
    {
        var operacion = OperationId.New();
        var movimientos = new List<Movement>
        {
            Given.CardPurchase(500_000m, Tarjeta, new DateOnly(2026, 3, 2)),
            Given.CardPurchase(200_000m, Tarjeta, new DateOnly(2026, 3, 8)),
            Movement.Create(
                MovementId.New(),
                new DateOnly(2026, 3, 20),
                MovementKind.CardPayment,
                EconomicEffect.Neutral,
                CashFlow.Inflow,
                Given.Amount(300_000m, new DateOnly(2026, 3, 20)),
                new MovementLinks { Card = Tarjeta, Operation = operacion },
                Given.Now),
        };

        Assert.Equal(Given.Money(400_000m), LedgerProjections.CardDebt(movimientos, Tarjeta, Given.Cop));
    }

    // ----------------------------------------------------------------------
    // Regla 2 — El efecto económico se registra una sola vez.
    // ----------------------------------------------------------------------
    [Fact]
    public void Regla02_pagar_la_tarjeta_no_vuelve_a_ser_gasto()
    {
        var operacion = OperationId.New();
        var compra = Given.CardPurchase(500_000m, Tarjeta, new DateOnly(2026, 3, 2));

        var pagoDesdeCuenta = Movement.Create(
            MovementId.New(),
            new DateOnly(2026, 3, 20),
            MovementKind.CardPayment,
            EconomicEffect.Neutral,
            CashFlow.Outflow,
            Given.Amount(500_000m, new DateOnly(2026, 3, 20)),
            new MovementLinks { Account = Cuenta, Operation = operacion },
            Given.Now);

        var pagoHaciaTarjeta = Movement.Create(
            MovementId.New(),
            new DateOnly(2026, 3, 20),
            MovementKind.CardPayment,
            EconomicEffect.Neutral,
            CashFlow.Inflow,
            Given.Amount(500_000m, new DateOnly(2026, 3, 20)),
            new MovementLinks { Card = Tarjeta, Operation = operacion },
            Given.Now);

        var resumen = LedgerProjections.Summarize(
            [compra, pagoDesdeCuenta, pagoHaciaTarjeta],
            DateRange.Month(2026, 3),
            Given.Cop);

        // El gasto es la compra, una sola vez; el pago es neutro.
        Assert.Equal(Given.Money(500_000m), resumen.Expense);
        Assert.Equal(Given.Money(0m), resumen.Income);
    }

    [Fact]
    public void Regla02_un_pago_de_tarjeta_no_puede_declararse_gasto()
    {
        var error = Assert.Throws<InvariantViolationException>(() => Movement.Create(
            MovementId.New(),
            Given.Today,
            MovementKind.CardPayment,
            EconomicEffect.Expense,
            CashFlow.Outflow,
            Given.Amount(100m),
            new MovementLinks { Account = Cuenta, Operation = OperationId.New() },
            Given.Now));

        Assert.Equal(DomainErrorCodes.MovementEffectNotAllowed, error.Code);
    }

    [Fact]
    public void Regla02_cerrar_una_obligacion_no_mueve_dinero()
    {
        var obligacion = NuevaObligacion();
        var cierre = obligacion.Settle(ObligationEntryId.New(), new DateOnly(2026, 3, 1), Given.Now);

        Assert.True(cierre.TotalDelta.IsZero);
        Assert.Null(cierre.Movement);
    }

    [Fact]
    public void Regla02_el_devengo_es_gasto_sin_caja_y_su_pago_es_neutro()
    {
        var obligacion = ObligationId.New();

        var devengo = Movement.Create(
            MovementId.New(),
            Given.Today,
            MovementKind.LoanInterest,
            EconomicEffect.Expense,
            CashFlow.None,
            Given.Amount(20_000m),
            new MovementLinks { Obligation = obligacion, Counterparty = Persona },
            Given.Now);

        var pago = Movement.Create(
            MovementId.New(),
            Given.Today,
            MovementKind.LoanRepayment,
            EconomicEffect.Neutral,
            CashFlow.Outflow,
            Given.Amount(20_000m),
            new MovementLinks { Obligation = obligacion, Counterparty = Persona, Account = Cuenta },
            Given.Now);

        var resumen = LedgerProjections.Summarize([devengo, pago], DateRange.Month(2026, 3), Given.Cop);

        Assert.Equal(Given.Money(20_000m), resumen.Expense);
        Assert.Equal(Given.Money(-20_000m), LedgerProjections.AccountBalance([devengo, pago], Cuenta, Given.Cop));
    }

    // ----------------------------------------------------------------------
    // Regla 3 — Deuda propia ≠ cuenta por cobrar.
    // ----------------------------------------------------------------------
    [Fact]
    public void Regla03_asignar_una_compra_no_reduce_la_deuda_con_el_banco()
    {
        var compra = Given.CardPurchase(300_000m, Tarjeta, new DateOnly(2026, 3, 2));
        var deudaInicial = LedgerProjections.CardDebt([compra], Tarjeta, Given.Cop);

        var obligacion = Obligation.Create(
            ObligationId.New(),
            Persona,
            ObligationDirection.Receivable,
            ObligationOrigin.CardPurchase,
            Given.Cop,
            new DateOnly(2026, 3, 2),
            Given.Now,
            card: Tarjeta);

        var cargo = Movement.Create(
            MovementId.New(),
            new DateOnly(2026, 3, 2),
            MovementKind.LoanCharge,
            EconomicEffect.Neutral,
            CashFlow.None,
            Given.Amount(300_000m, new DateOnly(2026, 3, 2)),
            new MovementLinks { Obligation = obligacion.Id, Counterparty = Persona, Card = Tarjeta },
            Given.Now);

        obligacion.RegisterCharge(
            ObligationEntryId.New(),
            new DateOnly(2026, 3, 2),
            Given.Money(300_000m),
            Given.Now,
            cargo.Id);

        var deudaFinal = LedgerProjections.CardDebt([compra, cargo], Tarjeta, Given.Cop);

        // Lo que se le debe al banco no cambia...
        Assert.Equal(deudaInicial, deudaFinal);
        Assert.Equal(Given.Money(300_000m), deudaFinal);

        // ...y además existe una cuenta por cobrar por el mismo importe, aparte.
        Assert.Equal(Given.Money(300_000m), obligacion.TotalOutstanding);
        Assert.True(obligacion.IsReceivable);
    }

    [Fact]
    public void Regla03_un_cargo_a_una_persona_no_puede_mover_caja()
    {
        var error = Assert.Throws<InvariantViolationException>(() => Movement.Create(
            MovementId.New(),
            Given.Today,
            MovementKind.LoanCharge,
            EconomicEffect.Neutral,
            CashFlow.Inflow,
            Given.Amount(100m),
            new MovementLinks { Obligation = ObligationId.New(), Counterparty = Persona },
            Given.Now));

        Assert.Equal(DomainErrorCodes.MovementFlowNotAllowed, error.Code);
    }

    [Fact]
    public void Regla03_la_deuda_propia_y_lo_por_cobrar_no_se_compensan()
    {
        var posicion = new DebtPosition(Given.Money(300_000m), Given.Money(300_000m));

        Assert.Equal(Given.Money(300_000m), posicion.OwnDebt);
        Assert.Equal(Given.Money(300_000m), posicion.Receivable);

        // El tipo no expone ningún "neto": compensar exige hacerlo a la vista.
        Assert.DoesNotContain(
            typeof(DebtPosition).GetProperties(),
            p => p.Name.Contains("Net", StringComparison.OrdinalIgnoreCase));
    }

    // ----------------------------------------------------------------------
    // Regla 4 — decimal siempre, con política de redondeo documentada.
    // ----------------------------------------------------------------------
    [Fact]
    public void Regla04_ningun_importe_del_dominio_usa_punto_flotante()
    {
        var tiposMonetarios = typeof(Money).Assembly.GetTypes()
            .Where(t => t.IsClass || t.IsValueType)
            .SelectMany(t => t.GetProperties())
            .Where(p => p.PropertyType == typeof(double) || p.PropertyType == typeof(float))
            .Select(p => $"{p.DeclaringType!.Name}.{p.Name}")
            .ToArray();

        Assert.Empty(tiposMonetarios);
    }

    [Fact]
    public void Regla04_la_politica_de_redondeo_es_unica_y_explicita()
    {
        Assert.Equal(MidpointRounding.AwayFromZero, MoneyRounding.Mode);

        // Medio hacia arriba, a la escala de cada moneda.
        Assert.Equal(10.35m, Money.Of(10.345m, Given.Usd).Amount);
        Assert.Equal(11m, Money.Of(10.5m, Given.Cop).Amount);

        // El peso colombiano se opera sin centavos (HANDOFF.md §1).
        Assert.Equal(0, Given.Cop.MinorUnits);
    }

    // ----------------------------------------------------------------------
    // Regla 5 — Nunca sumar monedas sin conversión explícita.
    // ----------------------------------------------------------------------
    [Fact]
    public void Regla05_no_se_suman_monedas_distintas() =>
        Assert.Throws<CurrencyMismatchException>(() => Given.Money(1m) + Given.Usd_(1m));

    [Fact]
    public void Regla05_se_conserva_moneda_original_y_moneda_base()
    {
        var movimiento = Movement.Create(
            MovementId.New(),
            Given.Today,
            MovementKind.Expense,
            EconomicEffect.Expense,
            CashFlow.Outflow,
            Given.AmountUsd(25m, 4100m),
            new MovementLinks { Account = Cuenta },
            Given.Now);

        Assert.Equal(Given.Usd, movimiento.Amount.Currency);
        Assert.Equal(Given.Cop, movimiento.Amount.BaseCurrency);
        Assert.Equal(Given.Money(102_500m), movimiento.Amount.Base);
    }

    // ----------------------------------------------------------------------
    // Regla 6 — Un abono no modifica el importe original; reversar audita.
    // ----------------------------------------------------------------------
    [Fact]
    public void Regla06_el_abono_no_altera_el_importe_original()
    {
        var obligacion = NuevaObligacion();
        var desembolso = obligacion.RegisterDisbursement(
            ObligationEntryId.New(),
            new DateOnly(2026, 1, 5),
            Given.Money(1_000_000m),
            MovementId.New(),
            Given.Now);

        obligacion.RegisterPayment(
            ObligationEntryId.New(),
            new DateOnly(2026, 2, 5),
            Given.Money(400_000m),
            MovementId.New(),
            Given.Now);

        Assert.Equal(Given.Money(1_000_000m), desembolso.PrincipalDelta);
        Assert.Equal(Given.Money(600_000m), obligacion.PrincipalOutstanding);
    }

    [Fact]
    public void Regla06_reversar_restaura_el_saldo_sin_borrar_nada()
    {
        var obligacion = NuevaObligacion();
        obligacion.RegisterDisbursement(
            ObligationEntryId.New(),
            new DateOnly(2026, 1, 5),
            Given.Money(1_000_000m),
            MovementId.New(),
            Given.Now);

        var (abono, _) = obligacion.RegisterPayment(
            ObligationEntryId.New(),
            new DateOnly(2026, 2, 5),
            Given.Money(400_000m),
            MovementId.New(),
            Given.Now);

        obligacion.ReverseEntry(ObligationEntryId.New(), abono.Id, new DateOnly(2026, 2, 6), Given.Now);

        Assert.Equal(Given.Money(1_000_000m), obligacion.PrincipalOutstanding);
        Assert.Equal(3, obligacion.Entries.Count);
        Assert.Contains(obligacion.Entries, e => e.Id == abono.Id);
    }

    // ----------------------------------------------------------------------
    // Regla 7 — Operaciones compuestas atómicas e idempotentes.
    // ----------------------------------------------------------------------
    [Fact]
    public void Regla07_una_operacion_compuesta_debe_cuadrar_completa()
    {
        var operacion = Operation.Create(
            OperationId.New(),
            OperationKind.Transfer,
            Given.Today,
            Given.Now,
            idempotencyKey: "transfer:2026-03-15:1");

        operacion.AddLeg(Movement.Create(
            MovementId.New(),
            Given.Today,
            MovementKind.TransferOut,
            EconomicEffect.Neutral,
            CashFlow.Outflow,
            Given.Amount(100_000m),
            new MovementLinks { Account = Cuenta, Operation = operacion.Id },
            Given.Now));

        var error = Assert.Throws<InvariantViolationException>(() => operacion.EnsureConsistent(Given.Cop));
        Assert.Equal(DomainErrorCodes.OperationTooFewLegs, error.Code);
        Assert.Equal("transfer:2026-03-15:1", operacion.IdempotencyKey);
    }

    [Fact]
    public void Regla07_materializar_dos_veces_un_recurrente_no_duplica_el_gasto()
    {
        var recurrente = Recurrences.Recurrence.Create(
            RecurrenceId.New(),
            "Suscripción",
            MovementKind.Expense,
            Given.Money(50_000m),
            new MovementLinks { Account = Cuenta },
            Recurrences.RecurrenceSchedule.Create(
                Recurrences.RecurrenceFrequency.Monthly,
                1,
                new DateOnly(2026, 1, 10)),
            Given.Now);

        recurrente.ConfirmMaterialization(new DateOnly(2026, 1, 10), MovementId.New());

        Assert.Throws<InvariantViolationException>(
            () => recurrente.ConfirmMaterialization(new DateOnly(2026, 1, 10), MovementId.New()));
        Assert.Single(recurrente.MaterializedOccurrences);
    }

    [Fact]
    public void Regla07_el_mismo_movimiento_no_se_asienta_dos_veces_en_una_obligacion()
    {
        var obligacion = NuevaObligacion();
        var movimiento = MovementId.New();

        obligacion.RegisterDisbursement(
            ObligationEntryId.New(), new DateOnly(2026, 1, 5), Given.Money(100m), movimiento, Given.Now);

        Assert.Throws<InvariantViolationException>(() => obligacion.RegisterDisbursement(
            ObligationEntryId.New(), new DateOnly(2026, 1, 5), Given.Money(100m), movimiento, Given.Now));
    }

    // ----------------------------------------------------------------------
    // Regla 8 — Los cambios de regla no recalculan periodos cerrados.
    // ----------------------------------------------------------------------
    [Fact]
    public void Regla08_cambiar_la_tasa_no_reescribe_lo_ya_devengado()
    {
        var obligacion = Obligation.Create(
            ObligationId.New(),
            Persona,
            ObligationDirection.Receivable,
            ObligationOrigin.DirectLoan,
            Given.Cop,
            new DateOnly(2026, 1, 1),
            Given.Now,
            interestPolicy: InterestPolicy.Fixed(Percentage.FromPercent(36.5m), RatePeriod.Annual));

        obligacion.RegisterDisbursement(
            ObligationEntryId.New(),
            new DateOnly(2026, 1, 1),
            Given.Money(1_000_000m),
            MovementId.New(),
            Given.Now);

        obligacion.AccrueInterest(
            ObligationEntryId.New(),
            DateRange.Create(new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 10)),
            Given.Now);

        var interesDevengado = obligacion.InterestOutstanding;
        obligacion.CloseThrough(new DateOnly(2026, 1, 31));

        obligacion.ChangeInterestPolicy(
            InterestPolicy.Fixed(Percentage.FromPercent(73m), RatePeriod.Annual),
            new DateOnly(2026, 2, 1));

        Assert.Equal(interesDevengado, obligacion.InterestOutstanding);
        Assert.Equal(36.5m, obligacion.PolicyOn(new DateOnly(2026, 1, 5)).Rate.Percent);
        Assert.Equal(73m, obligacion.PolicyOn(new DateOnly(2026, 2, 5)).Rate.Percent);
    }

    // ----------------------------------------------------------------------
    // Regla 9 — Toda liquidación conserva versión, corte y entradas usadas.
    // ----------------------------------------------------------------------
    [Fact]
    public void Regla09_la_liquidacion_es_reproducible_y_no_se_modifica()
    {
        var obligacion = ObligationId.New();
        var asiento = ObligationEntryId.New();

        var liquidacion = Settlement.Issue(
            SettlementId.New(),
            Persona,
            DateRange.Month(2026, 3),
            new DateOnly(2026, 3, 31),
            Given.Cop,
            Given.Money(0m),
            [
                new SettlementLine(
                    obligacion,
                    asiento,
                    ObligationEntryType.Charge,
                    new DateOnly(2026, 3, 10),
                    Given.Money(120_000m),
                    Given.Money(0m)),
            ],
            formulaVersion: 3,
            Given.Now);

        liquidacion.EnsureBalanced();

        Assert.Equal(3, liquidacion.FormulaVersion);
        Assert.Equal(new DateOnly(2026, 3, 31), liquidacion.CutOff);
        Assert.Equal(asiento, liquidacion.Lines.Single().Entry);
        Assert.Equal(Given.Money(120_000m), liquidacion.ClosingBalance);
    }

    // ----------------------------------------------------------------------
    // Regla 10 — Las proyecciones no son garantías ni se materializan solas.
    // ----------------------------------------------------------------------
    [Fact]
    public void Regla10_un_escenario_solo_llega_al_ledger_por_confirmacion_explicita()
    {
        var movimiento = Movement.Create(
            MovementId.New(),
            Given.Today,
            MovementKind.Expense,
            EconomicEffect.Expense,
            CashFlow.Outflow,
            Given.Amount(100_000m),
            new MovementLinks { Account = Cuenta },
            Given.Now,
            MovementOrigin.ScenarioConfirmation);

        Assert.Equal(MovementOrigin.ScenarioConfirmation, movimiento.Origin);

        // El origen por omisión es manual: nada entra al ledger "porque sí".
        Assert.Equal(MovementOrigin.Manual, Given.Expense(1m, Cuenta).Origin);
    }

    [Fact]
    public void Regla10_una_valoracion_no_es_flujo_de_caja()
    {
        var posicion = InvestmentPosition.Create(
            PositionId.New(),
            "Fondo",
            "Fund",
            Given.Cop,
            RiskLevel.Low,
            Given.Now);

        posicion.AddValuation(Valuation.Create(
            ValuationId.New(),
            Given.Today,
            Given.Money(5_000_000m),
            ValuationSource.MarketPrice));

        // Hay valor de mercado, pero ni una sola operación ni movimiento.
        Assert.Equal(Given.Money(5_000_000m), posicion.MarketValue(Given.Today));
        Assert.Empty(posicion.Operations);
    }

    [Fact]
    public void Regla10_una_compra_compartida_no_crea_movimientos_por_si_sola()
    {
        var compra = SharedPurchase.Create(
            SharedPurchaseId.New(),
            MovementId.New(),
            Tarjeta,
            Given.Today,
            Given.Money(200_000m),
            Given.Now);

        compra.Assign(PurchaseShare.OfPercentage(Persona, Percentage.FromPercent(50m)));
        var reparto = compra.Resolve();

        Assert.Equal(Given.Money(100_000m), reparto.AssignedTotal);
        Assert.Equal(Given.Money(100_000m), reparto.HolderPortion);
        Assert.Null(compra.Shares.Single().Obligation);
    }

    private static Obligation NuevaObligacion() => Obligation.Create(
        ObligationId.New(),
        Persona,
        ObligationDirection.Receivable,
        ObligationOrigin.DirectLoan,
        Given.Cop,
        new DateOnly(2026, 1, 1),
        Given.Now);
}
