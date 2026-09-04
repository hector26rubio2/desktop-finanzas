using Finanzas.Domain.Common;
using Finanzas.Domain.Identifiers;
using Finanzas.Domain.Obligations;
using Finanzas.Domain.ValueObjects;

namespace Finanzas.Domain.Tests;

public class ObligationTests
{
    private static readonly CounterpartyId Persona = CounterpartyId.New();

    private static Obligation Prestamo(
        PaymentAllocationRule regla = PaymentAllocationRule.InterestFirst,
        bool sobrepago = false,
        InterestPolicy? politica = null) =>
        Obligation.Create(
            ObligationId.New(),
            Persona,
            ObligationDirection.Receivable,
            ObligationOrigin.DirectLoan,
            Given.Cop,
            new DateOnly(2026, 1, 1),
            Given.Now,
            regla,
            politica,
            allowsOverpayment: sobrepago);

    private static Obligation ConSaldo(
        decimal capital,
        decimal interes,
        PaymentAllocationRule regla = PaymentAllocationRule.InterestFirst,
        bool sobrepago = false)
    {
        var obligacion = Prestamo(regla, sobrepago);
        obligacion.RegisterDisbursement(
            ObligationEntryId.New(),
            new DateOnly(2026, 1, 5),
            Given.Money(capital),
            MovementId.New(),
            Given.Now);

        if (interes > 0m)
        {
            obligacion.RegisterInterest(
                ObligationEntryId.New(),
                new DateOnly(2026, 2, 1),
                Given.Money(interes),
                Given.Now);
        }

        return obligacion;
    }

    [Fact]
    public void El_saldo_se_deriva_de_los_asientos()
    {
        var obligacion = ConSaldo(1_000_000m, 50_000m);

        Assert.Equal(Given.Money(1_000_000m), obligacion.PrincipalOutstanding);
        Assert.Equal(Given.Money(50_000m), obligacion.InterestOutstanding);
        Assert.Equal(Given.Money(1_050_000m), obligacion.TotalOutstanding);
    }

    [Fact]
    public void Regla_intereses_primero()
    {
        var obligacion = ConSaldo(1_000_000m, 50_000m, PaymentAllocationRule.InterestFirst);

        var (_, reparto) = obligacion.RegisterPayment(
            ObligationEntryId.New(),
            new DateOnly(2026, 2, 10),
            Given.Money(200_000m),
            MovementId.New(),
            Given.Now);

        Assert.Equal(Given.Money(50_000m), reparto.Interest);
        Assert.Equal(Given.Money(150_000m), reparto.Principal);
        Assert.Equal(Given.Money(0m), reparto.Excess);
        Assert.Equal(Given.Money(850_000m), obligacion.PrincipalOutstanding);
        Assert.Equal(Given.Money(0m), obligacion.InterestOutstanding);
    }

    [Fact]
    public void Regla_capital_primero()
    {
        var obligacion = ConSaldo(100_000m, 50_000m, PaymentAllocationRule.PrincipalFirst);

        var (_, reparto) = obligacion.RegisterPayment(
            ObligationEntryId.New(),
            new DateOnly(2026, 2, 10),
            Given.Money(120_000m),
            MovementId.New(),
            Given.Now);

        Assert.Equal(Given.Money(100_000m), reparto.Principal);
        Assert.Equal(Given.Money(20_000m), reparto.Interest);
    }

    [Fact]
    public void Regla_proporcional_no_pierde_un_solo_peso()
    {
        var obligacion = ConSaldo(100m, 50m, PaymentAllocationRule.Proportional);

        // Cinco pesos entre un saldo 100/50: el reparto exacto sería 3,33 y
        // 1,67, pero en pesos no hay fracciones y la suma debe seguir dando 5.
        var (_, reparto) = obligacion.RegisterPayment(
            ObligationEntryId.New(),
            new DateOnly(2026, 2, 10),
            Given.Money(5m),
            MovementId.New(),
            Given.Now);

        Assert.Equal(Given.Money(5m), reparto.Total);
        Assert.Equal(Given.Money(3m), reparto.Principal);
        Assert.Equal(Given.Money(2m), reparto.Interest);
    }

    [Fact]
    public void Regla_proporcional_cuadra_para_cualquier_importe_en_pesos()
    {
        foreach (var importe in new[] { 1m, 2m, 3m, 7m, 99m, 100m, 151m, 400m })
        {
            var obligacion = ConSaldo(333m, 67m, PaymentAllocationRule.Proportional);
            var reparto = obligacion.Allocate(Given.Money(importe), PaymentAllocationRule.Proportional);

            Assert.Equal(Given.Money(importe), reparto.Total);
            Assert.Equal(decimal.Truncate(reparto.Principal.Amount), reparto.Principal.Amount);
            Assert.Equal(decimal.Truncate(reparto.Interest.Amount), reparto.Interest.Amount);
        }
    }

    [Fact]
    public void La_regla_manual_exige_reparto_explicito()
    {
        var obligacion = ConSaldo(100_000m, 50_000m, PaymentAllocationRule.Manual);

        var error = Assert.Throws<InvariantViolationException>(() => obligacion.RegisterPayment(
            ObligationEntryId.New(),
            new DateOnly(2026, 2, 10),
            Given.Money(10_000m),
            MovementId.New(),
            Given.Now));

        Assert.Equal(DomainErrorCodes.ObligationManualAllocationRequired, error.Code);
    }

    [Fact]
    public void Abono_manual_aplica_lo_indicado()
    {
        var obligacion = ConSaldo(100_000m, 50_000m, PaymentAllocationRule.Manual);

        obligacion.RegisterManualPayment(
            ObligationEntryId.New(),
            new DateOnly(2026, 2, 10),
            Given.Money(30_000m),
            Given.Money(20_000m),
            MovementId.New(),
            Given.Now);

        Assert.Equal(Given.Money(70_000m), obligacion.PrincipalOutstanding);
        Assert.Equal(Given.Money(30_000m), obligacion.InterestOutstanding);
    }

    [Fact]
    public void El_sobrepago_se_rechaza_por_omision()
    {
        var obligacion = ConSaldo(100_000m, 0m);

        var error = Assert.Throws<InvariantViolationException>(() => obligacion.RegisterPayment(
            ObligationEntryId.New(),
            new DateOnly(2026, 2, 10),
            Given.Money(150_000m),
            MovementId.New(),
            Given.Now));

        Assert.Equal(DomainErrorCodes.ObligationOverpayment, error.Code);
    }

    [Fact]
    public void El_sobrepago_autorizado_queda_como_saldo_a_favor()
    {
        var obligacion = ConSaldo(100_000m, 0m, sobrepago: true);

        var (_, reparto) = obligacion.RegisterPayment(
            ObligationEntryId.New(),
            new DateOnly(2026, 2, 10),
            Given.Money(150_000m),
            MovementId.New(),
            Given.Now);

        Assert.Equal(Given.Money(50_000m), reparto.Excess);
        Assert.Equal(Given.Money(-50_000m), obligacion.TotalOutstanding);
    }

    [Fact]
    public void El_reparto_siempre_suma_el_abono_completo()
    {
        var obligacion = ConSaldo(333m, 67m, PaymentAllocationRule.Proportional);

        foreach (var importe in new[] { 1m, 7m, 13m, 250m })
        {
            var reparto = obligacion.Allocate(Given.Money(importe), PaymentAllocationRule.Proportional);
            Assert.Equal(Given.Money(importe), reparto.Total);
        }
    }

    [Fact]
    public void Reversar_un_abono_restaura_el_saldo_sin_borrar_auditoria()
    {
        var obligacion = ConSaldo(1_000_000m, 0m);
        var (abono, _) = obligacion.RegisterPayment(
            ObligationEntryId.New(),
            new DateOnly(2026, 2, 10),
            Given.Money(300_000m),
            MovementId.New(),
            Given.Now);

        Assert.Equal(Given.Money(700_000m), obligacion.PrincipalOutstanding);

        obligacion.ReverseEntry(
            ObligationEntryId.New(),
            abono.Id,
            new DateOnly(2026, 2, 20),
            Given.Now);

        Assert.Equal(Given.Money(1_000_000m), obligacion.PrincipalOutstanding);
        Assert.Equal(3, obligacion.Entries.Count);
        Assert.True(abono.IsReversed);
    }

    [Fact]
    public void Un_asiento_no_se_reversa_dos_veces()
    {
        var obligacion = ConSaldo(1_000_000m, 0m);
        var (abono, _) = obligacion.RegisterPayment(
            ObligationEntryId.New(),
            new DateOnly(2026, 2, 10),
            Given.Money(300_000m),
            MovementId.New(),
            Given.Now);

        obligacion.ReverseEntry(ObligationEntryId.New(), abono.Id, new DateOnly(2026, 2, 20), Given.Now);

        var error = Assert.Throws<InvariantViolationException>(() => obligacion.ReverseEntry(
            ObligationEntryId.New(), abono.Id, new DateOnly(2026, 2, 21), Given.Now));

        Assert.Equal(DomainErrorCodes.ObligationEntryAlreadyReversed, error.Code);
    }

    [Fact]
    public void No_se_reversa_un_asiento_inexistente()
    {
        var obligacion = ConSaldo(1_000_000m, 0m);

        var error = Assert.Throws<InvariantViolationException>(() => obligacion.ReverseEntry(
            ObligationEntryId.New(), ObligationEntryId.New(), Given.Today, Given.Now));

        Assert.Equal(DomainErrorCodes.ObligationEntryNotFound, error.Code);
    }

    [Fact]
    public void Un_periodo_cerrado_no_admite_asientos_nuevos()
    {
        var obligacion = ConSaldo(1_000_000m, 0m);
        obligacion.CloseThrough(new DateOnly(2026, 2, 28));

        var error = Assert.Throws<InvariantViolationException>(() => obligacion.RegisterPayment(
            ObligationEntryId.New(),
            new DateOnly(2026, 2, 15),
            Given.Money(100_000m),
            MovementId.New(),
            Given.Now));

        Assert.Equal(DomainErrorCodes.ObligationClosedPeriod, error.Code);
    }

    [Fact]
    public void Un_periodo_cerrado_no_se_reabre_bajando_la_fecha()
    {
        var obligacion = ConSaldo(1_000_000m, 0m);
        obligacion.CloseThrough(new DateOnly(2026, 2, 28));

        var error = Assert.Throws<InvariantViolationException>(
            () => obligacion.CloseThrough(new DateOnly(2026, 1, 31)));

        Assert.Equal(DomainErrorCodes.ObligationClosedPeriod, error.Code);
    }

    [Fact]
    public void Cambiar_la_politica_de_interes_no_toca_el_periodo_cerrado()
    {
        var obligacion = ConSaldo(1_000_000m, 0m);
        obligacion.CloseThrough(new DateOnly(2026, 2, 28));

        var error = Assert.Throws<InvariantViolationException>(() => obligacion.ChangeInterestPolicy(
            InterestPolicy.Fixed(Percentage.FromPercent(24m), RatePeriod.Annual),
            new DateOnly(2026, 2, 1)));

        Assert.Equal(DomainErrorCodes.ObligationClosedPeriod, error.Code);
    }

    [Fact]
    public void La_politica_de_interes_es_una_serie_con_vigencias()
    {
        var obligacion = Prestamo(politica: InterestPolicy.Fixed(Percentage.FromPercent(12m), RatePeriod.Annual));
        obligacion.ChangeInterestPolicy(
            InterestPolicy.Fixed(Percentage.FromPercent(24m), RatePeriod.Annual),
            new DateOnly(2026, 6, 1));

        Assert.Equal(12m, obligacion.PolicyOn(new DateOnly(2026, 5, 31)).Rate.Percent);
        Assert.Equal(24m, obligacion.PolicyOn(new DateOnly(2026, 6, 1)).Rate.Percent);
    }

    [Fact]
    public void El_devengo_usa_la_politica_vigente_y_el_capital_pendiente()
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

        // 36,5 % anual sobre base Actual/365 = 0,1 % diario; 10 días = 1 %.
        var asiento = obligacion.AccrueInterest(
            ObligationEntryId.New(),
            DateRange.Create(new DateOnly(2026, 2, 1), new DateOnly(2026, 2, 10)),
            Given.Now);

        Assert.NotNull(asiento);
        Assert.Equal(Given.Money(10_000m), obligacion.InterestOutstanding);
    }

    [Fact]
    public void Sin_politica_de_interes_no_se_devenga_nada()
    {
        var obligacion = ConSaldo(1_000_000m, 0m);

        var asiento = obligacion.AccrueInterest(
            ObligationEntryId.New(),
            DateRange.Month(2026, 2),
            Given.Now);

        Assert.Null(asiento);
        Assert.Equal(Given.Money(0m), obligacion.InterestOutstanding);
    }

    [Fact]
    public void Saldar_exige_saldo_cero()
    {
        var obligacion = ConSaldo(1_000_000m, 0m);

        var error = Assert.Throws<InvariantViolationException>(
            () => obligacion.Settle(ObligationEntryId.New(), Given.Today, Given.Now));

        Assert.Equal(DomainErrorCodes.ObligationOutstandingNotZero, error.Code);
    }

    [Fact]
    public void Saldar_no_genera_movimiento()
    {
        var obligacion = ConSaldo(1_000_000m, 0m);
        obligacion.RegisterPayment(
            ObligationEntryId.New(),
            new DateOnly(2026, 2, 10),
            Given.Money(1_000_000m),
            MovementId.New(),
            Given.Now);

        var cierre = obligacion.Settle(ObligationEntryId.New(), new DateOnly(2026, 2, 11), Given.Now);

        Assert.Equal(ObligationStatus.Settled, obligacion.Status);
        Assert.Null(cierre.Movement);
        Assert.True(cierre.TotalDelta.IsZero);
    }

    [Fact]
    public void Una_obligacion_saldada_no_admite_cambios()
    {
        var obligacion = ConSaldo(100_000m, 0m);
        obligacion.RegisterPayment(
            ObligationEntryId.New(),
            new DateOnly(2026, 2, 10),
            Given.Money(100_000m),
            MovementId.New(),
            Given.Now);
        obligacion.Settle(ObligationEntryId.New(), new DateOnly(2026, 2, 11), Given.Now);

        var error = Assert.Throws<InvariantViolationException>(() => obligacion.RegisterCharge(
            ObligationEntryId.New(), new DateOnly(2026, 3, 1), Given.Money(1m), Given.Now));

        Assert.Equal(DomainErrorCodes.ObligationNotOpen, error.Code);
    }

    [Fact]
    public void Los_asientos_van_en_la_moneda_de_la_obligacion()
    {
        var obligacion = Prestamo();

        var error = Assert.Throws<InvariantViolationException>(() => obligacion.RegisterDisbursement(
            ObligationEntryId.New(),
            new DateOnly(2026, 1, 5),
            Given.Usd_(100m),
            MovementId.New(),
            Given.Now));

        Assert.Equal(DomainErrorCodes.CurrencyMismatch, error.Code);
    }

    [Fact]
    public void El_mismo_movimiento_no_se_asienta_dos_veces()
    {
        var obligacion = Prestamo();
        var movimiento = MovementId.New();
        obligacion.RegisterDisbursement(
            ObligationEntryId.New(), new DateOnly(2026, 1, 5), Given.Money(100m), movimiento, Given.Now);

        var error = Assert.Throws<InvariantViolationException>(() => obligacion.RegisterDisbursement(
            ObligationEntryId.New(), new DateOnly(2026, 1, 6), Given.Money(100m), movimiento, Given.Now));

        Assert.Equal(DomainErrorCodes.InvariantViolation, error.Code);
    }

    [Fact]
    public void El_cierre_de_una_obligacion_no_puede_llevar_movimiento()
    {
        // Una obligación sin saldo se puede cerrar; el asiento de cierre es
        // metadato y nunca enlaza dinero.
        var obligacion = Prestamo();

        var cierre = obligacion.Settle(ObligationEntryId.New(), new DateOnly(2026, 3, 1), Given.Now);
        Assert.Equal(ObligationEntryType.Closure, cierre.Type);
        Assert.Null(cierre.Movement);
    }
}
