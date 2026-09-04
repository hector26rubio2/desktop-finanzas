using Finanzas.Domain.Common;
using Finanzas.Domain.Identifiers;
using Finanzas.Domain.Obligations;
using Finanzas.Domain.Settlements;
using Finanzas.Domain.ValueObjects;

namespace Finanzas.Domain.Tests;

public class SettlementTests
{
    private static readonly CounterpartyId Persona = CounterpartyId.New();
    private static readonly ObligationId Obligacion = ObligationId.New();
    private static readonly DateRange Marzo = DateRange.Month(2026, 3);

    private static SettlementLine Linea(
        ObligationEntryType tipo,
        DateOnly fecha,
        decimal capital,
        decimal interes) =>
        new(Obligacion, ObligationEntryId.New(), tipo, fecha, Given.Money(capital), Given.Money(interes));

    private static Settlement Liquidacion(IEnumerable<SettlementLine> lineas, decimal apertura = 0m) =>
        Settlement.Issue(
            SettlementId.New(),
            Persona,
            Marzo,
            new DateOnly(2026, 3, 31),
            Given.Cop,
            Given.Money(apertura),
            lineas,
            formulaVersion: 1,
            Given.Now);

    [Fact]
    public void Conserva_version_corte_y_entradas_utilizadas()
    {
        var lineas = new[]
        {
            Linea(ObligationEntryType.Charge, new DateOnly(2026, 3, 5), 200_000m, 0m),
            Linea(ObligationEntryType.Interest, new DateOnly(2026, 3, 31), 0m, 5_000m),
            Linea(ObligationEntryType.Payment, new DateOnly(2026, 3, 20), -50_000m, 0m),
        };

        var liquidacion = Liquidacion(lineas, apertura: 100_000m);

        Assert.Equal(1, liquidacion.FormulaVersion);
        Assert.Equal(new DateOnly(2026, 3, 31), liquidacion.CutOff);
        Assert.Equal(3, liquidacion.Lines.Count);
        Assert.Equal(Given.Money(200_000m), liquidacion.Charges);
        Assert.Equal(Given.Money(5_000m), liquidacion.Interest);
        Assert.Equal(Given.Money(50_000m), liquidacion.Payments);
        Assert.Equal(Given.Money(255_000m), liquidacion.ClosingBalance);

        liquidacion.EnsureBalanced();
    }

    [Fact]
    public void No_admite_entradas_posteriores_al_corte()
    {
        var error = Assert.Throws<InvariantViolationException>(() => Liquidacion(
            [Linea(ObligationEntryType.Charge, new DateOnly(2026, 4, 2), 100m, 0m)]));

        Assert.Equal(DomainErrorCodes.SettlementLineOutOfPeriod, error.Code);
    }

    [Fact]
    public void No_mezcla_monedas()
    {
        var linea = new SettlementLine(
            Obligacion,
            ObligationEntryId.New(),
            ObligationEntryType.Charge,
            new DateOnly(2026, 3, 5),
            Given.Usd_(100m),
            Given.Usd_(0m));

        var error = Assert.Throws<InvariantViolationException>(() => Liquidacion([linea]));
        Assert.Equal(DomainErrorCodes.CurrencyMismatch, error.Code);
    }

    [Fact]
    public void No_usa_dos_veces_el_mismo_asiento()
    {
        var linea = Linea(ObligationEntryType.Charge, new DateOnly(2026, 3, 5), 100m, 0m);

        var error = Assert.Throws<InvariantViolationException>(() => Liquidacion([linea, linea]));
        Assert.Equal(DomainErrorCodes.InvariantViolation, error.Code);
    }

    [Fact]
    public void El_corte_debe_caer_dentro_del_periodo()
    {
        var error = Assert.Throws<InvariantViolationException>(() => Settlement.Issue(
            SettlementId.New(),
            Persona,
            Marzo,
            new DateOnly(2026, 4, 15),
            Given.Cop,
            Given.Money(0m),
            [],
            1,
            Given.Now));

        Assert.Equal(DomainErrorCodes.InvalidDateRange, error.Code);
    }

    [Fact]
    public void Una_liquidacion_emitida_no_tiene_ningun_metodo_que_la_modifique()
    {
        var mutadores = typeof(Settlement)
            .GetMethods(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance)
            .Where(m => m.Name.StartsWith("set_", StringComparison.Ordinal))
            .ToArray();

        Assert.Empty(mutadores);
    }
}
