using Finanzas.Domain.Common;
using Finanzas.Domain.Identifiers;
using Finanzas.Domain.ValueObjects;

namespace Finanzas.Domain.Ledger;

/// <summary>Resultado económico de un periodo, en moneda base.</summary>
public sealed record PeriodResult(Money Income, Money Expense)
{
    /// <summary>Flujo neto: ingresos menos gastos.</summary>
    public Money Net => Income - Expense;
}

/// <summary>
/// Estado de deuda separado por naturaleza. <b>Regla financiera 3</b>: no existe
/// una propiedad "neta" que compense la deuda propia con lo que a uno le deben.
/// Quien quiera compensarlas tiene que hacerlo a la vista, no por descuido.
/// </summary>
public sealed record DebtPosition(Money OwnDebt, Money Receivable);

/// <summary>
/// Proyecciones derivadas del ledger. Saldo de cuenta, deuda de tarjeta y
/// resumen del periodo <b>se calculan</b> desde los movimientos; ninguna de
/// estas cifras se almacena (regla financiera 1). Es la implementación única
/// que compartirán reportes, dashboard y simuladores, para evitar el riesgo §13
/// de calcular lo mismo de forma distinta en cada pantalla.
/// </summary>
public static class LedgerProjections
{
    /// <summary>Saldo de una cuenta en moneda base.</summary>
    public static Money AccountBalance(
        IEnumerable<Movement> movements,
        AccountId account,
        Currency baseCurrency)
    {
        Guard.NotNull(baseCurrency);
        return Money.Sum(
            movements.Where(m => m.Links.Account == account).Select(m => m.SignedCashBase),
            baseCurrency);
    }

    /// <summary>
    /// Deuda con el emisor de una tarjeta, en moneda base. Positiva significa
    /// que se le debe al banco. Las compras asignadas a otras personas no la
    /// reducen: su cargo no mueve caja (regla financiera 3).
    /// </summary>
    public static Money CardDebt(
        IEnumerable<Movement> movements,
        CardId card,
        Currency baseCurrency)
    {
        Guard.NotNull(baseCurrency);
        return Money.Sum(
            movements.Where(m => m.Links.Card == card).Select(m => m.SignedCashBase),
            baseCurrency).Negate();
    }

    /// <summary>Ingresos y gastos de un periodo, en moneda base.</summary>
    public static PeriodResult Summarize(
        IEnumerable<Movement> movements,
        DateRange period,
        Currency baseCurrency)
    {
        Guard.NotNull(baseCurrency);
        var inPeriod = movements.Where(m => period.Contains(m.Date)).ToList();

        var income = Money.Sum(
            inPeriod.Where(m => m.Effect == EconomicEffect.Income).Select(m => m.SignedEconomicBase),
            baseCurrency);

        var expense = Money.Sum(
            inPeriod.Where(m => m.Effect == EconomicEffect.Expense).Select(m => m.SignedEconomicBase),
            baseCurrency).Negate();

        return new PeriodResult(income, expense);
    }

    /// <summary>Total gastado en una categoría durante un periodo.</summary>
    public static Money CategoryTotal(
        IEnumerable<Movement> movements,
        CategoryId category,
        DateRange period,
        Currency baseCurrency)
    {
        Guard.NotNull(baseCurrency);
        return Money.Sum(
            movements
                .Where(m => m.Links.Category == category && period.Contains(m.Date))
                .Select(m => m.SignedEconomicBase),
            baseCurrency);
    }
}
