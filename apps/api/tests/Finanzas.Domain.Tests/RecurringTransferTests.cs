using Finanzas.Domain.Common;
using Finanzas.Domain.Identifiers;
using Finanzas.Domain.Ledger;
using Finanzas.Domain.Recurrences;

namespace Finanzas.Domain.Tests;

/// <summary>
/// Transferencias recurrentes (ahorro automático). Dos patas, una operación y
/// una materialización que no se puede dejar a medias.
/// </summary>
public class RecurringTransferTests
{
    private static readonly AccountId Nomina = AccountId.New();
    private static readonly AccountId Ahorro = AccountId.New();
    private static readonly DateOnly Inicio = new(2026, 1, 5);

    private static Recurrence AhorroAutomatico(decimal importe = 500_000m) => Recurrence.CreateTransfer(
        RecurrenceId.New(),
        "Ahorro automático",
        Given.Money(importe),
        Nomina,
        Ahorro,
        RecurrenceSchedule.Create(RecurrenceFrequency.Monthly, 1, Inicio),
        Given.Now);

    [Fact]
    public void Una_transferencia_recurrente_declara_sus_dos_cuentas()
    {
        var recurrente = AhorroAutomatico();

        Assert.Equal(RecurrenceKind.Transfer, recurrente.Kind);
        Assert.True(recurrente.IsTransfer);
        Assert.Equal(2, recurrente.LegCount);
        Assert.Equal(Nomina, recurrente.SourceAccount);
        Assert.Equal(Ahorro, recurrente.DestinationAccount);
        Assert.Null(recurrente.MovementTemplate);
    }

    [Fact]
    public void Origen_y_destino_deben_ser_cuentas_distintas()
    {
        var error = Assert.Throws<InvariantViolationException>(() => Recurrence.CreateTransfer(
            RecurrenceId.New(),
            "Círculo",
            Given.Money(100m),
            Nomina,
            Nomina,
            RecurrenceSchedule.Create(RecurrenceFrequency.Monthly, 1, Inicio),
            Given.Now));

        Assert.Equal(DomainErrorCodes.RecurrenceInvalidSchedule, error.Code);
    }

    [Fact]
    public void Planifica_dos_patas_neutras_unidas_por_la_operacion()
    {
        var recurrente = AhorroAutomatico();
        var operacion = OperationId.New();

        var patas = recurrente.PlanLegs(operacion);

        Assert.Equal(2, patas.Count);

        var salida = patas[0];
        Assert.Equal(MovementKind.TransferOut, salida.Kind);
        Assert.Equal(EconomicEffect.Neutral, salida.Effect);
        Assert.Equal(CashFlow.Outflow, salida.Flow);
        Assert.Equal(Nomina, salida.Links.Account);

        var entrada = patas[1];
        Assert.Equal(MovementKind.TransferIn, entrada.Kind);
        Assert.Equal(EconomicEffect.Neutral, entrada.Effect);
        Assert.Equal(CashFlow.Inflow, entrada.Flow);
        Assert.Equal(Ahorro, entrada.Links.Account);

        // Las dos patas comparten operación y apuntan al recurrente.
        Assert.All(patas, pata => Assert.Equal(operacion, pata.Links.Operation));
        Assert.All(patas, pata => Assert.Equal(recurrente.Id, pata.Links.Recurrence));
    }

    [Fact]
    public void Ahorrar_no_es_gasto()
    {
        var recurrente = AhorroAutomatico();
        Assert.All(recurrente.PlanLegs(OperationId.New()), pata => Assert.Equal(EconomicEffect.Neutral, pata.Effect));
    }

    [Fact]
    public void Planificar_sin_operacion_falla()
    {
        var error = Assert.Throws<InvariantViolationException>(() => AhorroAutomatico().PlanLegs());
        Assert.Equal(DomainErrorCodes.RecurrenceKindMismatch, error.Code);
    }

    [Fact]
    public void Un_recurrente_de_una_pata_no_admite_operacion()
    {
        var recurrente = Recurrence.Create(
            RecurrenceId.New(),
            "Arriendo",
            MovementKind.Expense,
            Given.Money(1_800_000m),
            new MovementLinks { Account = Nomina },
            RecurrenceSchedule.Create(RecurrenceFrequency.Monthly, 1, Inicio),
            Given.Now);

        var error = Assert.Throws<InvariantViolationException>(() => recurrente.PlanLegs(OperationId.New()));
        Assert.Equal(DomainErrorCodes.RecurrenceKindMismatch, error.Code);
        Assert.Single(recurrente.PlanLegs());
    }

    [Fact]
    public void Las_patas_planificadas_construyen_una_operacion_que_cuadra()
    {
        var recurrente = AhorroAutomatico();
        var operacion = Operation.Create(
            OperationId.New(),
            OperationKind.Transfer,
            Inicio,
            Given.Now,
            idempotencyKey: $"recurrence:{recurrente.Id}:2026-01-05");

        foreach (var pata in recurrente.PlanLegs(operacion.Id))
        {
            operacion.AddLeg(Movement.Create(
                MovementId.New(),
                Inicio,
                pata.Kind,
                pata.Effect,
                pata.Flow,
                Given.Amount(500_000m, Inicio),
                pata.Links with { Operation = operacion.Id },
                Given.Now,
                MovementOrigin.RecurrenceMaterialization));
        }

        // La operación cuadra en moneda base: nada se crea ni se pierde.
        operacion.EnsureConsistent(Given.Cop);

        // Y el saldo se mueve de una cuenta a la otra, sin tocar el resultado.
        var movimientos = operacion.Legs;
        Assert.Equal(Given.Money(-500_000m), LedgerProjections.AccountBalance(movimientos, Nomina, Given.Cop));
        Assert.Equal(Given.Money(500_000m), LedgerProjections.AccountBalance(movimientos, Ahorro, Given.Cop));

        var resumen = LedgerProjections.Summarize(
            movimientos,
            ValueObjects.DateRange.Month(2026, 1),
            Given.Cop);
        Assert.Equal(Given.Money(0m), resumen.Income);
        Assert.Equal(Given.Money(0m), resumen.Expense);
    }

    [Fact]
    public void La_materializacion_registra_las_dos_patas_juntas()
    {
        var recurrente = AhorroAutomatico();
        var operacion = OperationId.New();
        var salida = MovementId.New();
        var entrada = MovementId.New();

        var materializacion = recurrente.ConfirmTransferMaterialization(Inicio, operacion, salida, entrada);

        Assert.Equal(Inicio, materializacion.Occurrence);
        Assert.Equal(operacion, materializacion.Operation);
        Assert.Equal(new[] { salida, entrada }, materializacion.Movements);
        Assert.Equal(materializacion, recurrente.MaterializationFor(Inicio));
    }

    [Fact]
    public void No_se_puede_materializar_media_transferencia()
    {
        var recurrente = AhorroAutomatico();

        var error = Assert.Throws<InvariantViolationException>(
            () => recurrente.ConfirmMaterialization(Inicio, MovementId.New()));

        Assert.Equal(DomainErrorCodes.RecurrenceKindMismatch, error.Code);
        Assert.Empty(recurrente.MaterializedOccurrences);
    }

    [Fact]
    public void Las_dos_patas_deben_ser_movimientos_distintos()
    {
        var recurrente = AhorroAutomatico();
        var mismo = MovementId.New();

        var error = Assert.Throws<InvariantViolationException>(
            () => recurrente.ConfirmTransferMaterialization(Inicio, OperationId.New(), mismo, mismo));

        Assert.Equal(DomainErrorCodes.RecurrenceKindMismatch, error.Code);
        Assert.Empty(recurrente.MaterializedOccurrences);
    }

    [Fact]
    public void Materializar_dos_veces_la_misma_ocurrencia_no_duplica_el_ahorro()
    {
        var recurrente = AhorroAutomatico();
        recurrente.ConfirmTransferMaterialization(Inicio, OperationId.New(), MovementId.New(), MovementId.New());

        var error = Assert.Throws<InvariantViolationException>(() => recurrente.ConfirmTransferMaterialization(
            Inicio, OperationId.New(), MovementId.New(), MovementId.New()));

        Assert.Equal(DomainErrorCodes.RecurrenceAlreadyMaterialized, error.Code);
        Assert.Single(recurrente.MaterializedOccurrences);
        Assert.Equal(2, recurrente.MaterializationFor(Inicio)!.Movements.Count);
    }

    [Fact]
    public void La_materializacion_avanza_a_la_siguiente_ocurrencia()
    {
        var recurrente = AhorroAutomatico();
        recurrente.ConfirmTransferMaterialization(Inicio, OperationId.New(), MovementId.New(), MovementId.New());

        Assert.Equal(new DateOnly(2026, 2, 5), recurrente.NextOccurrence);
    }

    [Fact]
    public void Una_transferencia_pausada_no_se_materializa()
    {
        var recurrente = AhorroAutomatico();
        recurrente.Pause();

        var error = Assert.Throws<InvariantViolationException>(() => recurrente.ConfirmTransferMaterialization(
            Inicio, OperationId.New(), MovementId.New(), MovementId.New()));

        Assert.Equal(DomainErrorCodes.RecurrenceFinished, error.Code);
    }

    [Fact]
    public void Una_transferencia_no_admite_categoria_ni_destino_de_una_pata()
    {
        var recurrente = AhorroAutomatico();

        var porEnlaces = Assert.Throws<InvariantViolationException>(
            () => recurrente.Retarget(new MovementLinks { Account = Nomina }));
        Assert.Equal(DomainErrorCodes.RecurrenceKindMismatch, porEnlaces.Code);

        var porLinks = Assert.Throws<InvariantViolationException>(() => recurrente.LinksForMaterialization());
        Assert.Equal(DomainErrorCodes.RecurrenceKindMismatch, porLinks.Code);

        // La especificación del ledger ya prohíbe categorizar una transferencia.
        Assert.True(MovementKindSpec.For(MovementKind.TransferOut).Forbidden.HasFlag(MovementLink.Category));
    }

    [Fact]
    public void Se_pueden_cambiar_las_cuentas_de_la_transferencia()
    {
        var recurrente = AhorroAutomatico();
        var nuevaMeta = AccountId.New();

        recurrente.RetargetTransfer(Nomina, nuevaMeta);

        Assert.Equal(nuevaMeta, recurrente.DestinationAccount);
        Assert.Equal(nuevaMeta, recurrente.PlanLegs(OperationId.New())[1].Links.Account);
    }
}
