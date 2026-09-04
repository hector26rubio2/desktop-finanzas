using Finanzas.Domain.Common;
using Finanzas.Domain.ValueObjects;

namespace Finanzas.Domain.Obligations;

public enum InterestPolicyKind
{
    /// <summary>Sin interés.</summary>
    None = 0,

    /// <summary>Tasa fija sobre el capital, expresada por periodo.</summary>
    FixedRate = 1,

    /// <summary>Tasa periódica aplicada a cada corte.</summary>
    PeriodicRate = 2,

    /// <summary>Tasa heredada de las condiciones de la tarjeta asociada.</summary>
    InheritedFromCard = 3,
}

/// <summary>Periodo al que se refiere una tasa nominal.</summary>
public enum RatePeriod
{
    Annual = 1,
    Monthly = 2,
    Daily = 3,
}

/// <summary>
/// Política de interés de una obligación (§W11: sin interés, tasa fija, tasa
/// periódica o heredada de la tarjeta).
/// </summary>
/// <remarks>
/// <b>Convención única del dominio:</b> tasas nominales proporcionales con base
/// Actual/365. Un año bisiesto usa la misma base. No hay capitalización dentro
/// del periodo devengado; capitalizar es añadir el interés al capital mediante
/// un asiento explícito. Esta es la única implementación de interés del sistema
/// para evitar el riesgo §13 de calcularlo distinto en cada pantalla.
/// </remarks>
public sealed record InterestPolicy
{
    private InterestPolicy(InterestPolicyKind kind, Percentage rate, RatePeriod period)
    {
        Kind = kind;
        Rate = rate;
        Period = period;
    }

    public static InterestPolicy None { get; } =
        new(InterestPolicyKind.None, Percentage.Zero, RatePeriod.Annual);

    public InterestPolicyKind Kind { get; }

    /// <summary>Tasa nominal referida a <see cref="Period"/>.</summary>
    public Percentage Rate { get; }

    public RatePeriod Period { get; }

    public bool IsInterestFree => Kind == InterestPolicyKind.None || Rate.IsZero;

    public static InterestPolicy Fixed(Percentage rate, RatePeriod period)
    {
        Guard.NonNegative(rate.Rate, DomainErrorCodes.InvalidPercentage, nameof(rate));
        return new InterestPolicy(InterestPolicyKind.FixedRate, rate, period);
    }

    public static InterestPolicy Periodic(Percentage rate, RatePeriod period)
    {
        Guard.NonNegative(rate.Rate, DomainErrorCodes.InvalidPercentage, nameof(rate));
        return new InterestPolicy(InterestPolicyKind.PeriodicRate, rate, period);
    }

    /// <summary>
    /// Tasa tomada de la tarjeta asociada. La tasa se copia al crear la
    /// política: un cambio posterior en la tarjeta no reescribe periodos ya
    /// devengados (regla financiera 8).
    /// </summary>
    public static InterestPolicy InheritedFromCard(Percentage apr) =>
        new(InterestPolicyKind.InheritedFromCard, Percentage.NonNegativeRate(apr.Rate), RatePeriod.Annual);

    /// <summary>Tasa diaria nominal equivalente, base Actual/365.</summary>
    public Percentage DailyRate() => Period switch
    {
        RatePeriod.Daily => Rate,
        RatePeriod.Monthly => Percentage.FromRate(Rate.Rate * 12m / 365m),
        RatePeriod.Annual => Percentage.FromRate(Rate.Rate / 365m),
        _ => throw new InvariantViolationException(
            DomainErrorCodes.InvalidPercentage,
            $"Periodo de tasa no soportado: {Period}."),
    };

    /// <summary>Tasa mensual nominal equivalente.</summary>
    public Percentage MonthlyRate() => Period switch
    {
        RatePeriod.Monthly => Rate,
        RatePeriod.Daily => Percentage.FromRate(Rate.Rate * 365m / 12m),
        RatePeriod.Annual => Percentage.FromRate(Rate.Rate / 12m),
        _ => throw new InvariantViolationException(
            DomainErrorCodes.InvalidPercentage,
            $"Periodo de tasa no soportado: {Period}."),
    };

    /// <summary>
    /// Interés devengado sobre un capital durante un rango de fechas, con la
    /// convención Actual/365. Función pura: mismas entradas, mismo resultado.
    /// </summary>
    public Money Accrue(Money outstandingPrincipal, DateRange period)
    {
        Guard.NotNull(outstandingPrincipal);

        if (IsInterestFree || !outstandingPrincipal.IsPositive)
        {
            return Money.Zero(outstandingPrincipal.Currency);
        }

        var daily = DailyRate().Rate;
        return Money.Of(outstandingPrincipal.Amount * daily * period.DayCount, outstandingPrincipal.Currency);
    }

    public override string ToString() =>
        IsInterestFree ? "sin interés" : $"{Kind} {Rate} {Period}";
}

/// <summary>
/// Vigencia de una política de interés. La política es una serie temporal, no un
/// campo: cambiarla no puede reescribir lo ya devengado (regla financiera 8).
/// </summary>
public sealed record InterestPolicyTerm(DateOnly EffectiveFrom, InterestPolicy Policy);
