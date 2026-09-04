using Finanzas.Domain.Common;
using Finanzas.Domain.Identifiers;
using Finanzas.Domain.Ledger;
using Finanzas.Domain.ValueObjects;

namespace Finanzas.Domain.Recurrences;

/// <summary>Forma del recurrente: cuántas patas produce al materializarse.</summary>
public enum RecurrenceKind
{
    /// <summary>Una sola pata: ingreso, gasto o compra con tarjeta.</summary>
    SingleMovement = 1,

    /// <summary>
    /// Dos patas unidas por una operación: transferencia entre cuentas propias
    /// (ahorro automático). El pago de tarjeta recurrente, si algún día se
    /// pide, encaja en este mismo mecanismo de varias patas.
    /// </summary>
    Transfer = 2,
}

/// <summary>
/// Pata que debe crearse al materializar una ocurrencia. La capa de aplicación
/// la traduce a un <see cref="Movement"/>; el dominio ya garantizó que la
/// combinación es legal contra <see cref="MovementKindSpec"/>.
/// </summary>
public sealed record RecurrenceLeg(
    MovementKind Kind,
    EconomicEffect Effect,
    CashFlow Flow,
    MovementLinks Links);

/// <summary>
/// Registro de una ocurrencia ya materializada: qué operación y qué movimientos
/// la representan en el ledger.
/// </summary>
public sealed record RecurrenceMaterialization(
    DateOnly Occurrence,
    OperationId? Operation,
    IReadOnlyList<MovementId> Movements);

/// <summary>
/// Recurrente: la plantilla de una operación que se repite. No es un
/// movimiento; solo cuando se materializa nacen filas reales en el ledger
/// (§4.1: "materialización de recurrente").
/// </summary>
/// <remarks>
/// <para><b>Idempotencia (regla financiera 7).</b> El agregado recuerda qué
/// ocurrencias ya se materializaron. Reintentar la materialización de la misma
/// fecha falla en vez de duplicar el gasto, aunque el proceso se ejecute dos
/// veces.</para>
/// <para><b>Atomicidad de la transferencia.</b> Una transferencia recurrente
/// tiene dos patas y una sola operación. El agregado no admite registrar media
/// materialización: <see cref="ConfirmTransferMaterialization"/> exige las dos
/// patas y la operación en la misma llamada, así que no existe el estado
/// "salió el dinero pero no entró". El <i>commit</i> transaccional es
/// responsabilidad de Application/Infrastructure; aquí queda cerrada la puerta
/// a que el modelo represente una materialización a medias.</para>
/// </remarks>
public sealed class Recurrence : AggregateRoot<RecurrenceId>
{
    private static readonly MovementKind[] AllowedSingleKinds =
    [
        MovementKind.Income,
        MovementKind.Expense,
        MovementKind.CardPurchase,
    ];

    private readonly Dictionary<DateOnly, RecurrenceMaterialization> _materialized = [];

    private Recurrence(
        RecurrenceId id,
        string name,
        RecurrenceKind kind,
        MovementKind? movementTemplate,
        Money amount,
        MovementLinks target,
        AccountId? sourceAccount,
        AccountId? destinationAccount,
        RecurrenceSchedule schedule,
        DateTimeOffset createdAt)
        : base(id)
    {
        Name = name;
        Kind = kind;
        MovementTemplate = movementTemplate;
        Amount = amount;
        Target = target;
        SourceAccount = sourceAccount;
        DestinationAccount = destinationAccount;
        Schedule = schedule;
        CreatedAt = createdAt;
        IsActive = true;
    }

    public string Name { get; private set; }

    /// <summary>Forma del recurrente: una pata o transferencia de dos.</summary>
    public RecurrenceKind Kind { get; }

    /// <summary>Clase de movimiento que generará. Solo en recurrentes de una pata.</summary>
    public MovementKind? MovementTemplate { get; }

    public Money Amount { get; private set; }

    /// <summary>
    /// Enlaces de destino (cuenta o tarjeta, y categoría). Vacío en una
    /// transferencia, que usa <see cref="SourceAccount"/> y
    /// <see cref="DestinationAccount"/>.
    /// </summary>
    public MovementLinks Target { get; private set; }

    /// <summary>Cuenta de origen de la transferencia.</summary>
    public AccountId? SourceAccount { get; private set; }

    /// <summary>Cuenta de destino de la transferencia (ahorro automático).</summary>
    public AccountId? DestinationAccount { get; private set; }

    public RecurrenceSchedule Schedule { get; private set; }

    public bool IsActive { get; private set; }

    public DateTimeOffset CreatedAt { get; }

    public bool IsTransfer => Kind == RecurrenceKind.Transfer;

    /// <summary>Número de movimientos que produce cada materialización.</summary>
    public int LegCount => IsTransfer ? 2 : 1;

    /// <summary>Ocurrencias ya materializadas, en orden.</summary>
    public IReadOnlyCollection<DateOnly> MaterializedOccurrences => _materialized.Keys.Order().ToArray();

    public DateOnly? LastMaterializedOccurrence =>
        _materialized.Count == 0 ? null : _materialized.Keys.Max();

    /// <summary>Materialización de una ocurrencia, si ya ocurrió.</summary>
    public RecurrenceMaterialization? MaterializationFor(DateOnly occurrence) =>
        _materialized.TryGetValue(occurrence, out var materialization) ? materialization : null;

    /// <summary>Movimiento que materializó una ocurrencia de una sola pata.</summary>
    public MovementId? MovementFor(DateOnly occurrence) =>
        MaterializationFor(occurrence)?.Movements.FirstOrDefault();

    /// <summary>Próxima ocurrencia pendiente de materializar.</summary>
    public DateOnly? NextOccurrence => LastMaterializedOccurrence is { } last
        ? Schedule.NextOccurrenceAfter(last)
        : Schedule.FirstOccurrence();

    /// <summary>Recurrente de una sola pata: ingreso, gasto o compra con tarjeta.</summary>
    public static Recurrence Create(
        RecurrenceId id,
        string name,
        MovementKind kind,
        Money amount,
        MovementLinks target,
        RecurrenceSchedule schedule,
        DateTimeOffset createdAt)
    {
        Guard.NotNull(amount);
        Guard.NotNull(target);
        Guard.NotNull(schedule);

        Guard.Require(
            AllowedSingleKinds.Contains(kind),
            DomainErrorCodes.RecurrenceInvalidSchedule,
            $"Un recurrente de una sola pata no genera movimientos de clase {kind} " +
            $"(admitidas: {string.Join(", ", AllowedSingleKinds)}). Para transferencias use CreateTransfer.");

        Guard.Positive(amount.Amount, DomainErrorCodes.InvalidAmount, nameof(amount));

        // El destino debe producir un movimiento legal: se valida contra la
        // misma especificación del ledger, incluyendo el enlace al recurrente.
        ValidateSingleTarget(id, kind, target);

        return new Recurrence(
            id,
            Guard.NotBlank(name),
            RecurrenceKind.SingleMovement,
            kind,
            amount,
            target,
            sourceAccount: null,
            destinationAccount: null,
            schedule,
            createdAt);
    }

    /// <summary>
    /// Transferencia recurrente entre cuentas propias (ahorro automático).
    /// Produce dos patas neutras unidas por una operación: mover dinero entre
    /// cuentas propias nunca es ingreso ni gasto.
    /// </summary>
    public static Recurrence CreateTransfer(
        RecurrenceId id,
        string name,
        Money amount,
        AccountId sourceAccount,
        AccountId destinationAccount,
        RecurrenceSchedule schedule,
        DateTimeOffset createdAt)
    {
        Guard.NotNull(amount);
        Guard.NotNull(schedule);
        Guard.Positive(amount.Amount, DomainErrorCodes.InvalidAmount, nameof(amount));

        Guard.Require(
            sourceAccount != destinationAccount,
            DomainErrorCodes.RecurrenceInvalidSchedule,
            "Una transferencia recurrente necesita dos cuentas distintas.");

        return new Recurrence(
            id,
            Guard.NotBlank(name),
            RecurrenceKind.Transfer,
            movementTemplate: null,
            amount,
            MovementLinks.Empty,
            sourceAccount,
            destinationAccount,
            schedule,
            createdAt);
    }

    /// <summary>
    /// Patas que hay que crear para materializar una ocurrencia. Ya vienen
    /// validadas contra la especificación del ledger: si este método devuelve
    /// algo, los movimientos correspondientes se pueden construir.
    /// </summary>
    /// <param name="operation">
    /// Operación que une las patas. Obligatoria en una transferencia; prohibida
    /// en un recurrente de una sola pata.
    /// </param>
    public IReadOnlyList<RecurrenceLeg> PlanLegs(OperationId? operation = null)
    {
        if (!IsTransfer)
        {
            Guard.Require(
                operation is null,
                DomainErrorCodes.RecurrenceKindMismatch,
                $"El recurrente '{Name}' produce una sola pata y no necesita operación.");

            var kind = MovementTemplate!.Value;
            var (effect, flow) = EffectAndFlowFor(kind);
            return [new RecurrenceLeg(kind, effect, flow, LinksForMaterialization())];
        }

        Guard.Require(
            operation is not null,
            DomainErrorCodes.RecurrenceKindMismatch,
            $"La transferencia recurrente '{Name}' exige una operación que una sus dos patas.");

        var salida = new MovementLinks
        {
            Account = SourceAccount,
            Operation = operation,
            Recurrence = Id,
        };

        var entrada = new MovementLinks
        {
            Account = DestinationAccount,
            Operation = operation,
            Recurrence = Id,
        };

        MovementKindSpec.For(MovementKind.TransferOut).Validate(EconomicEffect.Neutral, CashFlow.Outflow, salida);
        MovementKindSpec.For(MovementKind.TransferIn).Validate(EconomicEffect.Neutral, CashFlow.Inflow, entrada);

        return
        [
            new RecurrenceLeg(MovementKind.TransferOut, EconomicEffect.Neutral, CashFlow.Outflow, salida),
            new RecurrenceLeg(MovementKind.TransferIn, EconomicEffect.Neutral, CashFlow.Inflow, entrada),
        ];
    }

    /// <summary>
    /// Registra que una ocurrencia de una sola pata se materializó en un
    /// movimiento. Falla si la ocurrencia no pertenece a la programación o si
    /// ya se materializó antes.
    /// </summary>
    public RecurrenceMaterialization ConfirmMaterialization(DateOnly occurrence, MovementId movementId)
    {
        Guard.Require(
            !IsTransfer,
            DomainErrorCodes.RecurrenceKindMismatch,
            $"'{Name}' es una transferencia recurrente: use ConfirmTransferMaterialization con sus dos patas.");

        return Record(new RecurrenceMaterialization(occurrence, Operation: null, [movementId]));
    }

    /// <summary>
    /// Registra la materialización de una transferencia recurrente. Exige la
    /// operación y las dos patas juntas: el modelo no puede representar una
    /// transferencia a medias.
    /// </summary>
    public RecurrenceMaterialization ConfirmTransferMaterialization(
        DateOnly occurrence,
        OperationId operation,
        MovementId outgoingLeg,
        MovementId incomingLeg)
    {
        Guard.Require(
            IsTransfer,
            DomainErrorCodes.RecurrenceKindMismatch,
            $"'{Name}' produce una sola pata: use ConfirmMaterialization.");

        Guard.Require(
            outgoingLeg != incomingLeg,
            DomainErrorCodes.RecurrenceKindMismatch,
            "Las dos patas de una transferencia deben ser movimientos distintos.");

        return Record(new RecurrenceMaterialization(occurrence, operation, [outgoingLeg, incomingLeg]));
    }

    /// <summary>Enlaces que debe llevar el movimiento de un recurrente de una pata.</summary>
    public MovementLinks LinksForMaterialization()
    {
        Guard.Require(
            !IsTransfer,
            DomainErrorCodes.RecurrenceKindMismatch,
            $"'{Name}' es una transferencia: use PlanLegs con su operación.");

        return Target with { Recurrence = Id };
    }

    public void UpdateAmount(Money amount)
    {
        Guard.NotNull(amount);
        Guard.Positive(amount.Amount, DomainErrorCodes.InvalidAmount, nameof(amount));
        Guard.Require(
            amount.Currency == Amount.Currency,
            DomainErrorCodes.CurrencyMismatch,
            "Cambiar la moneda de un recurrente invalidaría su histórico; cree uno nuevo.");
        Amount = amount;
    }

    public void Reschedule(RecurrenceSchedule schedule)
    {
        Guard.NotNull(schedule);

        // Reprogramar no reescribe el pasado: las ocurrencias ya materializadas
        // deben seguir siendo válidas en la nueva programación
        // (regla financiera 8).
        foreach (var occurrence in _materialized.Keys)
        {
            Guard.Require(
                schedule.IsOccurrence(occurrence),
                DomainErrorCodes.RecurrenceInvalidSchedule,
                $"La nueva programación deja fuera la ocurrencia ya materializada {occurrence:yyyy-MM-dd}.");
        }

        Schedule = schedule;
    }

    public void Retarget(MovementLinks target)
    {
        Guard.Require(
            !IsTransfer,
            DomainErrorCodes.RecurrenceKindMismatch,
            $"'{Name}' es una transferencia: use RetargetTransfer.");

        ValidateSingleTarget(Id, MovementTemplate!.Value, Guard.NotNull(target));
        Target = target;
    }

    /// <summary>Cambia las cuentas de una transferencia recurrente.</summary>
    public void RetargetTransfer(AccountId sourceAccount, AccountId destinationAccount)
    {
        Guard.Require(
            IsTransfer,
            DomainErrorCodes.RecurrenceKindMismatch,
            $"'{Name}' no es una transferencia: use Retarget.");

        Guard.Require(
            sourceAccount != destinationAccount,
            DomainErrorCodes.RecurrenceInvalidSchedule,
            "Una transferencia recurrente necesita dos cuentas distintas.");

        SourceAccount = sourceAccount;
        DestinationAccount = destinationAccount;
    }

    public void Rename(string name) => Name = Guard.NotBlank(name);

    public void Pause() => IsActive = false;

    public void Resume() => IsActive = true;

    private RecurrenceMaterialization Record(RecurrenceMaterialization materialization)
    {
        Guard.Require(
            IsActive,
            DomainErrorCodes.RecurrenceFinished,
            $"El recurrente '{Name}' está pausado y no puede materializarse.");

        Guard.Require(
            Schedule.IsOccurrence(materialization.Occurrence),
            DomainErrorCodes.RecurrenceInvalidSchedule,
            $"{materialization.Occurrence:yyyy-MM-dd} no es una ocurrencia de la programación {Schedule}.");

        Guard.Require(
            materialization.Movements.Count == LegCount,
            DomainErrorCodes.RecurrenceKindMismatch,
            $"'{Name}' produce {LegCount} movimiento(s) por ocurrencia y se recibieron {materialization.Movements.Count}.");

        Guard.Require(
            _materialized.TryAdd(materialization.Occurrence, materialization),
            DomainErrorCodes.RecurrenceAlreadyMaterialized,
            $"La ocurrencia {materialization.Occurrence:yyyy-MM-dd} del recurrente '{Name}' ya fue materializada.");

        return materialization;
    }

    private static (EconomicEffect Effect, CashFlow Flow) EffectAndFlowFor(MovementKind kind) =>
        kind == MovementKind.Income
            ? (EconomicEffect.Income, CashFlow.Inflow)
            : (EconomicEffect.Expense, CashFlow.Outflow);

    private static void ValidateSingleTarget(RecurrenceId id, MovementKind kind, MovementLinks target)
    {
        Guard.Require(
            target.Recurrence is null || target.Recurrence == id,
            DomainErrorCodes.InvariantViolation,
            "El destino de un recurrente no puede apuntar a otro recurrente.");

        var (effect, flow) = EffectAndFlowFor(kind);
        MovementKindSpec.For(kind).Validate(effect, flow, target with { Recurrence = id });
    }

    public override string ToString() =>
        IsTransfer
            ? $"{Name}: transferencia {Amount} {Schedule}"
            : $"{Name}: {Amount} {Schedule}";
}
