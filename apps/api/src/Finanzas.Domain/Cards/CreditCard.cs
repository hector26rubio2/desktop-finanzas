using Finanzas.Domain.Common;
using Finanzas.Domain.Identifiers;
using Finanzas.Domain.ValueObjects;

namespace Finanzas.Domain.Cards;

/// <summary>
/// Tarjeta de crédito: cupo, ciclo y condiciones. Agregado propio y no un tipo
/// de cuenta, porque su estado no es un saldo sino una deuda con el emisor.
/// </summary>
/// <remarks>
/// <b>La deuda no se almacena aquí.</b> Se deriva del ledger
/// (compras, intereses, comisiones y pagos enlazados a la tarjeta). Los métodos
/// de este agregado reciben la deuda derivada como argumento y son funciones
/// puras: así no puede existir un saldo "editable" que contradiga los
/// movimientos (regla financiera 1).
/// </remarks>
public sealed class CreditCard : AggregateRoot<CardId>
{
    private CreditCard(
        CardId id,
        string name,
        Currency currency,
        Money creditLimit,
        BillingCycle cycle,
        CardTerms terms,
        string? issuer,
        string? lastFour,
        DateTimeOffset createdAt)
        : base(id)
    {
        Name = name;
        Currency = currency;
        CreditLimit = creditLimit;
        Cycle = cycle;
        Terms = terms;
        Issuer = issuer;
        LastFour = lastFour;
        CreatedAt = createdAt;
        IsActive = true;
    }

    public string Name { get; private set; }

    /// <summary>Moneda de facturación de la tarjeta.</summary>
    public Currency Currency { get; }

    /// <summary>Cupo aprobado, en la moneda de la tarjeta.</summary>
    public Money CreditLimit { get; private set; }

    public BillingCycle Cycle { get; private set; }

    public CardTerms Terms { get; private set; }

    public string? Issuer { get; private set; }

    public string? LastFour { get; private set; }

    public bool IsActive { get; private set; }

    public DateTimeOffset CreatedAt { get; }

    public static CreditCard Create(
        CardId id,
        string name,
        Currency currency,
        Money creditLimit,
        BillingCycle cycle,
        CardTerms terms,
        DateTimeOffset createdAt,
        string? issuer = null,
        string? lastFour = null)
    {
        Guard.NotNull(currency);
        Guard.NotNull(creditLimit);
        Guard.NotNull(cycle);
        Guard.NotNull(terms);

        Guard.Require(
            creditLimit.Currency == currency,
            DomainErrorCodes.CurrencyMismatch,
            $"El cupo está en {creditLimit.Currency.Code} y la tarjeta factura en {currency.Code}.");

        Guard.Positive(creditLimit.Amount, DomainErrorCodes.InvalidAmount, nameof(creditLimit));

        if (terms.MinimumPaymentFloor is not null)
        {
            Guard.Require(
                terms.MinimumPaymentFloor.Currency == currency,
                DomainErrorCodes.CurrencyMismatch,
                "El piso de pago mínimo debe estar en la moneda de la tarjeta.");
        }

        return new CreditCard(
            id,
            Guard.NotBlank(name),
            currency,
            creditLimit,
            cycle,
            terms,
            string.IsNullOrWhiteSpace(issuer) ? null : issuer.Trim(),
            string.IsNullOrWhiteSpace(lastFour) ? null : lastFour.Trim(),
            createdAt);
    }

    /// <summary>Cupo disponible dada la deuda derivada del ledger.</summary>
    public Money AvailableCredit(Money currentDebt)
    {
        EnsureCardCurrency(currentDebt);
        var available = CreditLimit - currentDebt;
        return available.IsNegative ? Money.Zero(Currency) : available;
    }

    /// <summary>Porcentaje de utilización del cupo.</summary>
    public Percentage Utilization(Money currentDebt)
    {
        EnsureCardCurrency(currentDebt);
        return Percentage.FromRate(currentDebt.Amount / CreditLimit.Amount);
    }

    /// <summary>
    /// Verifica que una compra cabe en el cupo. Invariante de tarjeta: no se
    /// registra una compra que excede el cupo sin decisión explícita.
    /// </summary>
    public void EnsureFitsInLimit(Money currentDebt, Money purchase)
    {
        EnsureCardCurrency(currentDebt);
        EnsureCardCurrency(purchase);
        Guard.Positive(purchase.Amount, DomainErrorCodes.InvalidAmount, nameof(purchase));

        var projected = currentDebt + purchase;
        Guard.Require(
            projected <= CreditLimit,
            DomainErrorCodes.CardLimitExceeded,
            $"La compra de {purchase} lleva la deuda a {projected} y el cupo es {CreditLimit}.");
    }

    /// <summary>Pago mínimo del extracto, según las condiciones vigentes.</summary>
    public Money MinimumPaymentFor(Money statementBalance)
    {
        EnsureCardCurrency(statementBalance);
        return Terms.MinimumPaymentFor(statementBalance);
    }

    /// <summary>Ciclo de facturación que contiene una fecha.</summary>
    public BillingPeriod PeriodContaining(DateOnly date) => Cycle.PeriodContaining(date);

    /// <summary>
    /// Cambia las condiciones a partir de ahora. No recalcula ciclos ya
    /// cerrados: los intereses causados con la tasa anterior siguen siendo los
    /// que fueron (regla financiera 8).
    /// </summary>
    public void UpdateTerms(CardTerms terms)
    {
        Guard.NotNull(terms);
        if (terms.MinimumPaymentFloor is not null)
        {
            Guard.Require(
                terms.MinimumPaymentFloor.Currency == Currency,
                DomainErrorCodes.CurrencyMismatch,
                "El piso de pago mínimo debe estar en la moneda de la tarjeta.");
        }

        Terms = terms;
    }

    public void UpdateCycle(BillingCycle cycle) => Cycle = Guard.NotNull(cycle);

    public void UpdateCreditLimit(Money creditLimit)
    {
        EnsureCardCurrency(creditLimit);
        Guard.Positive(creditLimit.Amount, DomainErrorCodes.InvalidAmount, nameof(creditLimit));
        CreditLimit = creditLimit;
    }

    public void Rename(string name) => Name = Guard.NotBlank(name);

    public void Deactivate() => IsActive = false;

    public void Activate() => IsActive = true;

    private void EnsureCardCurrency(Money amount)
    {
        Guard.NotNull(amount);
        Guard.Require(
            amount.Currency == Currency,
            DomainErrorCodes.CurrencyMismatch,
            $"La tarjeta factura en {Currency.Code} y el importe está en {amount.Currency.Code}.");
    }

    public override string ToString() => $"{Name} ({Currency.Code}, cupo {CreditLimit})";
}
