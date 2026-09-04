using Finanzas.Domain.Common;
using Finanzas.Domain.Identifiers;
using Finanzas.Domain.Purchases;
using Finanzas.Domain.ValueObjects;

namespace Finanzas.Domain.Tests;

public class SharedPurchaseTests
{
    private static SharedPurchase Compra(decimal total = 300_000m) => SharedPurchase.Create(
        SharedPurchaseId.New(),
        MovementId.New(),
        CardId.New(),
        Given.Today,
        Given.Money(total),
        Given.Now,
        "Mercado compartido");

    [Fact]
    public void Sin_asignaciones_todo_es_del_titular()
    {
        var reparto = Compra().Resolve();

        Assert.Empty(reparto.Shares);
        Assert.Equal(Given.Money(300_000m), reparto.HolderPortion);
        Assert.Equal(Given.Money(0m), reparto.AssignedTotal);
    }

    [Fact]
    public void Asignar_la_compra_completa_deja_al_titular_en_cero()
    {
        var compra = Compra();
        compra.Assign(PurchaseShare.Full(CounterpartyId.New()));

        var reparto = compra.Resolve();

        Assert.Equal(Given.Money(300_000m), reparto.AssignedTotal);
        Assert.Equal(Given.Money(0m), reparto.HolderPortion);
    }

    [Fact]
    public void Tres_personas_a_un_tercio_no_pierden_un_solo_peso()
    {
        var compra = Compra(100m);
        var tercio = Percentage.FromPercent(100m / 3m);
        compra.Assign(PurchaseShare.OfPercentage(CounterpartyId.New(), tercio));
        compra.Assign(PurchaseShare.OfPercentage(CounterpartyId.New(), tercio));
        compra.Assign(PurchaseShare.OfPercentage(CounterpartyId.New(), tercio));

        var reparto = compra.Resolve();
        var suma = reparto.Shares.Aggregate(Money.Zero(Given.Cop), (total, s) => total + s.Amount);

        Assert.Equal(Given.Money(100m), suma + reparto.HolderPortion);
        Assert.Equal(new[] { 34m, 33m, 33m }, reparto.Shares.Select(s => s.Amount.Amount));
    }

    [Theory]
    [InlineData(1)]
    [InlineData(7)]
    [InlineData(101)]
    [InlineData(250_001)]
    public void Un_reparto_en_pesos_siempre_cuadra_con_el_total(int total)
    {
        var compra = Compra(total);
        var tercio = Percentage.FromPercent(100m / 3m);
        compra.Assign(PurchaseShare.OfPercentage(CounterpartyId.New(), tercio));
        compra.Assign(PurchaseShare.OfPercentage(CounterpartyId.New(), tercio));

        var reparto = compra.Resolve();
        var suma = reparto.Shares.Aggregate(Money.Zero(Given.Cop), (acc, s) => acc + s.Amount);

        Assert.Equal(Given.Money(total), suma + reparto.HolderPortion);
        Assert.False(reparto.HolderPortion.IsNegative);
        Assert.All(reparto.Shares, s => Assert.Equal(decimal.Truncate(s.Amount.Amount), s.Amount.Amount));
    }

    [Fact]
    public void El_titular_conserva_su_porcion()
    {
        var compra = Compra(300_000m);
        compra.Assign(PurchaseShare.OfPercentage(CounterpartyId.New(), Percentage.FromPercent(60m)));

        var reparto = compra.Resolve();

        Assert.Equal(Given.Money(180_000m), reparto.AssignedTotal);
        Assert.Equal(Given.Money(120_000m), reparto.HolderPortion);
    }

    [Fact]
    public void Mezcla_de_porcentaje_e_importe_fijo()
    {
        var compra = Compra(300_000m);
        compra.Assign(PurchaseShare.OfPercentage(CounterpartyId.New(), Percentage.FromPercent(50m)));
        compra.Assign(PurchaseShare.OfAmount(CounterpartyId.New(), Given.Money(100_000m)));

        var reparto = compra.Resolve();

        Assert.Equal(Given.Money(250_000m), reparto.AssignedTotal);
        Assert.Equal(Given.Money(50_000m), reparto.HolderPortion);
    }

    [Fact]
    public void Las_asignaciones_no_pueden_superar_el_total()
    {
        var compra = Compra(300_000m);
        compra.Assign(PurchaseShare.OfPercentage(CounterpartyId.New(), Percentage.FromPercent(70m)));

        var error = Assert.Throws<InvariantViolationException>(
            () => compra.Assign(PurchaseShare.OfPercentage(CounterpartyId.New(), Percentage.FromPercent(40m))));

        Assert.Equal(DomainErrorCodes.ShareExceedsTotal, error.Code);

        // La asignación rechazada no queda registrada.
        Assert.Single(compra.Shares);
    }

    [Fact]
    public void Los_importes_fijos_tampoco_pueden_superar_lo_disponible()
    {
        var compra = Compra(300_000m);
        compra.Assign(PurchaseShare.OfAmount(CounterpartyId.New(), Given.Money(200_000m)));

        var error = Assert.Throws<InvariantViolationException>(
            () => compra.Assign(PurchaseShare.OfAmount(CounterpartyId.New(), Given.Money(150_000m))));

        Assert.Equal(DomainErrorCodes.ShareExceedsTotal, error.Code);
    }

    [Fact]
    public void Una_persona_no_puede_tener_dos_partes()
    {
        var compra = Compra();
        var persona = CounterpartyId.New();
        compra.Assign(PurchaseShare.OfPercentage(persona, Percentage.FromPercent(10m)));

        var error = Assert.Throws<InvariantViolationException>(
            () => compra.Assign(PurchaseShare.OfPercentage(persona, Percentage.FromPercent(10m))));

        Assert.Equal(DomainErrorCodes.ShareDuplicateCounterparty, error.Code);
    }

    [Fact]
    public void La_parte_fija_debe_estar_en_la_moneda_de_la_compra()
    {
        var compra = Compra();

        var error = Assert.Throws<InvariantViolationException>(
            () => compra.Assign(PurchaseShare.OfAmount(CounterpartyId.New(), Given.Usd_(10m))));

        Assert.Equal(DomainErrorCodes.CurrencyMismatch, error.Code);
    }

    [Fact]
    public void El_redondeo_del_reparto_queda_registrado()
    {
        var compra = Compra(100m);
        var tercio = Percentage.FromPercent(100m / 3m);
        compra.Assign(PurchaseShare.OfPercentage(CounterpartyId.New(), tercio));
        compra.Assign(PurchaseShare.OfPercentage(CounterpartyId.New(), tercio));
        compra.Assign(PurchaseShare.OfPercentage(CounterpartyId.New(), tercio));

        var reparto = compra.Resolve();

        // El ajuste total es la diferencia frente al cálculo ingenuo: un peso.
        Assert.Equal(Given.Money(1m), reparto.RoundingAdjustment);
    }

    [Fact]
    public void La_obligacion_creada_se_enlaza_a_la_parte()
    {
        var compra = Compra();
        var persona = CounterpartyId.New();
        var obligacion = ObligationId.New();
        compra.Assign(PurchaseShare.Full(persona));

        compra.LinkObligation(persona, obligacion);

        Assert.Equal(obligacion, compra.Shares.Single().Obligation);
    }
}
