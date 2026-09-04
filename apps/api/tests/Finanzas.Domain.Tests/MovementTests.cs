using Finanzas.Domain.Common;
using Finanzas.Domain.Identifiers;
using Finanzas.Domain.Ledger;
using Finanzas.Domain.ValueObjects;

namespace Finanzas.Domain.Tests;

public class MovementTests
{
    private static readonly AccountId Cuenta = AccountId.New();

    [Fact]
    public void El_importe_debe_ser_positivo()
    {
        var error = Assert.Throws<InvariantViolationException>(() => Movement.Create(
            MovementId.New(),
            Given.Today,
            MovementKind.Expense,
            EconomicEffect.Expense,
            CashFlow.Outflow,
            Given.Amount(-100m),
            new MovementLinks { Account = Cuenta },
            Given.Now));

        Assert.Equal(DomainErrorCodes.MovementAmountNotPositive, error.Code);
    }

    [Fact]
    public void Un_gasto_no_puede_declararse_como_ingreso()
    {
        var error = Assert.Throws<InvariantViolationException>(() => Movement.Create(
            MovementId.New(),
            Given.Today,
            MovementKind.Expense,
            EconomicEffect.Income,
            CashFlow.Outflow,
            Given.Amount(100m),
            new MovementLinks { Account = Cuenta },
            Given.Now));

        Assert.Equal(DomainErrorCodes.MovementEffectNotAllowed, error.Code);
    }

    [Fact]
    public void Un_gasto_ordinario_exige_cuenta()
    {
        var error = Assert.Throws<InvariantViolationException>(() => Movement.Create(
            MovementId.New(),
            Given.Today,
            MovementKind.Expense,
            EconomicEffect.Expense,
            CashFlow.Outflow,
            Given.Amount(100m),
            MovementLinks.Empty,
            Given.Now));

        Assert.Equal(DomainErrorCodes.MovementLinkMissing, error.Code);
    }

    [Fact]
    public void Una_compra_con_tarjeta_no_puede_enlazar_una_cuenta()
    {
        var error = Assert.Throws<InvariantViolationException>(() => Movement.Create(
            MovementId.New(),
            Given.Today,
            MovementKind.CardPurchase,
            EconomicEffect.Expense,
            CashFlow.Outflow,
            Given.Amount(100m),
            new MovementLinks { Card = CardId.New(), Account = Cuenta },
            Given.Now));

        Assert.Equal(DomainErrorCodes.MovementLinkForbidden, error.Code);
    }

    [Fact]
    public void Un_pago_de_tarjeta_exige_exactamente_una_pata()
    {
        var operacion = OperationId.New();

        var error = Assert.Throws<InvariantViolationException>(() => Movement.Create(
            MovementId.New(),
            Given.Today,
            MovementKind.CardPayment,
            EconomicEffect.Neutral,
            CashFlow.Outflow,
            Given.Amount(100m),
            new MovementLinks { Operation = operacion, Account = Cuenta, Card = CardId.New() },
            Given.Now));

        Assert.Equal(DomainErrorCodes.MovementLinkExclusive, error.Code);
    }

    [Fact]
    public void Una_transferencia_no_admite_categoria()
    {
        var error = Assert.Throws<InvariantViolationException>(() => Movement.Create(
            MovementId.New(),
            Given.Today,
            MovementKind.TransferOut,
            EconomicEffect.Neutral,
            CashFlow.Outflow,
            Given.Amount(100m),
            new MovementLinks { Account = Cuenta, Operation = OperationId.New(), Category = CategoryId.New() },
            Given.Now));

        Assert.Equal(DomainErrorCodes.MovementLinkForbidden, error.Code);
    }

    [Fact]
    public void El_origen_de_recurrente_exige_el_enlace_al_recurrente()
    {
        var error = Assert.Throws<InvariantViolationException>(() => Movement.Create(
            MovementId.New(),
            Given.Today,
            MovementKind.Expense,
            EconomicEffect.Expense,
            CashFlow.Outflow,
            Given.Amount(100m),
            new MovementLinks { Account = Cuenta },
            Given.Now,
            MovementOrigin.RecurrenceMaterialization));

        Assert.Equal(DomainErrorCodes.MovementOriginMismatch, error.Code);
    }

    [Fact]
    public void El_signo_lo_dan_el_flujo_y_el_efecto_no_el_importe()
    {
        var gasto = Given.Expense(100m, Cuenta);

        Assert.Equal(Given.Money(100m), gasto.Amount.Original);
        Assert.Equal(Given.Money(-100m), gasto.SignedCashBase);
        Assert.Equal(Given.Money(-100m), gasto.SignedEconomicBase);
    }

    [Fact]
    public void Reversar_conserva_el_original_y_aporta_el_signo_contrario()
    {
        var gasto = Given.Expense(100m, Cuenta);
        var reverso = gasto.Reverse(MovementId.New(), Given.Today, Given.Now, "devolución");

        Assert.True(gasto.IsAnnulled);
        Assert.Equal(reverso.Id, gasto.ReversedBy);
        Assert.Equal(gasto.Id, reverso.ReversalOf);
        Assert.Equal(Given.Money(100m), reverso.Amount.Original);
        Assert.Equal(Given.Money(100m), reverso.SignedCashBase);
        Assert.Equal(Given.Money(0m), gasto.SignedCashBase + reverso.SignedCashBase);
    }

    [Fact]
    public void No_se_reversa_dos_veces()
    {
        var gasto = Given.Expense(100m, Cuenta);
        gasto.Reverse(MovementId.New(), Given.Today, Given.Now);

        var error = Assert.Throws<InvariantViolationException>(
            () => gasto.Reverse(MovementId.New(), Given.Today, Given.Now));
        Assert.Equal(DomainErrorCodes.MovementAlreadyReversed, error.Code);
    }

    [Fact]
    public void No_se_reversa_un_reverso()
    {
        var gasto = Given.Expense(100m, Cuenta);
        var reverso = gasto.Reverse(MovementId.New(), Given.Today, Given.Now);

        var error = Assert.Throws<InvariantViolationException>(
            () => reverso.Reverse(MovementId.New(), Given.Today, Given.Now));
        Assert.Equal(DomainErrorCodes.MovementReversalOfReversal, error.Code);
    }

    [Fact]
    public void El_reverso_no_puede_ser_anterior_al_original()
    {
        var gasto = Given.Expense(100m, Cuenta);

        var error = Assert.Throws<InvariantViolationException>(
            () => gasto.Reverse(MovementId.New(), Given.Today.AddDays(-1), Given.Now));
        Assert.Equal(DomainErrorCodes.InvalidDateRange, error.Code);
    }

    [Fact]
    public void Reclasificar_no_toca_el_dinero()
    {
        var gasto = Given.Expense(100m, Cuenta);
        var categoria = CategoryId.New();

        gasto.Reclassify(categoria, "mercado");

        Assert.Equal(categoria, gasto.Links.Category);
        Assert.Equal("mercado", gasto.Description);
        Assert.Equal(Given.Money(100m), gasto.Amount.Original);
    }

    [Fact]
    public void Conserva_moneda_original_y_moneda_base()
    {
        var movimiento = Movement.Create(
            MovementId.New(),
            Given.Today,
            MovementKind.Expense,
            EconomicEffect.Expense,
            CashFlow.Outflow,
            Given.AmountUsd(50m, 4000m),
            new MovementLinks { Account = Cuenta },
            Given.Now);

        Assert.Equal(Given.Usd_(50m), movimiento.Amount.Original);
        Assert.Equal(Given.Money(200_000m), movimiento.Amount.Base);
        Assert.Equal(4000m, movimiento.Amount.Rate.Rate);
    }
}

public class MovementKindSpecTests
{
    [Fact]
    public void Toda_clase_de_movimiento_tiene_especificacion()
    {
        foreach (var kind in Enum.GetValues<MovementKind>())
        {
            var spec = MovementKindSpec.For(kind);
            Assert.Equal(kind, spec.Kind);
            Assert.NotEmpty(spec.AllowedEffects);
            Assert.NotEmpty(spec.AllowedFlows);
        }
    }

    [Fact]
    public void Ningun_enlace_es_obligatorio_y_prohibido_a_la_vez() =>
        Assert.All(
            MovementKindSpec.All,
            spec => Assert.Equal(MovementLink.None, spec.Required & spec.Forbidden));

    [Fact]
    public void Lo_que_siempre_es_neutro_no_admite_categoria() =>
        Assert.All(
            MovementKindSpec.All.Where(spec => spec.IsAlwaysNeutral),
            spec => Assert.True(spec.Forbidden.HasFlag(MovementLink.Category), $"{spec.Kind} admite categoría"));

    [Fact]
    public void Un_abono_nunca_es_gasto_ni_ingreso()
    {
        var spec = MovementKindSpec.For(MovementKind.LoanRepayment);
        Assert.True(spec.IsAlwaysNeutral);
    }

    [Fact]
    public void Un_cargo_a_una_persona_no_mueve_caja()
    {
        var spec = MovementKindSpec.For(MovementKind.LoanCharge);
        Assert.Single(spec.AllowedFlows);
        Assert.Contains(CashFlow.None, spec.AllowedFlows);
    }
}
