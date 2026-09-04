using Finanzas.Domain.Common;
using Finanzas.Domain.ValueObjects;

namespace Finanzas.Domain.Cards;

/// <summary>
/// Condiciones financieras de una tarjeta: tasas, pago mínimo y gracia. Todas
/// las tasas son <b>anuales nominales</b>; la conversión a tasa periódica es
/// única y vive en <see cref="MonthlyRate"/> / <see cref="DailyRate"/>.
/// </summary>
public sealed record CardTerms
{
    private CardTerms(
        Percentage purchaseApr,
        Percentage cashAdvanceApr,
        Percentage internationalPurchaseApr,
        Percentage deferredDefaultApr,
        Percentage minimumPaymentRate,
        Money? minimumPaymentFloor,
        int gracePeriodDays)
    {
        PurchaseApr = purchaseApr;
        CashAdvanceApr = cashAdvanceApr;
        InternationalPurchaseApr = internationalPurchaseApr;
        DeferredDefaultApr = deferredDefaultApr;
        MinimumPaymentRate = minimumPaymentRate;
        MinimumPaymentFloor = minimumPaymentFloor;
        GracePeriodDays = gracePeriodDays;
    }

    /// <summary>Tasa anual nominal de compras.</summary>
    public Percentage PurchaseApr { get; }

    /// <summary>Tasa anual nominal de avances de efectivo.</summary>
    public Percentage CashAdvanceApr { get; }

    /// <summary>Tasa anual nominal de compras internacionales.</summary>
    public Percentage InternationalPurchaseApr { get; }

    /// <summary>Tasa anual nominal por omisión para diferidos.</summary>
    public Percentage DeferredDefaultApr { get; }

    /// <summary>Porcentaje del saldo exigido como pago mínimo.</summary>
    public Percentage MinimumPaymentRate { get; }

    /// <summary>Piso absoluto del pago mínimo, si el emisor lo define.</summary>
    public Money? MinimumPaymentFloor { get; }

    /// <summary>Días de gracia sin interés desde el corte.</summary>
    public int GracePeriodDays { get; }

    public static CardTerms Create(
        Percentage purchaseApr,
        Percentage minimumPaymentRate,
        int gracePeriodDays,
        Percentage? cashAdvanceApr = null,
        Percentage? internationalPurchaseApr = null,
        Percentage? deferredDefaultApr = null,
        Money? minimumPaymentFloor = null)
    {
        EnsureNonNegative(purchaseApr, nameof(purchaseApr));
        EnsureNonNegative(cashAdvanceApr ?? purchaseApr, nameof(cashAdvanceApr));
        EnsureNonNegative(internationalPurchaseApr ?? purchaseApr, nameof(internationalPurchaseApr));
        EnsureNonNegative(deferredDefaultApr ?? purchaseApr, nameof(deferredDefaultApr));

        Guard.Require(
            minimumPaymentRate.Rate >= 0m && minimumPaymentRate.Rate <= 1m,
            DomainErrorCodes.InvalidPercentage,
            $"El pago mínimo debe estar entre 0 % y 100 % (recibido {minimumPaymentRate}).");

        Guard.InRange(gracePeriodDays, 0, 90, nameof(gracePeriodDays));

        if (minimumPaymentFloor is not null)
        {
            Guard.NonNegative(
                minimumPaymentFloor.Amount,
                DomainErrorCodes.InvalidAmount,
                nameof(minimumPaymentFloor));
        }

        return new CardTerms(
            purchaseApr,
            cashAdvanceApr ?? purchaseApr,
            internationalPurchaseApr ?? purchaseApr,
            deferredDefaultApr ?? purchaseApr,
            minimumPaymentRate,
            minimumPaymentFloor,
            gracePeriodDays);
    }

    /// <summary>Tasa sin interés: tarjeta de débito diferido o promoción total.</summary>
    public static CardTerms InterestFree(Percentage minimumPaymentRate, int gracePeriodDays) =>
        Create(Percentage.Zero, minimumPaymentRate, gracePeriodDays);

    /// <summary>
    /// Tasa mensual nominal proporcional (APR / 12). Convención documentada y
    /// única del dominio: no se capitaliza dentro del periodo.
    /// </summary>
    public Percentage MonthlyRate(Percentage apr) => Percentage.FromRate(apr.Rate / 12m);

    /// <summary>
    /// Tasa diaria nominal proporcional (APR / 365, base Actual/365). Los años
    /// bisiestos usan la misma base: es la convención del dominio.
    /// </summary>
    public Percentage DailyRate(Percentage apr) => Percentage.FromRate(apr.Rate / 365m);

    /// <summary>
    /// Pago mínimo de un extracto: el mayor entre el porcentaje y el piso, y
    /// nunca más que el propio saldo.
    /// </summary>
    public Money MinimumPaymentFor(Money statementBalance)
    {
        Guard.NotNull(statementBalance);
        if (!statementBalance.IsPositive)
        {
            return Money.Zero(statementBalance.Currency);
        }

        var byRate = MinimumPaymentRate.ApplyTo(statementBalance);
        var minimum = byRate;

        if (MinimumPaymentFloor is not null)
        {
            Money.EnsureSameCurrency(statementBalance, MinimumPaymentFloor);
            if (MinimumPaymentFloor > minimum)
            {
                minimum = MinimumPaymentFloor;
            }
        }

        return minimum > statementBalance ? statementBalance : minimum;
    }

    private static void EnsureNonNegative(Percentage value, string name) =>
        Guard.NonNegative(value.Rate, DomainErrorCodes.InvalidPercentage, name);
}
