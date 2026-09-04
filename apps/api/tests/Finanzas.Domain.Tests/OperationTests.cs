using Finanzas.Domain.Common;
using Finanzas.Domain.Identifiers;
using Finanzas.Domain.Ledger;

namespace Finanzas.Domain.Tests;

public class OperationTests
{
    private static readonly AccountId Origen = AccountId.New();
    private static readonly AccountId Destino = AccountId.New();

    private static Movement Leg(OperationId operacion, MovementKind kind, CashFlow flow, decimal amount, AccountId cuenta) =>
        Movement.Create(
            MovementId.New(),
            Given.Today,
            kind,
            EconomicEffect.Neutral,
            flow,
            Given.Amount(amount),
            new MovementLinks { Account = cuenta, Operation = operacion },
            Given.Now);

    [Fact]
    public void Una_transferencia_cuadrada_es_valida()
    {
        var operacion = Operation.Create(OperationId.New(), OperationKind.Transfer, Given.Today, Given.Now);
        operacion.AddLeg(Leg(operacion.Id, MovementKind.TransferOut, CashFlow.Outflow, 250_000m, Origen));
        operacion.AddLeg(Leg(operacion.Id, MovementKind.TransferIn, CashFlow.Inflow, 250_000m, Destino));

        operacion.EnsureConsistent(Given.Cop);
    }

    [Fact]
    public void Una_transferencia_descuadrada_no_pasa()
    {
        var operacion = Operation.Create(OperationId.New(), OperationKind.Transfer, Given.Today, Given.Now);
        operacion.AddLeg(Leg(operacion.Id, MovementKind.TransferOut, CashFlow.Outflow, 250_000m, Origen));
        operacion.AddLeg(Leg(operacion.Id, MovementKind.TransferIn, CashFlow.Inflow, 240_000m, Destino));

        var error = Assert.Throws<InvariantViolationException>(() => operacion.EnsureConsistent(Given.Cop));
        Assert.Equal(DomainErrorCodes.OperationUnbalanced, error.Code);
    }

    [Fact]
    public void Una_transferencia_con_una_sola_pata_no_pasa()
    {
        var operacion = Operation.Create(OperationId.New(), OperationKind.Transfer, Given.Today, Given.Now);
        operacion.AddLeg(Leg(operacion.Id, MovementKind.TransferOut, CashFlow.Outflow, 250_000m, Origen));

        var error = Assert.Throws<InvariantViolationException>(() => operacion.EnsureConsistent(Given.Cop));
        Assert.Equal(DomainErrorCodes.OperationTooFewLegs, error.Code);
    }

    [Fact]
    public void Una_pata_ajena_no_se_puede_agregar()
    {
        var operacion = Operation.Create(OperationId.New(), OperationKind.Transfer, Given.Today, Given.Now);
        var ajena = Leg(OperationId.New(), MovementKind.TransferOut, CashFlow.Outflow, 100m, Origen);

        var error = Assert.Throws<InvariantViolationException>(() => operacion.AddLeg(ajena));
        Assert.Equal(DomainErrorCodes.OperationLegMismatch, error.Code);
    }

    [Fact]
    public void Reversar_las_dos_patas_deja_la_operacion_cuadrada()
    {
        var operacion = Operation.Create(OperationId.New(), OperationKind.Transfer, Given.Today, Given.Now);
        var salida = Leg(operacion.Id, MovementKind.TransferOut, CashFlow.Outflow, 250_000m, Origen);
        var entrada = Leg(operacion.Id, MovementKind.TransferIn, CashFlow.Inflow, 250_000m, Destino);
        operacion.AddLeg(salida);
        operacion.AddLeg(entrada);

        operacion.AddLeg(salida.Reverse(MovementId.New(), Given.Today, Given.Now));
        operacion.AddLeg(entrada.Reverse(MovementId.New(), Given.Today, Given.Now));

        operacion.EnsureConsistent(Given.Cop);
        Assert.Equal(4, operacion.Legs.Count);
    }

    [Fact]
    public void Reversar_una_sola_pata_descuadra_la_operacion()
    {
        var operacion = Operation.Create(OperationId.New(), OperationKind.Transfer, Given.Today, Given.Now);
        var salida = Leg(operacion.Id, MovementKind.TransferOut, CashFlow.Outflow, 250_000m, Origen);
        operacion.AddLeg(salida);
        operacion.AddLeg(Leg(operacion.Id, MovementKind.TransferIn, CashFlow.Inflow, 250_000m, Destino));
        operacion.AddLeg(salida.Reverse(MovementId.New(), Given.Today, Given.Now));

        var error = Assert.Throws<InvariantViolationException>(() => operacion.EnsureConsistent(Given.Cop));
        Assert.Equal(DomainErrorCodes.OperationUnbalanced, error.Code);
    }

    [Fact]
    public void Una_transferencia_entre_monedas_cuadra_en_moneda_base()
    {
        var operacion = Operation.Create(OperationId.New(), OperationKind.Transfer, Given.Today, Given.Now);

        operacion.AddLeg(Movement.Create(
            MovementId.New(),
            Given.Today,
            MovementKind.TransferOut,
            EconomicEffect.Neutral,
            CashFlow.Outflow,
            Given.AmountUsd(100m, 4000m),
            new MovementLinks { Account = Origen, Operation = operacion.Id },
            Given.Now));

        operacion.AddLeg(Leg(operacion.Id, MovementKind.TransferIn, CashFlow.Inflow, 400_000m, Destino));

        operacion.EnsureConsistent(Given.Cop);
    }
}
