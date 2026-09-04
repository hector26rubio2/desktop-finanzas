using Finanzas.Domain.Common;
using Finanzas.Domain.ValueObjects;

namespace Finanzas.Domain.Tests;

public class CurrencyTests
{
    [Theory]
    [InlineData("cop", "COP")]
    [InlineData(" usd ", "USD")]
    public void Normaliza_el_codigo(string entrada, string esperado) =>
        Assert.Equal(esperado, Currency.Of(entrada).Code);

    [Theory]
    [InlineData("CO")]
    [InlineData("COPX")]
    [InlineData("C0P")]
    [InlineData("")]
    public void Rechaza_codigos_invalidos(string codigo)
    {
        var error = Assert.Throws<InvariantViolationException>(() => Currency.Of(codigo));
        Assert.Contains(error.Code, new[] { DomainErrorCodes.InvalidCurrency, DomainErrorCodes.RequiredValue });
    }

    [Fact]
    public void La_igualdad_es_por_codigo() =>
        Assert.Equal(Currency.Of("COP"), Currency.Of("cop"));
}

public class ExchangeRateTests
{
    [Fact]
    public void La_tasa_debe_ser_positiva()
    {
        var error = Assert.Throws<InvariantViolationException>(
            () => ExchangeRate.Create(Given.Usd, Given.Cop, 0m, Given.Today));
        Assert.Equal(DomainErrorCodes.InvalidExchangeRate, error.Code);
    }

    [Fact]
    public void La_tasa_de_una_moneda_a_si_misma_debe_ser_uno()
    {
        var error = Assert.Throws<InvariantViolationException>(
            () => ExchangeRate.Create(Given.Cop, Given.Cop, 1.02m, Given.Today));
        Assert.Equal(DomainErrorCodes.InvalidExchangeRate, error.Code);
    }

    [Fact]
    public void No_se_aplica_a_la_moneda_equivocada()
    {
        var tasa = ExchangeRate.Create(Given.Usd, Given.Cop, 4000m, Given.Today);
        var error = Assert.Throws<InvariantViolationException>(() => tasa.Convert(Given.Money(10m)));
        Assert.Equal(DomainErrorCodes.CurrencyMismatch, error.Code);
    }

    [Fact]
    public void Convierte_redondeando_con_la_politica_del_dominio()
    {
        var tasa = ExchangeRate.Create(Given.Usd, Given.Cop, 4012.345m, Given.Today);

        // El resultado exacto es 40.123,45; en pesos no hay centavos.
        Assert.Equal(Given.Money(40_123m), tasa.Convert(Given.Usd_(10m)));
    }

    [Fact]
    public void Convertir_a_una_moneda_con_centavos_los_conserva()
    {
        var tasa = ExchangeRate.Create(Given.Cop, Given.Usd, 0.000245m, Given.Today);
        Assert.Equal(Given.Usd_(24.5m), tasa.Convert(Given.Money(100_000m)));
    }
}

public class ConvertedMoneyTests
{
    [Fact]
    public void El_importe_base_es_siempre_el_producto_de_importe_y_tasa()
    {
        var importe = Given.AmountUsd(100m, 4000m);

        Assert.Equal(Given.Usd_(100m), importe.Original);
        Assert.Equal(Given.Money(400_000m), importe.Base);
        Assert.False(importe.IsBaseCurrency);
    }

    [Fact]
    public void Rechaza_una_tasa_que_no_parte_de_la_moneda_original()
    {
        var tasa = ExchangeRate.Create(Given.Cop, Given.Usd, 0.00025m, Given.Today);
        var error = Assert.Throws<InvariantViolationException>(
            () => ConvertedMoney.Create(Given.Usd_(10m), tasa));
        Assert.Equal(DomainErrorCodes.CurrencyMismatch, error.Code);
    }
}

public class PercentageTests
{
    [Fact]
    public void Distingue_tasa_y_puntos_porcentuales()
    {
        Assert.Equal(0.195m, Percentage.FromPercent(19.5m).Rate);
        Assert.Equal(19.5m, Percentage.FromRate(0.195m).Percent);
    }

    [Fact]
    public void Una_participacion_no_pasa_del_cien_por_ciento()
    {
        var error = Assert.Throws<InvariantViolationException>(() => Percentage.Share(101m));
        Assert.Equal(DomainErrorCodes.InvalidPercentage, error.Code);
    }

    [Fact]
    public void Se_aplica_a_un_importe_con_redondeo_del_dominio()
    {
        Assert.Equal(Given.Usd_(19.5m), Percentage.FromPercent(19.5m).ApplyTo(Given.Usd_(100m)));

        // En pesos el resultado se redondea a la unidad: 19,5 → 20.
        Assert.Equal(Given.Money(20m), Percentage.FromPercent(19.5m).ApplyTo(Given.Money(100m)));
    }
}

public class DateRangeTests
{
    [Fact]
    public void El_inicio_no_puede_ser_posterior_al_fin()
    {
        var error = Assert.Throws<InvariantViolationException>(
            () => DateRange.Create(new DateOnly(2026, 3, 2), new DateOnly(2026, 3, 1)));
        Assert.Equal(DomainErrorCodes.InvalidDateRange, error.Code);
    }

    [Fact]
    public void Cuenta_los_dias_con_ambos_extremos_incluidos() =>
        Assert.Equal(31, DateRange.Month(2026, 1).DayCount);

    [Fact]
    public void Febrero_de_un_ano_bisiesto_tiene_29_dias() =>
        Assert.Equal(29, DateRange.Month(2028, 2).DayCount);

    [Fact]
    public void Detecta_solapes_e_intersecciones()
    {
        var enero = DateRange.Month(2026, 1);
        var quincena = DateRange.Create(new DateOnly(2026, 1, 15), new DateOnly(2026, 2, 15));

        Assert.True(enero.Overlaps(quincena));
        Assert.Equal(
            DateRange.Create(new DateOnly(2026, 1, 15), new DateOnly(2026, 1, 31)),
            enero.Intersect(quincena));
        Assert.Null(enero.Intersect(DateRange.Month(2026, 3)));
    }
}
