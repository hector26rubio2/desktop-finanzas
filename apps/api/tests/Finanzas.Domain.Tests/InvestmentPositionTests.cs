using Finanzas.Domain.Common;
using Finanzas.Domain.Identifiers;
using Finanzas.Domain.Investments;
using Finanzas.Domain.Ledger;

namespace Finanzas.Domain.Tests;

public class InvestmentPositionTests
{
    private static InvestmentPosition Posicion() => InvestmentPosition.Create(
        PositionId.New(),
        "ETF mundial",
        "ETF",
        Given.Cop,
        RiskLevel.Medium,
        Given.Now,
        symbol: "vwce");

    private static InvestmentOperation Compra(decimal cantidad, decimal precio, DateOnly fecha) =>
        InvestmentOperation.Create(
            MovementId.New(),
            InvestmentOperationType.Buy,
            fecha,
            Given.Money(cantidad * precio),
            cantidad,
            precio);

    [Fact]
    public void La_cantidad_y_el_costo_se_derivan_de_las_operaciones()
    {
        var posicion = Posicion();
        posicion.RegisterOperation(Compra(10m, 100_000m, new DateOnly(2026, 1, 10)));
        posicion.RegisterOperation(Compra(10m, 120_000m, new DateOnly(2026, 2, 10)));

        Assert.Equal(20m, posicion.Quantity);
        Assert.Equal(Given.Money(2_200_000m), posicion.CostBasis);
        Assert.Equal(Given.Money(110_000m), posicion.AverageUnitCost);
    }

    [Fact]
    public void Vender_reduce_el_costo_a_promedio_ponderado()
    {
        var posicion = Posicion();
        posicion.RegisterOperation(Compra(10m, 100_000m, new DateOnly(2026, 1, 10)));
        posicion.RegisterOperation(Compra(10m, 120_000m, new DateOnly(2026, 2, 10)));
        posicion.RegisterOperation(InvestmentOperation.Create(
            MovementId.New(),
            InvestmentOperationType.Sell,
            new DateOnly(2026, 3, 10),
            Given.Money(1_500_000m),
            5m,
            150_000m));

        Assert.Equal(15m, posicion.Quantity);
        Assert.Equal(Given.Money(1_650_000m), posicion.CostBasis);
    }

    [Fact]
    public void No_se_puede_vender_mas_de_lo_que_se_tiene()
    {
        var posicion = Posicion();
        posicion.RegisterOperation(Compra(5m, 100_000m, new DateOnly(2026, 1, 10)));

        var error = Assert.Throws<InvariantViolationException>(() => posicion.RegisterOperation(
            InvestmentOperation.Create(
                MovementId.New(),
                InvestmentOperationType.Sell,
                new DateOnly(2026, 2, 10),
                Given.Money(600_000m),
                6m,
                100_000m)));

        Assert.Equal(DomainErrorCodes.PositionInsufficientQuantity, error.Code);
    }

    [Fact]
    public void Una_compra_exige_cantidad_y_precio()
    {
        var error = Assert.Throws<InvariantViolationException>(() => InvestmentOperation.Create(
            MovementId.New(),
            InvestmentOperationType.Buy,
            Given.Today,
            Given.Money(100m)));

        Assert.Equal(DomainErrorCodes.PositionInvalidOperation, error.Code);
    }

    [Fact]
    public void Un_aporte_no_lleva_cantidad_ni_precio()
    {
        var error = Assert.Throws<InvariantViolationException>(() => InvestmentOperation.Create(
            MovementId.New(),
            InvestmentOperationType.Contribution,
            Given.Today,
            Given.Money(100m),
            quantity: 1m));

        Assert.Equal(DomainErrorCodes.PositionInvalidOperation, error.Code);
    }

    [Fact]
    public void El_mismo_movimiento_no_se_registra_dos_veces()
    {
        var posicion = Posicion();
        var operacion = Compra(1m, 100m, Given.Today);
        posicion.RegisterOperation(operacion);

        var error = Assert.Throws<InvariantViolationException>(() => posicion.RegisterOperation(operacion));
        Assert.Equal(DomainErrorCodes.PositionInvalidOperation, error.Code);
    }

    [Fact]
    public void La_valoracion_no_es_flujo_de_caja()
    {
        var posicion = Posicion();
        posicion.RegisterOperation(Compra(10m, 100_000m, new DateOnly(2026, 1, 10)));
        posicion.AddValuation(Valuation.Create(
            ValuationId.New(),
            new DateOnly(2026, 3, 31),
            Given.Money(1_400_000m),
            ValuationSource.MarketPrice));

        // La revalorización aparece como ganancia no realizada...
        Assert.Equal(Given.Money(400_000m), posicion.UnrealizedGain(new DateOnly(2026, 3, 31)));

        // ...y no hay ninguna operación (ni movimiento) por ella.
        Assert.Single(posicion.Operations);
        Assert.Single(posicion.Valuations);
    }

    [Fact]
    public void Sin_valoracion_no_hay_valor_de_mercado()
    {
        var posicion = Posicion();
        Assert.Null(posicion.MarketValue(Given.Today));
        Assert.Null(posicion.UnrealizedGain(Given.Today));
    }

    [Fact]
    public void Cada_tipo_de_operacion_tiene_su_clase_de_movimiento()
    {
        Assert.Equal(
            MovementKind.InvestmentDividend,
            InvestmentOperation.MovementKindFor(InvestmentOperationType.Dividend));
        Assert.Equal(
            MovementKind.InvestmentSell,
            InvestmentOperation.MovementKindFor(InvestmentOperationType.Sell));
    }

    [Fact]
    public void La_operacion_debe_estar_en_la_moneda_de_la_posicion()
    {
        var posicion = Posicion();
        var error = Assert.Throws<InvariantViolationException>(() => posicion.RegisterOperation(
            InvestmentOperation.Create(
                MovementId.New(),
                InvestmentOperationType.Contribution,
                Given.Today,
                Given.Usd_(100m))));

        Assert.Equal(DomainErrorCodes.CurrencyMismatch, error.Code);
    }
}
