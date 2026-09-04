using Finanzas.Domain.Common;

namespace Finanzas.Domain.Recurrences;

public enum RecurrenceFrequency
{
    Daily = 1,
    Weekly = 2,
    Monthly = 3,
    Yearly = 4,
}

/// <summary>
/// Programación de un recurrente. Es una función pura de fechas: la próxima
/// ocurrencia no depende del reloj ni del estado, solo del calendario.
/// </summary>
/// <remarks>
/// Convenciones documentadas:
/// <list type="bullet">
///   <item>Un día del mes mayor que la longitud del mes se recorta al último día
///   (el 31 cae el 28 o el 29 en febrero, según el año bisiesto).</item>
///   <item>El recorte no desplaza la serie: tras un febrero recortado, marzo
///   vuelve al día nominal.</item>
///   <item><see cref="Range"/> es cerrado; sin fin, el recurrente no caduca.</item>
/// </list>
/// </remarks>
public sealed record RecurrenceSchedule
{
    private RecurrenceSchedule(
        RecurrenceFrequency frequency,
        int interval,
        DateOnly start,
        DateOnly? end,
        int? dayOfMonth,
        DayOfWeek? dayOfWeek)
    {
        Frequency = frequency;
        Interval = interval;
        Start = start;
        End = end;
        DayOfMonth = dayOfMonth;
        DayOfWeek = dayOfWeek;
    }

    public RecurrenceFrequency Frequency { get; }

    /// <summary>Cada cuántos periodos se repite (1 = todos).</summary>
    public int Interval { get; }

    public DateOnly Start { get; }

    public DateOnly? End { get; }

    /// <summary>Día nominal del mes, obligatorio en frecuencia mensual.</summary>
    public int? DayOfMonth { get; }

    /// <summary>Día de la semana, obligatorio en frecuencia semanal.</summary>
    public DayOfWeek? DayOfWeek { get; }

    public static RecurrenceSchedule Create(
        RecurrenceFrequency frequency,
        int interval,
        DateOnly start,
        DateOnly? end = null,
        int? dayOfMonth = null,
        DayOfWeek? dayOfWeek = null)
    {
        Guard.Require(
            interval >= 1,
            DomainErrorCodes.RecurrenceInvalidSchedule,
            $"El intervalo debe ser al menos 1 (recibido {interval}).");

        Guard.Require(
            end is null || end.Value >= start,
            DomainErrorCodes.RecurrenceInvalidSchedule,
            "La fecha de fin no puede ser anterior al inicio.");

        if (frequency == RecurrenceFrequency.Monthly || frequency == RecurrenceFrequency.Yearly)
        {
            dayOfMonth ??= start.Day;
            Guard.InRange(dayOfMonth.Value, 1, 31, nameof(dayOfMonth));
        }
        else
        {
            dayOfMonth = null;
        }

        if (frequency == RecurrenceFrequency.Weekly)
        {
            dayOfWeek ??= start.DayOfWeek;
        }
        else
        {
            dayOfWeek = null;
        }

        return new RecurrenceSchedule(frequency, interval, start, end, dayOfMonth, dayOfWeek);
    }

    /// <summary>Primera ocurrencia igual o posterior al inicio.</summary>
    public DateOnly? FirstOccurrence() => OccurrenceOnOrAfter(Start);

    /// <summary>Próxima ocurrencia estrictamente posterior a <paramref name="date"/>.</summary>
    public DateOnly? NextOccurrenceAfter(DateOnly date) => OccurrenceOnOrAfter(date.AddDays(1));

    /// <summary>Indica si una fecha concreta es una ocurrencia válida.</summary>
    public bool IsOccurrence(DateOnly date)
    {
        if (date < Start || (End is not null && date > End.Value))
        {
            return false;
        }

        return OccurrenceOnOrAfter(date) == date;
    }

    private DateOnly? OccurrenceOnOrAfter(DateOnly from)
    {
        if (from < Start)
        {
            from = Start;
        }

        var candidate = Frequency switch
        {
            RecurrenceFrequency.Daily => DailyOccurrence(from),
            RecurrenceFrequency.Weekly => WeeklyOccurrence(from),
            RecurrenceFrequency.Monthly => MonthlyOccurrence(from),
            RecurrenceFrequency.Yearly => YearlyOccurrence(from),
            _ => throw new InvariantViolationException(
                DomainErrorCodes.RecurrenceInvalidSchedule,
                $"Frecuencia no soportada: {Frequency}."),
        };

        if (End is not null && candidate > End.Value)
        {
            return null;
        }

        return candidate;
    }

    private DateOnly DailyOccurrence(DateOnly from)
    {
        var elapsed = from.DayNumber - Start.DayNumber;
        var steps = (elapsed + Interval - 1) / Interval;
        return Start.AddDays(steps * Interval);
    }

    private DateOnly WeeklyOccurrence(DateOnly from)
    {
        var anchor = Start;
        var offset = ((int)DayOfWeek!.Value - (int)Start.DayOfWeek + 7) % 7;
        anchor = anchor.AddDays(offset);

        if (from <= anchor)
        {
            return anchor;
        }

        var weeks = (from.DayNumber - anchor.DayNumber + (Interval * 7) - 1) / (Interval * 7);
        return anchor.AddDays(weeks * Interval * 7);
    }

    private DateOnly MonthlyOccurrence(DateOnly from)
    {
        var anchor = ClampToMonth(Start.Year, Start.Month, DayOfMonth!.Value);
        if (anchor < Start)
        {
            anchor = AddMonthsClamped(Start.Year, Start.Month, Interval);
        }

        if (from <= anchor)
        {
            return anchor;
        }

        var monthsApart = ((from.Year - anchor.Year) * 12) + from.Month - anchor.Month;
        var steps = Math.Max(0, monthsApart / Interval);
        var candidate = AddMonthsClamped(anchor.Year, anchor.Month, steps * Interval);

        while (candidate < from)
        {
            steps++;
            candidate = AddMonthsClamped(anchor.Year, anchor.Month, steps * Interval);
        }

        return candidate;
    }

    private DateOnly YearlyOccurrence(DateOnly from)
    {
        var anchor = ClampToMonth(Start.Year, Start.Month, DayOfMonth!.Value);
        if (anchor < Start)
        {
            anchor = ClampToMonth(Start.Year + Interval, Start.Month, DayOfMonth.Value);
        }

        if (from <= anchor)
        {
            return anchor;
        }

        var yearsApart = from.Year - anchor.Year;
        var steps = Math.Max(0, yearsApart / Interval);
        var candidate = ClampToMonth(anchor.Year + (steps * Interval), anchor.Month, DayOfMonth.Value);

        while (candidate < from)
        {
            steps++;
            candidate = ClampToMonth(anchor.Year + (steps * Interval), anchor.Month, DayOfMonth.Value);
        }

        return candidate;
    }

    private DateOnly AddMonthsClamped(int year, int month, int monthsToAdd)
    {
        var shifted = new DateOnly(year, month, 1).AddMonths(monthsToAdd);
        return ClampToMonth(shifted.Year, shifted.Month, DayOfMonth!.Value);
    }

    private static DateOnly ClampToMonth(int year, int month, int day) =>
        new(year, month, Math.Min(day, DateTime.DaysInMonth(year, month)));

    public override string ToString() =>
        $"{Frequency} cada {Interval} desde {Start:yyyy-MM-dd}{(End is null ? string.Empty : $" hasta {End:yyyy-MM-dd}")}";
}
