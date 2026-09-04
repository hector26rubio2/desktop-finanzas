using Finanzas.Domain.Identifiers;

namespace Finanzas.Domain.Ledger;

/// <summary>
/// Conjunto de enlaces de un movimiento hacia el resto del modelo. Todos son
/// opcionales aquí; qué combinación es legal lo decide
/// <see cref="MovementKindSpec"/> según la clase del movimiento.
/// </summary>
public sealed record MovementLinks
{
    public static readonly MovementLinks Empty = new();

    public OperationId? Operation { get; init; }

    public AccountId? Account { get; init; }

    public CardId? Card { get; init; }

    public CategoryId? Category { get; init; }

    public CounterpartyId? Counterparty { get; init; }

    public ObligationId? Obligation { get; init; }

    public RecurrenceId? Recurrence { get; init; }

    public PositionId? Position { get; init; }

    public SharedPurchaseId? SharedPurchase { get; init; }

    /// <summary>Banderas de los enlaces presentes.</summary>
    public MovementLink Present
    {
        get
        {
            var flags = MovementLink.None;
            if (Operation is not null)
            {
                flags |= MovementLink.Operation;
            }

            if (Account is not null)
            {
                flags |= MovementLink.Account;
            }

            if (Card is not null)
            {
                flags |= MovementLink.Card;
            }

            if (Category is not null)
            {
                flags |= MovementLink.Category;
            }

            if (Counterparty is not null)
            {
                flags |= MovementLink.Counterparty;
            }

            if (Obligation is not null)
            {
                flags |= MovementLink.Obligation;
            }

            if (Recurrence is not null)
            {
                flags |= MovementLink.Recurrence;
            }

            if (Position is not null)
            {
                flags |= MovementLink.Position;
            }

            if (SharedPurchase is not null)
            {
                flags |= MovementLink.SharedPurchase;
            }

            return flags;
        }
    }
}
