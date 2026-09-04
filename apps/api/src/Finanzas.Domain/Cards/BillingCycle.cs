using Finanzas.Domain.Common;
using Finanzas.Domain.ValueObjects;

namespace Finanzas.Domain.Cards;

/// <summary>Un ciclo concreto de facturación, ya resuelto en fechas.</summary>
public readonly record struct BillingPeriod
{
    internal BillingPeriod(DateRange range, DateOnly statementDate, DateOnly dueDate)
    {
        Range = range;
        StatementDate = statementDate;
        DueDate = dueDate;
    }

    /// <summary>Días que el ciclo cubre; el último día es el corte.</summary>
    public DateRange Range { get; }

    /// <summary>Fecha de corte (último día del ciclo).</summary>
    public DateOnly StatementDate { get; }

    /// <summary>Fecha límite de pago del extracto.</summary>
    public DateOnly DueDate { get; }

    public override string ToString() => $"{Range} corte {StatementDate:yyyy-MM-dd} vence {DueDate:yyyy-MM-dd}";
}

/// <summary>
/// Condiciones de corte y vencimiento de una tarjeta. Es una función pura de
/// fechas: el mismo ciclo se calcula igual en el dashboard, en el simulador y
/// en los reportes, lo que evita el riesgo §13 "calcular intereses o ciclos de
/// forma distinta en cada pantalla".
/// </summary>
/// <remarks>
/// Los días mayores que la longitud del mes se recortan al último día
/// (un corte el 31 cae el 28 o el 29 en febrero, según el año bisiesto).
/// </remarks>
public sealed record BillingCycle
{
    private BillingCycle(int statementDay, int paymentDueDay)
    {
        StatementDay = statementDay;
        PaymentDueDay = paymentDueDay;
    }

    /// <summary>Día nominal de corte (1 a 31).</summary>
    public int StatementDay { get; }

    /// <summary>Día nominal de pago (1 a 31), posterior al corte.</summary>
    public int PaymentDueDay { get; }

    public static BillingCycle Create(int statementDay, int paymentDueDay)
    {
        Guard.InRange(statementDay, 1, 31, nameof(statementDay));
        Guard.InRange(paymentDueDay, 1, 31, nameof(paymentDueDay));
        return new BillingCycle(statementDay, paymentDueDay);
    }

    /// <summary>Fecha de corte de un mes concreto, recortada a su longitud.</summary>
    public DateOnly StatementDateIn(int year, int month)
    {
        Guard.InRange(month, 1, 12, nameof(month));
        var day = Math.Min(StatementDay, DateTime.DaysInMonth(year, month));
        return new DateOnly(year, month, day);
    }

    /// <summary>Ciclo que contiene una fecha dada.</summary>
    public BillingPeriod PeriodContaining(DateOnly date)
    {
        var statement = StatementDateIn(date.Year, date.Month);
        if (date > statement)
        {
            var next = date.AddMonths(1);
            statement = StatementDateIn(next.Year, next.Month);
        }

        var previousMonth = statement.AddMonths(-1);
        var previousStatement = StatementDateIn(previousMonth.Year, previousMonth.Month);
        var range = DateRange.Create(previousStatement.AddDays(1), statement);

        return new BillingPeriod(range, statement, DueDateFor(statement));
    }

    /// <summary>Ciclo siguiente al de una fecha dada.</summary>
    public BillingPeriod NextPeriodAfter(DateOnly date) =>
        PeriodContaining(PeriodContaining(date).StatementDate.AddDays(1));

    /// <summary>
    /// Vencimiento de un corte: la primera fecha posterior al corte cuyo día
    /// coincide con <see cref="PaymentDueDay"/>.
    /// </summary>
    public DateOnly DueDateFor(DateOnly statementDate)
    {
        var candidate = ClampToMonth(statementDate.Year, statementDate.Month, PaymentDueDay);
        if (candidate > statementDate)
        {
            return candidate;
        }

        var next = statementDate.AddMonths(1);
        return ClampToMonth(next.Year, next.Month, PaymentDueDay);
    }

    private static DateOnly ClampToMonth(int year, int month, int day) =>
        new(year, month, Math.Min(day, DateTime.DaysInMonth(year, month)));

    public override string ToString() => $"corte día {StatementDay}, pago día {PaymentDueDay}";
}
