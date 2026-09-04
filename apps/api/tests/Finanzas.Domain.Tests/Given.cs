using Finanzas.Domain.Identifiers;
using Finanzas.Domain.Ledger;
using Finanzas.Domain.ValueObjects;

namespace Finanzas.Domain.Tests;

/// <summary>Datos y constructores de apoyo para las pruebas de dominio.</summary>
internal static class Given
{
    public static readonly Currency Cop = Currency.Cop;

    public static readonly Currency Usd = Currency.Usd;

    public static readonly DateOnly Today = new(2026, 3, 15);

    public static readonly DateTimeOffset Now = new(2026, 3, 15, 10, 0, 0, TimeSpan.Zero);

    public static Money Money(decimal amount) => ValueObjects.Money.Of(amount, Cop);

    public static Money Usd_(decimal amount) => ValueObjects.Money.Of(amount, Usd);

    public static ConvertedMoney Amount(decimal amount, DateOnly? date = null) =>
        ConvertedMoney.InBaseCurrency(Money(amount), date ?? Today);

    /// <summary>Importe en dólares convertido a pesos con una tasa explícita.</summary>
    public static ConvertedMoney AmountUsd(decimal amount, decimal rate, DateOnly? date = null) =>
        ConvertedMoney.Create(
            Usd_(amount),
            ExchangeRate.Create(Usd, Cop, rate, date ?? Today));

    public static Movement Expense(
        decimal amount,
        AccountId account,
        DateOnly? date = null,
        CategoryId? category = null) =>
        Movement.Create(
            MovementId.New(),
            date ?? Today,
            MovementKind.Expense,
            EconomicEffect.Expense,
            CashFlow.Outflow,
            Amount(amount, date),
            new MovementLinks { Account = account, Category = category },
            Now);

    public static Movement Income(decimal amount, AccountId account, DateOnly? date = null) =>
        Movement.Create(
            MovementId.New(),
            date ?? Today,
            MovementKind.Income,
            EconomicEffect.Income,
            CashFlow.Inflow,
            Amount(amount, date),
            new MovementLinks { Account = account },
            Now);

    public static Movement CardPurchase(decimal amount, CardId card, DateOnly? date = null) =>
        Movement.Create(
            MovementId.New(),
            date ?? Today,
            MovementKind.CardPurchase,
            EconomicEffect.Expense,
            CashFlow.Outflow,
            Amount(amount, date),
            new MovementLinks { Card = card },
            Now);
}
