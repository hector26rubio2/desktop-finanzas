using Finanzas.Domain.Common;

namespace Finanzas.Domain.ValueObjects;

/// <summary>
/// Porcentaje almacenado como tasa decimal (19,5 % → 0,195). Evita el error
/// clásico de mezclar "porcentaje" y "tasa" en el mismo campo <c>real</c>.
/// </summary>
public readonly record struct Percentage : IComparable<Percentage>
{
    private Percentage(decimal rate) => Rate = rate;

    /// <summary>Tasa decimal: 0,195 equivale al 19,5 %.</summary>
    public decimal Rate { get; }

    /// <summary>Valor en puntos porcentuales: 19,5 para el 19,5 %.</summary>
    public decimal Percent => Rate * 100m;

    public static Percentage Zero => new(0m);

    public bool IsZero => Rate == 0m;

    /// <summary>Crea desde la tasa decimal (0,195).</summary>
    public static Percentage FromRate(decimal rate) => new(rate);

    /// <summary>Crea desde puntos porcentuales (19,5).</summary>
    public static Percentage FromPercent(decimal percent) => new(percent / 100m);

    /// <summary>Tasa no negativa; se usa para APR, mora y comisiones.</summary>
    public static Percentage NonNegativeRate(decimal rate)
    {
        Guard.NonNegative(rate, DomainErrorCodes.InvalidPercentage, nameof(rate));
        return new Percentage(rate);
    }

    /// <summary>Participación de un reparto: 0 % a 100 %.</summary>
    public static Percentage Share(decimal percent)
    {
        Guard.Require(
            percent >= 0m && percent <= 100m,
            DomainErrorCodes.InvalidPercentage,
            $"Una participación debe estar entre 0 % y 100 % (recibido {percent}).");
        return FromPercent(percent);
    }

    /// <summary>Aplica el porcentaje a un importe con la política de redondeo del dominio.</summary>
    public Money ApplyTo(Money amount)
    {
        Guard.NotNull(amount);
        return amount.Multiply(Rate);
    }

    public int CompareTo(Percentage other) => Rate.CompareTo(other.Rate);

    public static bool operator >(Percentage left, Percentage right) => left.Rate > right.Rate;

    public static bool operator <(Percentage left, Percentage right) => left.Rate < right.Rate;

    public static bool operator >=(Percentage left, Percentage right) => left.Rate >= right.Rate;

    public static bool operator <=(Percentage left, Percentage right) => left.Rate <= right.Rate;

    public override string ToString() =>
        $"{Percent.ToString("0.####", System.Globalization.CultureInfo.InvariantCulture)}%";
}
