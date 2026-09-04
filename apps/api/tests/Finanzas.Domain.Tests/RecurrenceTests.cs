using Finanzas.Domain.Common;
using Finanzas.Domain.Identifiers;
using Finanzas.Domain.Ledger;
using Finanzas.Domain.Recurrences;

namespace Finanzas.Domain.Tests;

public class RecurrenceScheduleTests
{
    [Fact]
    public void Mensual_respeta_el_dia_nominal()
    {
        var programacion = RecurrenceSchedule.Create(
            RecurrenceFrequency.Monthly,
            1,
            new DateOnly(2026, 1, 5));

        Assert.Equal(new DateOnly(2026, 1, 5), programacion.FirstOccurrence());
        Assert.Equal(new DateOnly(2026, 2, 5), programacion.NextOccurrenceAfter(new DateOnly(2026, 1, 5)));
    }

    [Fact]
    public void Mensual_el_31_se_recorta_en_febrero_y_vuelve_en_marzo()
    {
        var programacion = RecurrenceSchedule.Create(
            RecurrenceFrequency.Monthly,
            1,
            new DateOnly(2026, 1, 31),
            dayOfMonth: 31);

        Assert.Equal(new DateOnly(2026, 2, 28), programacion.NextOccurrenceAfter(new DateOnly(2026, 1, 31)));
        Assert.Equal(new DateOnly(2026, 3, 31), programacion.NextOccurrenceAfter(new DateOnly(2026, 2, 28)));
    }

    [Fact]
    public void Mensual_el_29_existe_en_febrero_bisiesto()
    {
        var programacion = RecurrenceSchedule.Create(
            RecurrenceFrequency.Monthly,
            1,
            new DateOnly(2028, 1, 29),
            dayOfMonth: 29);

        Assert.Equal(new DateOnly(2028, 2, 29), programacion.NextOccurrenceAfter(new DateOnly(2028, 1, 29)));
    }

    [Fact]
    public void Bimestral_salta_un_mes()
    {
        var programacion = RecurrenceSchedule.Create(
            RecurrenceFrequency.Monthly,
            2,
            new DateOnly(2026, 1, 10));

        Assert.Equal(new DateOnly(2026, 3, 10), programacion.NextOccurrenceAfter(new DateOnly(2026, 1, 10)));
        Assert.Equal(new DateOnly(2026, 5, 10), programacion.NextOccurrenceAfter(new DateOnly(2026, 3, 10)));
    }

    [Fact]
    public void Semanal_cae_siempre_en_el_mismo_dia()
    {
        var programacion = RecurrenceSchedule.Create(
            RecurrenceFrequency.Weekly,
            1,
            new DateOnly(2026, 3, 2),
            dayOfWeek: DayOfWeek.Friday);

        var primera = programacion.FirstOccurrence();
        Assert.Equal(new DateOnly(2026, 3, 6), primera);
        Assert.Equal(DayOfWeek.Friday, primera!.Value.DayOfWeek);
        Assert.Equal(new DateOnly(2026, 3, 13), programacion.NextOccurrenceAfter(primera.Value));
    }

    [Fact]
    public void Diaria_cada_tres_dias()
    {
        var programacion = RecurrenceSchedule.Create(
            RecurrenceFrequency.Daily,
            3,
            new DateOnly(2026, 3, 1));

        Assert.Equal(new DateOnly(2026, 3, 4), programacion.NextOccurrenceAfter(new DateOnly(2026, 3, 1)));
        Assert.Equal(new DateOnly(2026, 3, 4), programacion.NextOccurrenceAfter(new DateOnly(2026, 3, 2)));
    }

    [Fact]
    public void Anual_conserva_mes_y_dia()
    {
        var programacion = RecurrenceSchedule.Create(
            RecurrenceFrequency.Yearly,
            1,
            new DateOnly(2026, 7, 20));

        Assert.Equal(new DateOnly(2027, 7, 20), programacion.NextOccurrenceAfter(new DateOnly(2026, 7, 20)));
    }

    [Fact]
    public void No_hay_ocurrencias_despues_del_fin()
    {
        var programacion = RecurrenceSchedule.Create(
            RecurrenceFrequency.Monthly,
            1,
            new DateOnly(2026, 1, 5),
            end: new DateOnly(2026, 2, 28));

        Assert.Null(programacion.NextOccurrenceAfter(new DateOnly(2026, 2, 5)));
    }

    [Fact]
    public void El_intervalo_debe_ser_al_menos_uno()
    {
        var error = Assert.Throws<InvariantViolationException>(
            () => RecurrenceSchedule.Create(RecurrenceFrequency.Monthly, 0, Given.Today));
        Assert.Equal(DomainErrorCodes.RecurrenceInvalidSchedule, error.Code);
    }
}

public class RecurrenceTests
{
    private static readonly AccountId Cuenta = AccountId.New();

    private static Recurrence Arriendo() => Recurrence.Create(
        RecurrenceId.New(),
        "Arriendo",
        MovementKind.Expense,
        Given.Money(1_800_000m),
        new MovementLinks { Account = Cuenta },
        RecurrenceSchedule.Create(RecurrenceFrequency.Monthly, 1, new DateOnly(2026, 1, 5)),
        Given.Now);

    [Fact]
    public void Un_recurrente_no_es_un_movimiento()
    {
        var recurrente = Arriendo();

        Assert.Empty(recurrente.MaterializedOccurrences);
        Assert.Equal(new DateOnly(2026, 1, 5), recurrente.NextOccurrence);
    }

    [Fact]
    public void Materializar_dos_veces_la_misma_ocurrencia_falla()
    {
        var recurrente = Arriendo();
        recurrente.ConfirmMaterialization(new DateOnly(2026, 1, 5), MovementId.New());

        var error = Assert.Throws<InvariantViolationException>(
            () => recurrente.ConfirmMaterialization(new DateOnly(2026, 1, 5), MovementId.New()));

        Assert.Equal(DomainErrorCodes.RecurrenceAlreadyMaterialized, error.Code);
        Assert.Single(recurrente.MaterializedOccurrences);
    }

    [Fact]
    public void Materializar_una_fecha_que_no_es_ocurrencia_falla()
    {
        var recurrente = Arriendo();

        var error = Assert.Throws<InvariantViolationException>(
            () => recurrente.ConfirmMaterialization(new DateOnly(2026, 1, 7), MovementId.New()));

        Assert.Equal(DomainErrorCodes.RecurrenceInvalidSchedule, error.Code);
    }

    [Fact]
    public void La_materializacion_avanza_a_la_siguiente_ocurrencia()
    {
        var recurrente = Arriendo();
        recurrente.ConfirmMaterialization(new DateOnly(2026, 1, 5), MovementId.New());

        Assert.Equal(new DateOnly(2026, 2, 5), recurrente.NextOccurrence);
    }

    [Fact]
    public void Un_recurrente_pausado_no_se_materializa()
    {
        var recurrente = Arriendo();
        recurrente.Pause();

        var error = Assert.Throws<InvariantViolationException>(
            () => recurrente.ConfirmMaterialization(new DateOnly(2026, 1, 5), MovementId.New()));

        Assert.Equal(DomainErrorCodes.RecurrenceFinished, error.Code);
    }

    [Fact]
    public void Reprogramar_no_puede_dejar_fuera_lo_ya_materializado()
    {
        var recurrente = Arriendo();
        recurrente.ConfirmMaterialization(new DateOnly(2026, 1, 5), MovementId.New());

        var error = Assert.Throws<InvariantViolationException>(() => recurrente.Reschedule(
            RecurrenceSchedule.Create(RecurrenceFrequency.Monthly, 1, new DateOnly(2026, 1, 20))));

        Assert.Equal(DomainErrorCodes.RecurrenceInvalidSchedule, error.Code);
    }

    [Fact]
    public void Create_no_admite_clases_compuestas()
    {
        // Una transferencia tiene dos patas: no se crea con la fábrica de una
        // sola pata, sino con CreateTransfer.
        var error = Assert.Throws<InvariantViolationException>(() => Recurrence.Create(
            RecurrenceId.New(),
            "Traslado",
            MovementKind.TransferOut,
            Given.Money(100m),
            new MovementLinks { Account = Cuenta },
            RecurrenceSchedule.Create(RecurrenceFrequency.Monthly, 1, Given.Today),
            Given.Now));

        Assert.Equal(DomainErrorCodes.RecurrenceInvalidSchedule, error.Code);
    }

    [Fact]
    public void El_destino_debe_producir_un_movimiento_legal()
    {
        // Un gasto exige cuenta: sin ella, el recurrente no se puede crear.
        var error = Assert.Throws<InvariantViolationException>(() => Recurrence.Create(
            RecurrenceId.New(),
            "Sin cuenta",
            MovementKind.Expense,
            Given.Money(100m),
            MovementLinks.Empty,
            RecurrenceSchedule.Create(RecurrenceFrequency.Monthly, 1, Given.Today),
            Given.Now));

        Assert.Equal(DomainErrorCodes.MovementLinkMissing, error.Code);
    }

    [Fact]
    public void Los_enlaces_de_materializacion_incluyen_el_recurrente()
    {
        var recurrente = Arriendo();
        var enlaces = recurrente.LinksForMaterialization();

        Assert.Equal(recurrente.Id, enlaces.Recurrence);

        var movimiento = Movement.Create(
            MovementId.New(),
            new DateOnly(2026, 1, 5),
            MovementKind.Expense,
            EconomicEffect.Expense,
            CashFlow.Outflow,
            Given.Amount(1_800_000m, new DateOnly(2026, 1, 5)),
            enlaces,
            Given.Now,
            MovementOrigin.RecurrenceMaterialization);

        Assert.Equal(MovementOrigin.RecurrenceMaterialization, movimiento.Origin);
    }
}
