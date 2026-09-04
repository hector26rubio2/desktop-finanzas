using Finanzas.Domain.Common;

namespace Finanzas.Domain.ValueObjects;

/// <summary>
/// Importe monetario: <c>decimal</c> + <see cref="Currency"/>. Nunca
/// <c>double</c>, <c>float</c> ni <c>real</c> (regla financiera 4).
/// </summary>
/// <remarks>
/// Es una clase y no un <c>struct</c> a propósito: un <c>default(Money)</c>
/// sería un importe sin moneda, es decir un estado inválido representable. Aquí
/// no existe dinero sin moneda.
/// Toda operación entre importes de monedas distintas lanza
/// <see cref="CurrencyMismatchException"/> (regla financiera 5): sumar monedas
/// requiere conversión explícita vía <see cref="ExchangeRate"/>.
/// </remarks>
public sealed class Money : IEquatable<Money>, IComparable<Money>
{
    private Money(decimal amount, Currency currency)
    {
        Amount = amount;
        Currency = currency;
    }

    /// <summary>Importe ya redondeado a la escala de la moneda.</summary>
    public decimal Amount { get; }

    public Currency Currency { get; }

    public bool IsZero => Amount == 0m;

    public bool IsPositive => Amount > 0m;

    public bool IsNegative => Amount < 0m;

    /// <summary>
    /// Construye un importe redondeando a la escala de la moneda según
    /// <see cref="MoneyRounding"/>.
    /// </summary>
    public static Money Of(decimal amount, Currency currency)
    {
        Guard.NotNull(currency);
        return new Money(MoneyRounding.Round(amount, currency), currency);
    }

    /// <inheritdoc cref="Of(decimal, Currency)"/>
    public static Money Of(decimal amount, string currencyCode) => Of(amount, Currency.Of(currencyCode));

    /// <summary>
    /// Construye un importe exigiendo que ya sea representable en la moneda.
    /// Útil en fronteras de importación, donde redondear en silencio ocultaría
    /// un dato corrupto.
    /// </summary>
    public static Money Exact(decimal amount, Currency currency)
    {
        Guard.NotNull(currency);
        var rounded = MoneyRounding.Round(amount, currency);
        Guard.Require(
            rounded == amount,
            DomainErrorCodes.InvalidScale,
            $"{amount} no es representable en {currency.Code} ({currency.MinorUnits} decimales).");
        return new Money(rounded, currency);
    }

    public static Money Zero(Currency currency) => Of(0m, currency);

    public Money Abs() => Amount >= 0m ? this : new Money(-Amount, Currency);

    public Money Negate() => new(-Amount, Currency);

    /// <summary>Multiplica por un factor y redondea con la política del dominio.</summary>
    public Money Multiply(decimal factor) => Of(Amount * factor, Currency);

    /// <summary>Divide por un divisor y redondea con la política del dominio.</summary>
    public Money Divide(decimal divisor)
    {
        Guard.Require(divisor != 0m, DomainErrorCodes.InvalidAmount, "No se puede dividir un importe por cero.");
        return Of(Amount / divisor, Currency);
    }

    /// <summary>Convierte a otra moneda con una tasa explícita.</summary>
    public Money ConvertWith(ExchangeRate rate) => rate.Convert(this);

    /// <summary>
    /// Reparte el importe en <paramref name="parts"/> partes iguales sin perder
    /// ni inventar unidades menores. La suma de las partes es exactamente este
    /// importe.
    /// </summary>
    public Money[] Allocate(int parts)
    {
        Guard.Require(parts > 0, DomainErrorCodes.OutOfRange, "El número de partes debe ser mayor que cero.");
        var weights = new decimal[parts];
        Array.Fill(weights, 1m);
        return Allocate(weights);
    }

    /// <summary>
    /// Reparte el importe según pesos no negativos, por el método del mayor
    /// resto. Garantía: <c>Allocate(w).Sum() == this</c>, siempre. Es la única
    /// forma admitida de dividir dinero en el dominio (porcentajes de una compra
    /// compartida, prorrateo capital/interés, cuotas).
    /// </summary>
    public Money[] Allocate(IReadOnlyList<decimal> weights)
    {
        Guard.NotNull(weights);
        Guard.Require(weights.Count > 0, DomainErrorCodes.OutOfRange, "Se requiere al menos un peso para repartir.");

        decimal total = 0m;
        foreach (var weight in weights)
        {
            Guard.NonNegative(weight, DomainErrorCodes.OutOfRange, nameof(weights));
            total += weight;
        }

        Guard.Require(total > 0m, DomainErrorCodes.OutOfRange, "La suma de los pesos debe ser mayor que cero.");

        var sign = Amount < 0m ? -1m : 1m;
        var scale = MoneyRounding.ScaleFactor(Currency);
        var minorTotal = (long)decimal.Round(Math.Abs(Amount) * scale, 0, MoneyRounding.Mode);

        var assigned = new long[weights.Count];
        var remainders = new decimal[weights.Count];
        long distributed = 0;

        for (var i = 0; i < weights.Count; i++)
        {
            var exact = minorTotal * weights[i] / total;
            var floor = decimal.Floor(exact);
            assigned[i] = (long)floor;
            remainders[i] = exact - floor;
            distributed += assigned[i];
        }

        var leftover = minorTotal - distributed;
        var order = Enumerable.Range(0, weights.Count)
            .OrderByDescending(i => remainders[i])
            .ThenBy(i => i)
            .ToArray();

        for (var i = 0; leftover > 0; i++, leftover--)
        {
            assigned[order[i % order.Length]]++;
        }

        var result = new Money[weights.Count];
        for (var i = 0; i < weights.Count; i++)
        {
            result[i] = new Money(sign * assigned[i] / scale, Currency);
        }

        return result;
    }

    /// <summary>Suma una secuencia exigiendo moneda homogénea.</summary>
    public static Money Sum(IEnumerable<Money> amounts, Currency currency)
    {
        Guard.NotNull(currency);
        var total = Zero(currency);
        foreach (var amount in amounts)
        {
            total += amount;
        }

        return total;
    }

    public static Money operator +(Money left, Money right)
    {
        EnsureSameCurrency(left, right);
        return new Money(left.Amount + right.Amount, left.Currency);
    }

    public static Money operator -(Money left, Money right)
    {
        EnsureSameCurrency(left, right);
        return new Money(left.Amount - right.Amount, left.Currency);
    }

    public static Money operator -(Money value) => value.Negate();

    public static Money operator *(Money left, decimal factor) => left.Multiply(factor);

    public static Money operator *(decimal factor, Money right) => right.Multiply(factor);

    public static bool operator >(Money left, Money right) => left.CompareTo(right) > 0;

    public static bool operator <(Money left, Money right) => left.CompareTo(right) < 0;

    public static bool operator >=(Money left, Money right) => left.CompareTo(right) >= 0;

    public static bool operator <=(Money left, Money right) => left.CompareTo(right) <= 0;

    public int CompareTo(Money? other)
    {
        var target = Guard.NotNull(other);
        EnsureSameCurrency(this, target);
        return Amount.CompareTo(target.Amount);
    }

    public bool Equals(Money? other) =>
        other is not null && other.Currency == Currency && other.Amount == Amount;

    public override bool Equals(object? obj) => Equals(obj as Money);

    public override int GetHashCode() => HashCode.Combine(Amount, Currency);

    public override string ToString() =>
        $"{Amount.ToString("F" + Currency.MinorUnits, System.Globalization.CultureInfo.InvariantCulture)} {Currency.Code}";

    public static bool operator ==(Money? left, Money? right) =>
        left is null ? right is null : left.Equals(right);

    public static bool operator !=(Money? left, Money? right) => !(left == right);

    /// <summary>
    /// Punto único donde se aplica la regla 5: dos importes solo se combinan si
    /// comparten moneda.
    /// </summary>
    public static void EnsureSameCurrency(Money left, Money right)
    {
        Guard.NotNull(left);
        Guard.NotNull(right);
        if (left.Currency != right.Currency)
        {
            throw new CurrencyMismatchException(left.Currency.Code, right.Currency.Code);
        }
    }
}
