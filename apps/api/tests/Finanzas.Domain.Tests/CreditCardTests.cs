using Finanzas.Domain.Cards;
using Finanzas.Domain.Common;
using Finanzas.Domain.Identifiers;
using Finanzas.Domain.ValueObjects;

namespace Finanzas.Domain.Tests;

public class BillingCycleTests
{
    [Fact]
    public void El_ciclo_termina_en_el_corte_del_mes()
    {
        var ciclo = BillingCycle.Create(statementDay: 15, paymentDueDay: 5);
        var periodo = ciclo.PeriodContaining(new DateOnly(2026, 3, 10));

        Assert.Equal(new DateOnly(2026, 2, 16), periodo.Range.Start);
        Assert.Equal(new DateOnly(2026, 3, 15), periodo.Range.End);
        Assert.Equal(new DateOnly(2026, 3, 15), periodo.StatementDate);
        Assert.Equal(new DateOnly(2026, 4, 5), periodo.DueDate);
    }

    [Fact]
    public void Una_compra_despues_del_corte_cae_en_el_ciclo_siguiente()
    {
        var ciclo = BillingCycle.Create(15, 5);
        var periodo = ciclo.PeriodContaining(new DateOnly(2026, 3, 16));

        Assert.Equal(new DateOnly(2026, 4, 15), periodo.StatementDate);
        Assert.Equal(new DateOnly(2026, 3, 16), periodo.Range.Start);
    }

    [Fact]
    public void Un_corte_el_31_cae_el_ultimo_dia_de_febrero()
    {
        var ciclo = BillingCycle.Create(31, 15);

        Assert.Equal(new DateOnly(2026, 2, 28), ciclo.StatementDateIn(2026, 2));
        Assert.Equal(new DateOnly(2028, 2, 29), ciclo.StatementDateIn(2028, 2));
    }

    [Fact]
    public void El_ciclo_de_febrero_bisiesto_es_continuo()
    {
        var ciclo = BillingCycle.Create(31, 15);
        var periodo = ciclo.PeriodContaining(new DateOnly(2028, 2, 20));

        Assert.Equal(new DateOnly(2028, 2, 1), periodo.Range.Start);
        Assert.Equal(new DateOnly(2028, 2, 29), periodo.Range.End);

        var siguiente = ciclo.NextPeriodAfter(new DateOnly(2028, 2, 20));
        Assert.Equal(new DateOnly(2028, 3, 1), siguiente.Range.Start);
        Assert.Equal(new DateOnly(2028, 3, 31), siguiente.Range.End);
    }

    [Fact]
    public void El_vencimiento_siempre_es_posterior_al_corte()
    {
        var ciclo = BillingCycle.Create(statementDay: 5, paymentDueDay: 25);
        Assert.Equal(new DateOnly(2026, 3, 25), ciclo.DueDateFor(new DateOnly(2026, 3, 5)));

        var ciclo2 = BillingCycle.Create(statementDay: 25, paymentDueDay: 5);
        Assert.Equal(new DateOnly(2026, 4, 5), ciclo2.DueDateFor(new DateOnly(2026, 3, 25)));
    }

    [Theory]
    [InlineData(0, 5)]
    [InlineData(32, 5)]
    [InlineData(15, 0)]
    public void Rechaza_dias_de_ciclo_imposibles(int corte, int pago) =>
        Assert.Throws<InvariantViolationException>(() => BillingCycle.Create(corte, pago));
}

public class CreditCardTests
{
    private static CreditCard Tarjeta(decimal cupo = 5_000_000m, decimal? pisoMinimo = null) =>
        CreditCard.Create(
            CardId.New(),
            "Visa",
            Given.Cop,
            Given.Money(cupo),
            BillingCycle.Create(15, 5),
            CardTerms.Create(
                Percentage.FromPercent(28m),
                Percentage.FromPercent(5m),
                gracePeriodDays: 20,
                minimumPaymentFloor: pisoMinimo is null ? null : Given.Money(pisoMinimo.Value)),
            Given.Now);

    [Fact]
    public void El_cupo_debe_estar_en_la_moneda_de_la_tarjeta()
    {
        var error = Assert.Throws<InvariantViolationException>(() => CreditCard.Create(
            CardId.New(),
            "Visa",
            Given.Cop,
            Given.Usd_(1000m),
            BillingCycle.Create(15, 5),
            CardTerms.Create(Percentage.FromPercent(28m), Percentage.FromPercent(5m), 20),
            Given.Now));

        Assert.Equal(DomainErrorCodes.CurrencyMismatch, error.Code);
    }

    [Fact]
    public void Una_compra_que_excede_el_cupo_se_rechaza()
    {
        var tarjeta = Tarjeta(1_000_000m);

        var error = Assert.Throws<InvariantViolationException>(
            () => tarjeta.EnsureFitsInLimit(Given.Money(900_000m), Given.Money(200_000m)));

        Assert.Equal(DomainErrorCodes.CardLimitExceeded, error.Code);
    }

    [Fact]
    public void El_cupo_disponible_no_es_negativo()
    {
        var tarjeta = Tarjeta(1_000_000m);
        Assert.Equal(Given.Money(0m), tarjeta.AvailableCredit(Given.Money(1_200_000m)));
        Assert.Equal(Given.Money(400_000m), tarjeta.AvailableCredit(Given.Money(600_000m)));
    }

    [Fact]
    public void El_pago_minimo_toma_el_mayor_entre_porcentaje_y_piso()
    {
        var tarjeta = Tarjeta(pisoMinimo: 50_000m);

        // 5 % de 200.000 = 10.000, por debajo del piso.
        Assert.Equal(Given.Money(50_000m), tarjeta.MinimumPaymentFor(Given.Money(200_000m)));

        // 5 % de 2.000.000 = 100.000, por encima del piso.
        Assert.Equal(Given.Money(100_000m), tarjeta.MinimumPaymentFor(Given.Money(2_000_000m)));
    }

    [Fact]
    public void El_pago_minimo_nunca_supera_el_saldo()
    {
        var tarjeta = Tarjeta(pisoMinimo: 50_000m);
        Assert.Equal(Given.Money(30_000m), tarjeta.MinimumPaymentFor(Given.Money(30_000m)));
        Assert.Equal(Given.Money(0m), tarjeta.MinimumPaymentFor(Given.Money(0m)));
    }

    [Fact]
    public void La_tasa_mensual_es_la_anual_nominal_entre_doce()
    {
        var condiciones = CardTerms.Create(Percentage.FromPercent(24m), Percentage.FromPercent(5m), 20);
        Assert.Equal(2m, condiciones.MonthlyRate(condiciones.PurchaseApr).Percent);
    }

    [Fact]
    public void Un_pago_minimo_mayor_al_cien_por_ciento_es_invalido()
    {
        var error = Assert.Throws<InvariantViolationException>(
            () => CardTerms.Create(Percentage.FromPercent(24m), Percentage.FromPercent(120m), 20));
        Assert.Equal(DomainErrorCodes.InvalidPercentage, error.Code);
    }
}
