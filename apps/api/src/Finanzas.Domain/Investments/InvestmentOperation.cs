using Finanzas.Domain.Common;
using Finanzas.Domain.Identifiers;
using Finanzas.Domain.Ledger;
using Finanzas.Domain.ValueObjects;

namespace Finanzas.Domain.Investments;

public enum InvestmentOperationType
{
    /// <summary>Aporte de efectivo a la posición.</summary>
    Contribution = 1,

    /// <summary>Retiro de efectivo de la posición.</summary>
    Withdrawal = 2,

    Buy = 3,

    Sell = 4,

    Dividend = 5,

    Fee = 6,
}

/// <summary>
/// Operación de inversión enlazada a su movimiento del ledger. Cada operación
/// tiene <b>siempre</b> un movimiento: no existe flujo de inversión invisible
/// para el ledger (§4.1 y regla financiera 1).
/// </summary>
public sealed record InvestmentOperation
{
    private InvestmentOperation(
        MovementId movement,
        InvestmentOperationType type,
        DateOnly date,
        Money amount,
        decimal? quantity,
        decimal? unitPrice)
    {
        Movement = movement;
        Type = type;
        Date = date;
        Amount = amount;
        Quantity = quantity;
        UnitPrice = unitPrice;
    }

    public MovementId Movement { get; }

    public InvestmentOperationType Type { get; }

    public DateOnly Date { get; }

    /// <summary>Importe de caja de la operación, siempre positivo.</summary>
    public Money Amount { get; }

    /// <summary>Unidades negociadas; obligatorio en compra y venta.</summary>
    public decimal? Quantity { get; }

    /// <summary>Precio unitario; obligatorio en compra y venta.</summary>
    public decimal? UnitPrice { get; }

    public bool MovesUnits => Type is InvestmentOperationType.Buy or InvestmentOperationType.Sell;

    public static InvestmentOperation Create(
        MovementId movement,
        InvestmentOperationType type,
        DateOnly date,
        Money amount,
        decimal? quantity = null,
        decimal? unitPrice = null)
    {
        Guard.NotNull(amount);
        Guard.Positive(amount.Amount, DomainErrorCodes.InvalidAmount, nameof(amount));

        if (type is InvestmentOperationType.Buy or InvestmentOperationType.Sell)
        {
            Guard.Require(
                quantity is not null && quantity.Value > 0m,
                DomainErrorCodes.PositionInvalidOperation,
                $"Una operación de {type} exige una cantidad positiva.");

            Guard.Require(
                unitPrice is not null && unitPrice.Value >= 0m,
                DomainErrorCodes.PositionInvalidOperation,
                $"Una operación de {type} exige un precio unitario no negativo.");
        }
        else
        {
            Guard.Require(
                quantity is null && unitPrice is null,
                DomainErrorCodes.PositionInvalidOperation,
                $"Una operación de {type} no lleva cantidad ni precio unitario.");
        }

        return new InvestmentOperation(movement, type, date, amount, quantity, unitPrice);
    }

    /// <summary>Clase de movimiento que corresponde a cada operación.</summary>
    public static MovementKind MovementKindFor(InvestmentOperationType type) => type switch
    {
        InvestmentOperationType.Contribution => MovementKind.InvestmentContribution,
        InvestmentOperationType.Withdrawal => MovementKind.InvestmentWithdrawal,
        InvestmentOperationType.Buy => MovementKind.InvestmentBuy,
        InvestmentOperationType.Sell => MovementKind.InvestmentSell,
        InvestmentOperationType.Dividend => MovementKind.InvestmentDividend,
        InvestmentOperationType.Fee => MovementKind.InvestmentFee,
        _ => throw new InvariantViolationException(
            DomainErrorCodes.PositionInvalidOperation,
            $"Operación de inversión no soportada: {type}."),
    };

    public override string ToString() => $"{Date:yyyy-MM-dd} {Type} {Amount}";
}
