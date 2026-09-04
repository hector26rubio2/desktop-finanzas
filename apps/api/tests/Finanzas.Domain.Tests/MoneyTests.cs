using Finanzas.Domain.Common;
using Finanzas.Domain.ValueObjects;

namespace Finanzas.Domain.Tests;

public class MoneyTests
{
    [Fact]
    public void Redondea_a_la_escala_de_la_moneda_con_medio_hacia_arriba()
    {
        Assert.Equal(10.35m, Money.Of(10.345m, Given.Usd).Amount);
        Assert.Equal(10.34m, Money.Of(10.344m, Given.Usd).Amount);

        // Medio hacia arriba también en negativos: se aleja del cero.
        Assert.Equal(-10.35m, Money.Of(-10.345m, Given.Usd).Amount);
    }

    [Fact]
    public void No_usa_banker_rounding()
    {
        // Con MidpointRounding.ToEven esto sería 10,34.
        Assert.Equal(10.35m, Money.Of(10.345m, Given.Usd).Amount);

        // Con ToEven esto sería 0,12 (el par más cercano); con la política del
        // dominio es 0,13.
        Assert.Equal(0.13m, Money.Of(0.125m, Given.Usd).Amount);
    }

    [Fact]
    public void El_peso_colombiano_no_maneja_centavos()
    {
        Assert.Equal(0, Given.Cop.MinorUnits);
        Assert.Equal(1235m, Money.Of(1234.5m, Given.Cop).Amount);
        Assert.Equal(1234m, Money.Of(1234.49m, Given.Cop).Amount);
        Assert.Equal(-1235m, Money.Of(-1234.5m, Given.Cop).Amount);
    }

    [Fact]
    public void Respeta_las_monedas_sin_decimales()
    {
        var jpy = Currency.Of("JPY");
        Assert.Equal(0, jpy.MinorUnits);
        Assert.Equal(1235m, Money.Of(1234.5m, jpy).Amount);
    }

    [Fact]
    public void Exact_rechaza_un_importe_no_representable()
    {
        var enPesos = Assert.Throws<InvariantViolationException>(() => Money.Exact(10.5m, Given.Cop));
        Assert.Equal(DomainErrorCodes.InvalidScale, enPesos.Code);

        var enDolares = Assert.Throws<InvariantViolationException>(() => Money.Exact(10.345m, Given.Usd));
        Assert.Equal(DomainErrorCodes.InvalidScale, enDolares.Code);
    }

    [Fact]
    public void Sumar_monedas_distintas_es_imposible()
    {
        var error = Assert.Throws<CurrencyMismatchException>(() => Given.Money(100m) + Given.Usd_(100m));
        Assert.Equal(DomainErrorCodes.CurrencyMismatch, error.Code);
    }

    [Fact]
    public void Comparar_monedas_distintas_es_imposible()
    {
        Assert.Throws<CurrencyMismatchException>(() => Given.Money(100m) > Given.Usd_(1m));
    }

    [Fact]
    public void Allocate_reparte_pesos_enteros_sin_perder_ninguno()
    {
        var partes = Given.Money(100m).Allocate(3);

        Assert.Equal(3, partes.Length);
        Assert.Equal(Given.Money(100m), partes.Aggregate(Money.Zero(Given.Cop), (a, b) => a + b));
        Assert.Equal(new[] { 34m, 33m, 33m }, partes.Select(p => p.Amount));
    }

    [Fact]
    public void Allocate_reparte_centavos_en_monedas_de_dos_decimales()
    {
        var partes = Given.Usd_(100m).Allocate(3);

        Assert.Equal(Given.Usd_(100m), partes.Aggregate(Money.Zero(Given.Usd), (a, b) => a + b));
        Assert.Equal(new[] { 33.34m, 33.33m, 33.33m }, partes.Select(p => p.Amount));
    }

    [Fact]
    public void Allocate_de_un_peso_indivisible_no_inventa_fracciones()
    {
        // Un solo peso entre tres: alguien se lo lleva entero, nadie recibe 0,33.
        var partes = Given.Money(1m).Allocate(3);

        Assert.Equal(new[] { 1m, 0m, 0m }, partes.Select(p => p.Amount));
        Assert.Equal(Given.Money(1m), partes.Aggregate(Money.Zero(Given.Cop), (a, b) => a + b));
    }

    [Fact]
    public void Allocate_por_pesos_cuadra_exactamente()
    {
        var enPesos = Given.Money(5m).Allocate([1m, 1m, 1m]);
        Assert.Equal(new[] { 2m, 2m, 1m }, enPesos.Select(p => p.Amount));
        Assert.Equal(Given.Money(5m), enPesos.Aggregate(Money.Zero(Given.Cop), (a, b) => a + b));

        var enDolares = Given.Usd_(0.05m).Allocate([1m, 1m, 1m]);
        Assert.Equal(new[] { 0.02m, 0.02m, 0.01m }, enDolares.Select(p => p.Amount));
        Assert.Equal(Given.Usd_(0.05m), enDolares.Aggregate(Money.Zero(Given.Usd), (a, b) => a + b));
    }

    [Theory]
    [InlineData(1)]
    [InlineData(7)]
    [InlineData(100)]
    [InlineData(999_999)]
    [InlineData(1_234_567)]
    public void Allocate_en_pesos_siempre_suma_el_total(int total)
    {
        foreach (var partes in new[] { 2, 3, 6, 7, 11 })
        {
            var reparto = Given.Money(total).Allocate(partes);
            var suma = reparto.Aggregate(Money.Zero(Given.Cop), (a, b) => a + b);

            Assert.Equal(Given.Money(total), suma);
            Assert.All(reparto, p => Assert.Equal(decimal.Truncate(p.Amount), p.Amount));

            // El reparto es lo más parejo posible: nadie difiere en más de un peso.
            Assert.True(reparto.Max(p => p.Amount) - reparto.Min(p => p.Amount) <= 1m);
        }
    }

    [Theory]
    [InlineData(100, 70, 30)]
    [InlineData(1, 50, 50)]
    [InlineData(1_000_001, 33, 67)]
    [InlineData(7, 33.3333, 66.6667)]
    public void Allocate_en_pesos_con_pesos_desiguales_sigue_cuadrando(int total, double peso1, double peso2)
    {
        var reparto = Given.Money(total).Allocate([(decimal)peso1, (decimal)peso2]);

        Assert.Equal(Given.Money(total), reparto[0] + reparto[1]);
        Assert.All(reparto, p => Assert.False(p.IsNegative));
    }

    [Fact]
    public void Allocate_conserva_el_signo()
    {
        var partes = Given.Money(-10m).Allocate(3);

        Assert.All(partes, p => Assert.True(p.IsNegative));
        Assert.Equal(Given.Money(-10m), partes.Aggregate(Money.Zero(Given.Cop), (a, b) => a + b));
    }

    [Fact]
    public void Allocate_con_un_peso_cero_no_asigna_nada_a_esa_parte()
    {
        var partes = Given.Money(100m).Allocate([70m, 30m, 0m]);

        Assert.Equal(Given.Money(70m), partes[0]);
        Assert.Equal(Given.Money(30m), partes[1]);
        Assert.True(partes[2].IsZero);
    }

    [Fact]
    public void Dividir_por_cero_es_un_error_de_dominio()
    {
        var error = Assert.Throws<InvariantViolationException>(() => Given.Money(10m).Divide(0m));
        Assert.Equal(DomainErrorCodes.InvalidAmount, error.Code);
    }

    [Fact]
    public void La_igualdad_es_por_importe_y_moneda()
    {
        Assert.Equal(Given.Money(10m), Money.Of(10.000m, Currency.Of("cop")));
        Assert.NotEqual(Given.Money(10m), Given.Usd_(10m));
    }
}
