using Finanzas.Domain.Common;
using Finanzas.Domain.Identifiers;
using Finanzas.Domain.ValueObjects;

namespace Finanzas.Domain.Obligations;

public enum ObligationEntryType
{
    /// <summary>Entrega de capital con movimiento de caja.</summary>
    Disbursement = 1,

    /// <summary>Cargo sin desembolso: compra asignada, gasto trasladado.</summary>
    Charge = 2,

    /// <summary>Interés devengado o cobrado.</summary>
    Interest = 3,

    /// <summary>Abono.</summary>
    Payment = 4,

    /// <summary>Ajuste documentado (condonación, corrección, redondeo).</summary>
    Adjustment = 5,

    /// <summary>Reverso de otro asiento. Nunca borra el original.</summary>
    Reversal = 6,

    /// <summary>Cierre de la obligación. Importe cero: es metadato, no dinero.</summary>
    Closure = 7,
}

/// <summary>
/// Asiento del ledger de una obligación. Es un libro de solo-añadir: nada se
/// modifica ni se borra; corregir es añadir un reverso (regla financiera 6).
/// </summary>
/// <remarks>
/// Los importes son <b>deltas con signo</b> sobre capital e interés. El saldo de
/// la obligación es su suma, nunca un campo almacenado.
/// </remarks>
public sealed class ObligationEntry : Entity<ObligationEntryId>
{
    private ObligationEntry(
        ObligationEntryId id,
        ObligationEntryType type,
        DateOnly date,
        Money principalDelta,
        Money interestDelta,
        MovementId? movement,
        ObligationEntryId? reversalOf,
        string? note,
        DateTimeOffset createdAt)
        : base(id)
    {
        Type = type;
        Date = date;
        PrincipalDelta = principalDelta;
        InterestDelta = interestDelta;
        Movement = movement;
        ReversalOf = reversalOf;
        Note = note;
        CreatedAt = createdAt;
    }

    public ObligationEntryType Type { get; }

    public DateOnly Date { get; }

    /// <summary>Variación del capital adeudado (positiva aumenta la deuda).</summary>
    public Money PrincipalDelta { get; }

    /// <summary>Variación del interés adeudado.</summary>
    public Money InterestDelta { get; }

    /// <summary>Movimiento del ledger que respalda el asiento, si mueve dinero.</summary>
    public MovementId? Movement { get; }

    public ObligationEntryId? ReversalOf { get; }

    public ObligationEntryId? ReversedBy { get; private set; }

    public string? Note { get; }

    public DateTimeOffset CreatedAt { get; }

    public bool IsReversal => ReversalOf is not null;

    public bool IsReversed => ReversedBy is not null;

    /// <summary>Variación total del saldo.</summary>
    public Money TotalDelta => PrincipalDelta + InterestDelta;

    internal static ObligationEntry Create(
        ObligationEntryId id,
        ObligationEntryType type,
        DateOnly date,
        Money principalDelta,
        Money interestDelta,
        DateTimeOffset createdAt,
        MovementId? movement = null,
        ObligationEntryId? reversalOf = null,
        string? note = null)
    {
        Money.EnsureSameCurrency(principalDelta, interestDelta);

        if (type == ObligationEntryType.Closure)
        {
            Guard.Require(
                principalDelta.IsZero && interestDelta.IsZero,
                DomainErrorCodes.InvariantViolation,
                "El cierre de una obligación no mueve dinero: es metadato, no un asiento monetario.");

            Guard.Require(
                movement is null,
                DomainErrorCodes.InvariantViolation,
                "El cierre de una obligación no puede enlazar un movimiento (regla financiera 2).");
        }

        return new ObligationEntry(
            id,
            type,
            date,
            principalDelta,
            interestDelta,
            movement,
            reversalOf,
            string.IsNullOrWhiteSpace(note) ? null : note.Trim(),
            createdAt);
    }

    internal void MarkReversedBy(ObligationEntryId reversalId)
    {
        Guard.Require(
            !IsReversed,
            DomainErrorCodes.ObligationEntryAlreadyReversed,
            $"El asiento {Id} ya fue reversado por {ReversedBy}.");

        Guard.Require(
            !IsReversal,
            DomainErrorCodes.ObligationCannotReverseReversal,
            "Un reverso no se puede reversar; registre un asiento nuevo.");

        ReversedBy = reversalId;
    }

    public override string ToString() =>
        $"{Date:yyyy-MM-dd} {Type} capital {PrincipalDelta} interés {InterestDelta}";
}

/// <summary>Resultado de aplicar un abono según la regla vigente.</summary>
/// <param name="Principal">Parte aplicada a capital.</param>
/// <param name="Interest">Parte aplicada a intereses.</param>
/// <param name="Excess">Sobrepago: excede el saldo pendiente.</param>
public sealed record PaymentAllocation(Money Principal, Money Interest, Money Excess)
{
    /// <summary>Suma de las tres partes: siempre igual al abono recibido.</summary>
    public Money Total => Principal + Interest + Excess;
}

/// <summary>Reglas de aplicación de abonos (§W11).</summary>
public enum PaymentAllocationRule
{
    /// <summary>Primero capital, luego intereses.</summary>
    PrincipalFirst = 1,

    /// <summary>Primero intereses, luego capital.</summary>
    InterestFirst = 2,

    /// <summary>Proporcional al saldo de capital e intereses.</summary>
    Proportional = 3,

    /// <summary>El usuario indica explícitamente cuánto va a cada concepto.</summary>
    Manual = 4,
}
