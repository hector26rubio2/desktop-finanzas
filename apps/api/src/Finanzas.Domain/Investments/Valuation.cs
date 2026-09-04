using Finanzas.Domain.Common;
using Finanzas.Domain.Identifiers;
using Finanzas.Domain.ValueObjects;

namespace Finanzas.Domain.Investments;

public enum ValuationSource
{
    /// <summary>Precio de mercado observado.</summary>
    MarketPrice = 1,

    /// <summary>Valor informado por la entidad.</summary>
    Statement = 2,

    /// <summary>Valor ingresado a mano por el usuario.</summary>
    Manual = 3,
}

/// <summary>
/// Valoración de una posición en una fecha. <b>No es flujo de caja</b>: es una
/// serie separada, enlazada a la posición, y por diseño no tiene ningún enlace
/// a un movimiento (§4.1 del plan). Que una inversión suba de precio no es un
/// ingreso.
/// </summary>
public sealed record Valuation
{
    private Valuation(ValuationId id, DateOnly date, Money value, ValuationSource source, string? reference)
    {
        Id = id;
        Date = date;
        Value = value;
        Source = source;
        Reference = reference;
    }

    public ValuationId Id { get; }

    public DateOnly Date { get; }

    /// <summary>Valor de mercado de la posición completa en esa fecha.</summary>
    public Money Value { get; }

    public ValuationSource Source { get; }

    /// <summary>Referencia externa: proveedor de precio, extracto, etc.</summary>
    public string? Reference { get; }

    public static Valuation Create(
        ValuationId id,
        DateOnly date,
        Money value,
        ValuationSource source,
        string? reference = null)
    {
        Guard.NotNull(value);
        Guard.NonNegative(value.Amount, DomainErrorCodes.InvalidAmount, nameof(value));
        return new Valuation(
            id,
            date,
            value,
            source,
            string.IsNullOrWhiteSpace(reference) ? null : reference.Trim());
    }

    public override string ToString() => $"{Date:yyyy-MM-dd} {Value} ({Source})";
}
