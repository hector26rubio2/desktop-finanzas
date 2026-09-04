using Finanzas.Domain.Common;

namespace Finanzas.Domain.ValueObjects;

/// <summary>
/// Tasa de conversión explícita entre dos monedas en una fecha. Equivale al
/// <c>trm_applied</c> del esquema heredado, pero con origen y destino tipados:
/// una tasa no se puede aplicar "al revés" ni a la moneda equivocada.
/// </summary>
public sealed record ExchangeRate
{
    private ExchangeRate(Currency from, Currency to, decimal rate, DateOnly asOf)
    {
        From = from;
        To = to;
        Rate = rate;
        AsOf = asOf;
    }

    public Currency From { get; }

    public Currency To { get; }

    /// <summary>Unidades de <see cref="To"/> por una unidad de <see cref="From"/>.</summary>
    public decimal Rate { get; }

    public DateOnly AsOf { get; }

    public bool IsIdentity => From == To;

    public static ExchangeRate Create(Currency from, Currency to, decimal rate, DateOnly asOf)
    {
        Guard.NotNull(from);
        Guard.NotNull(to);
        Guard.Positive(rate, DomainErrorCodes.InvalidExchangeRate, nameof(rate));
        Guard.Require(
            from != to || rate == 1m,
            DomainErrorCodes.InvalidExchangeRate,
            $"La tasa de {from.Code} a sí misma debe ser exactamente 1 (recibida {rate}).");

        return new ExchangeRate(from, to, rate, asOf);
    }

    /// <summary>Tasa neutra: la moneda original ya es la moneda base.</summary>
    public static ExchangeRate Identity(Currency currency, DateOnly asOf) =>
        Create(currency, currency, 1m, asOf);

    /// <summary>Convierte un importe, redondeando con la política del dominio.</summary>
    public Money Convert(Money amount)
    {
        Guard.NotNull(amount);
        Guard.Require(
            amount.Currency == From,
            DomainErrorCodes.CurrencyMismatch,
            $"La tasa convierte desde {From.Code}, pero el importe está en {amount.Currency.Code}.");

        return Money.Of(amount.Amount * Rate, To);
    }

    /// <summary>Tasa inversa, en la misma fecha.</summary>
    public ExchangeRate Invert() => Create(To, From, 1m / Rate, AsOf);

    public override string ToString() => $"1 {From.Code} = {Rate} {To.Code} @ {AsOf:yyyy-MM-dd}";
}
