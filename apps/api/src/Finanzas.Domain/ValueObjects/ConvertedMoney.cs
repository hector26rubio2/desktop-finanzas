using Finanzas.Domain.Common;

namespace Finanzas.Domain.ValueObjects;

/// <summary>
/// Importe con su moneda original, la tasa aplicada y su equivalente en moneda
/// base. Sustituye al trío suelto <c>amount</c> / <c>trm_applied</c> /
/// <c>amount_base</c> del esquema heredado, donde nada garantizaba que el
/// tercero fuera el producto de los dos primeros.
/// </summary>
/// <remarks>
/// Invariante: <c>Base == Rate.Convert(Original)</c> y
/// <c>Rate.From == Original.Currency</c>. Es la materialización de la regla
/// financiera 5: se conserva la moneda original y la moneda base, y no se suma
/// nada sin conversión explícita.
/// </remarks>
public sealed record ConvertedMoney
{
    private ConvertedMoney(Money original, ExchangeRate rate, Money @base)
    {
        Original = original;
        Rate = rate;
        Base = @base;
    }

    public Money Original { get; }

    public ExchangeRate Rate { get; }

    public Money Base { get; }

    public Currency Currency => Original.Currency;

    public Currency BaseCurrency => Base.Currency;

    public bool IsBaseCurrency => Rate.IsIdentity;

    public static ConvertedMoney Create(Money original, ExchangeRate rate)
    {
        Guard.NotNull(original);
        Guard.NotNull(rate);
        Guard.Require(
            rate.From == original.Currency,
            DomainErrorCodes.CurrencyMismatch,
            $"La tasa parte de {rate.From.Code} pero el importe está en {original.Currency.Code}.");

        return new ConvertedMoney(original, rate, rate.Convert(original));
    }

    /// <summary>Importe que ya está en moneda base: tasa identidad.</summary>
    public static ConvertedMoney InBaseCurrency(Money amount, DateOnly asOf)
    {
        Guard.NotNull(amount);
        return Create(amount, ExchangeRate.Identity(amount.Currency, asOf));
    }

    /// <summary>Aplica una función al importe original conservando la tasa.</summary>
    public ConvertedMoney WithOriginal(Money original) => Create(original, Rate);

    public override string ToString() =>
        IsBaseCurrency ? Original.ToString() : $"{Original} (= {Base} @ {Rate.Rate})";
}
