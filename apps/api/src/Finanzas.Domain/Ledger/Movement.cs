using Finanzas.Domain.Common;
using Finanzas.Domain.Identifiers;
using Finanzas.Domain.ValueObjects;

namespace Finanzas.Domain.Ledger;

/// <summary>
/// Movimiento: la fuente de verdad transversal del sistema (§4.1 del plan y
/// regla financiera 1). Toda operación con efecto económico produce o enlaza
/// un movimiento; tarjetas, préstamos, recurrentes e inversiones son
/// proyecciones sobre este ledger, no saldos editables paralelos.
/// </summary>
/// <remarks>
/// <para><b>Inmutabilidad.</b> Importe, fecha, clase, efecto, flujo y enlaces no
/// se pueden modificar tras la creación. Una corrección se registra como
/// reverso (<see cref="Reverse"/>), que conserva el original y su auditoría
/// (regla financiera 6). Solo se admite reclasificar categoría y descripción.</para>
/// <para><b>Signo.</b> El importe siempre es positivo; el sentido lo dan
/// <see cref="Flow"/> (caja) y <see cref="Effect"/> (resultado), que son ejes
/// independientes.</para>
/// </remarks>
public sealed class Movement : AggregateRoot<MovementId>
{
    private Movement(
        MovementId id,
        DateOnly date,
        MovementKind kind,
        EconomicEffect effect,
        CashFlow flow,
        ConvertedMoney amount,
        MovementLinks links,
        MovementOrigin origin,
        string? description,
        DateTimeOffset createdAt,
        MovementId? reversalOf)
        : base(id)
    {
        Date = date;
        Kind = kind;
        Effect = effect;
        Flow = flow;
        Amount = amount;
        Links = links;
        Origin = origin;
        Description = description;
        CreatedAt = createdAt;
        ReversalOf = reversalOf;
    }

    /// <summary>Fecha contable del movimiento.</summary>
    public DateOnly Date { get; }

    public MovementKind Kind { get; }

    /// <summary>Efecto sobre el resultado del periodo.</summary>
    public EconomicEffect Effect { get; }

    /// <summary>Efecto sobre el saldo del instrumento.</summary>
    public CashFlow Flow { get; }

    /// <summary>Importe original, tasa aplicada e importe en moneda base.</summary>
    public ConvertedMoney Amount { get; }

    public MovementLinks Links { get; private set; }

    public MovementOrigin Origin { get; }

    public string? Description { get; private set; }

    public DateTimeOffset CreatedAt { get; }

    /// <summary>Movimiento que este reversa, si es un reverso.</summary>
    public MovementId? ReversalOf { get; }

    /// <summary>Reverso que anuló este movimiento, si ya fue reversado.</summary>
    public MovementId? ReversedBy { get; private set; }

    public bool IsReversal => ReversalOf is not null;

    /// <summary>
    /// El movimiento fue anulado por un reverso. Sigue contando en los saldos:
    /// el par original + reverso suma cero. Excluirlo sería reescribir el
    /// pasado en vez de auditarlo (regla financiera 6).
    /// </summary>
    public bool IsAnnulled => ReversedBy is not null;

    private bool IsReversed => ReversedBy is not null;

    public MovementKindSpec Spec => MovementKindSpec.For(Kind);

    /// <summary>
    /// Aporte firmado al saldo del instrumento, en moneda base. Un reverso
    /// aporta lo contrario que su original, sin borrarlo.
    /// </summary>
    public Money SignedCashBase => Sign(Flow switch
    {
        CashFlow.Inflow => Amount.Base,
        CashFlow.Outflow => Amount.Base.Negate(),
        _ => Money.Zero(Amount.BaseCurrency),
    });

    /// <summary>Aporte firmado al resultado del periodo, en moneda base.</summary>
    public Money SignedEconomicBase => Sign(Effect switch
    {
        EconomicEffect.Income => Amount.Base,
        EconomicEffect.Expense => Amount.Base.Negate(),
        _ => Money.Zero(Amount.BaseCurrency),
    });

    /// <summary>
    /// Crea un movimiento validando toda la especificación de su clase.
    /// </summary>
    public static Movement Create(
        MovementId id,
        DateOnly date,
        MovementKind kind,
        EconomicEffect effect,
        CashFlow flow,
        ConvertedMoney amount,
        MovementLinks links,
        DateTimeOffset createdAt,
        MovementOrigin origin = MovementOrigin.Manual,
        string? description = null)
    {
        Guard.NotNull(amount);
        Guard.NotNull(links);

        Guard.Require(
            amount.Original.IsPositive,
            DomainErrorCodes.MovementAmountNotPositive,
            $"El importe de un movimiento debe ser positivo; el sentido lo da el flujo y el efecto (recibido {amount.Original}).");

        MovementKindSpec.For(kind).Validate(effect, flow, links);

        // La materialización de un recurrente y su enlace son la misma cosa:
        // no puede existir la una sin el otro.
        Guard.Require(
            (origin == MovementOrigin.RecurrenceMaterialization) == (links.Recurrence is not null),
            DomainErrorCodes.MovementOriginMismatch,
            "Un movimiento con origen 'materialización de recurrente' debe enlazar el recurrente, y viceversa.");

        return new Movement(
            id,
            date,
            kind,
            effect,
            flow,
            amount,
            links,
            origin,
            Normalize(description),
            createdAt,
            reversalOf: null);
    }

    /// <summary>
    /// Crea el reverso de este movimiento. No modifica ni borra el original:
    /// lo marca como reversado y devuelve un movimiento espejo que aporta el
    /// signo contrario (regla financiera 6).
    /// </summary>
    public Movement Reverse(MovementId reversalId, DateOnly date, DateTimeOffset createdAt, string? reason = null)
    {
        Guard.Require(
            !IsReversal,
            DomainErrorCodes.MovementReversalOfReversal,
            "Un reverso no se puede reversar; registre un movimiento nuevo.");

        Guard.Require(
            !IsReversed,
            DomainErrorCodes.MovementAlreadyReversed,
            $"El movimiento {Id} ya fue reversado por {ReversedBy}.");

        Guard.Require(
            date >= Date,
            DomainErrorCodes.InvalidDateRange,
            "El reverso no puede ser anterior al movimiento que anula.");

        var reversal = new Movement(
            reversalId,
            date,
            Kind,
            Effect,
            Flow,
            Amount,
            Links,
            Origin,
            Normalize(reason) ?? $"Reverso de {Id}",
            createdAt,
            reversalOf: Id);

        ReversedBy = reversalId;
        return reversal;
    }

    /// <summary>
    /// Reclasifica categoría y descripción. Es el único cambio admitido sobre un
    /// movimiento existente: no toca importe, fecha, clase ni enlaces.
    /// </summary>
    public void Reclassify(CategoryId? category, string? description)
    {
        var links = Links with { Category = category };
        Spec.Validate(Effect, Flow, links);

        Links = links;
        Description = Normalize(description);
    }

    private Money Sign(Money value) => IsReversal ? value.Negate() : value;

    private static string? Normalize(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    public override string ToString() =>
        $"{Date:yyyy-MM-dd} {Kind} {Amount.Original} [{Effect}/{Flow}]{(IsReversal ? " (reverso)" : string.Empty)}";
}
